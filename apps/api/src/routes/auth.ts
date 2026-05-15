import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword, getToken } from './auth-utils.js';
import {
  getTherapistProfileCompletion,
  getTherapistPublicationState,
} from '../utils/profile-completeness.js';
import { geocodeAddress } from '../utils/geocode.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';

export { hashPassword, verifyPassword, getToken };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  fullName: z.string().min(2).optional(),
  professionalTitle: z.string().min(2).optional(),
  bio: z.string().optional(),
  city: z.string().min(2).optional(),
  homeVisit: z.boolean().optional(),
  serviceRadiusKm: z.number().min(1).max(200).nullable().optional(),
  isVisible: z.boolean().optional(),
  availability: z.string().optional(),
  kassenart: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  photo: z.string().optional(),
  bookingMode: z.enum(['DIRECTORY_ONLY', 'FIRST_APPOINTMENT_REQUEST']).optional(),
  phone: z.string().max(30).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  street: z.string().max(120).nullable().optional(),
  houseNumber: z.string().max(30).nullable().optional(),
  locationPrecision: z.enum(['approximate', 'exact']).optional(),
});

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

const LOGIN_TEMPORARY_UNAVAILABLE_MESSAGE = 'Server momentan nicht erreichbar. Bitte spaeter erneut versuchen.';

const isDatabaseUnavailableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';

  return (
    code === 'P1001'
    || message.includes("Can't reach database server")
    || message.includes('postgres.railway.internal')
    || message.includes('ECONNREFUSED')
    || message.includes('ENOTFOUND')
  );
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (request, reply) => {
    try {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

      const { email, password } = parsed.data;

      const user = await fastify.prisma.user.findUnique({
        where: { email },
        include: { therapistProfile: true, managerProfile: true },
      });

      if (user?.passwordHash) {
        const validUserPassword = await verifyPassword(password, user.passwordHash);
        if (!validUserPassword) return reply.unauthorized('Falsches Passwort. Bitte erneut versuchen.');

        if (user.requiresEmailVerification && !user.emailVerifiedAt) {
          return reply.unauthorized('Bitte bestätige zunächst deine E-Mail-Adresse. Überprüfe deinen Posteingang.');
        }

        const token = randomBytes(32).toString('hex');
        await fastify.prisma.user.update({
          where: { id: user.id },
          data: { sessionToken: token },
        });

        if (user.role === 'patient') {
          return {
            token,
            userId: user.id,
            accountType: 'patient',
          };
        }

        if (user.role === 'manager') {
          const manager = user.managerProfile ?? await fastify.prisma.practiceManager.findFirst({
            where: { userId: user.id },
          });
          if (!manager) return reply.unauthorized('Manager-Profil nicht gefunden');

          await fastify.prisma.practiceManager.update({
            where: { id: manager.id },
            data: { sessionToken: token },
          });
          const practice = manager.practiceId ? await fastify.prisma.practice.findUnique({ where: { id: manager.practiceId } }) : null;
          return {
            token,
            userId: user.id,
            accountType: 'manager',
            practiceId: manager.practiceId,
            name: practice?.name ?? null,
          };
        }

        const therapist = user.therapistProfile
          ?? await fastify.prisma.therapist.findFirst({ where: { userId: user.id } })
          ?? await fastify.prisma.therapist.findUnique({ where: { email } });
        if (!therapist) return reply.unauthorized('Benutzer mit dieser E-Mail nicht gefunden.');

        await fastify.prisma.therapist.update({
          where: { id: therapist.id },
          data: { sessionToken: token },
        });
        return {
          token,
          userId: user.id,
          accountType: 'therapist',
          therapistId: therapist.id,
          fullName: therapist.fullName,
        };
      }

      const therapist = await fastify.prisma.therapist.findUnique({ where: { email } });
      if (therapist?.passwordHash) {
        const validTherapist = await verifyPassword(password, therapist.passwordHash);
        if (validTherapist) {
          const existingUser = await fastify.prisma.user.findUnique({ where: { email } });
          const ensuredUser = existingUser ?? await fastify.prisma.user.create({
            data: {
              email,
              passwordHash: therapist.passwordHash,
              role: 'therapist',
            },
          });

          const token = randomBytes(32).toString('hex');
          await fastify.prisma.user.update({
            where: { id: ensuredUser.id },
            data: { sessionToken: token },
          });
          await fastify.prisma.therapist.update({
            where: { id: therapist.id },
            data: { sessionToken: token, userId: therapist.userId ?? ensuredUser.id },
          });

          return {
            token,
            userId: ensuredUser.id,
            accountType: 'therapist',
            therapistId: therapist.id,
            fullName: therapist.fullName,
          };
        }
      }

      const manager = await fastify.prisma.practiceManager.findUnique({ where: { email } });
      if (manager?.passwordHash) {
        const validManager = await verifyPassword(password, manager.passwordHash);
        if (validManager) {
          const existingUser = await fastify.prisma.user.findUnique({ where: { email } });
          const ensuredUser = existingUser ?? await fastify.prisma.user.create({
            data: {
              email,
              passwordHash: manager.passwordHash,
              role: 'manager',
            },
          });

          const token = randomBytes(32).toString('hex');
          await fastify.prisma.user.update({
            where: { id: ensuredUser.id },
            data: { sessionToken: token },
          });
          await fastify.prisma.practiceManager.update({
            where: { id: manager.id },
            data: { sessionToken: token, userId: manager.userId ?? ensuredUser.id },
          });
          const practice = manager.practiceId ? await fastify.prisma.practice.findUnique({ where: { id: manager.practiceId } }) : null;

          return {
            token,
            userId: ensuredUser.id,
            accountType: 'manager',
            practiceId: manager.practiceId,
            name: practice?.name ?? null,
          };
        }
      }

      return reply.unauthorized('Benutzer mit dieser E-Mail nicht gefunden.');
    } catch (error) {
      request.log.error({ err: error }, 'Login failed');
      if (isDatabaseUnavailableError(error)) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: LOGIN_TEMPORARY_UNAVAILABLE_MESSAGE,
        });
      }
      throw error;
    }
  });

  fastify.get('/auth/verify-email', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.badRequest('Token fehlt.');

    const user = await fastify.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });
    if (!user) {
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return reply.code(400).send(`
        <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px;background:#f9fafb">
          <h2 style="color:#e05a77">Ungültiger oder abgelaufener Link</h2>
          <p style="color:#6b7280">Bitte registriere dich erneut oder kontaktiere den Support.</p>
        </body></html>
      `);
    }

    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), emailVerificationToken: null },
    });

    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(`
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px 20px;background:#f9fafb">
          <div style="max-width:400px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
            <div style="font-size:48px;margin-bottom:16px">✅</div>
            <h2 style="color:#16a34a;margin-bottom:8px">E-Mail bestätigt!</h2>
            <p style="color:#6b7280;margin-bottom:32px">Dein Konto ist aktiv. Öffne die Revio-App und melde dich an.</p>
            <a href="revo://login" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px">
              App öffnen
            </a>
          </div>
        </body>
      </html>
    `);
  });

  // App-friendly verification: verifies token and returns a session token for auto-login
  fastify.post('/auth/verify-email', async (request, reply) => {
    const { token } = request.body as { token?: string };
    if (!token) return reply.badRequest('Token fehlt.');

    const user = await fastify.prisma.user.findFirst({
      where: { emailVerificationToken: token },
      include: { therapistProfile: true },
    });
    if (!user) return reply.badRequest('Ungültiger oder abgelaufener Bestätigungslink.');

    const sessionToken = randomBytes(32).toString('hex');
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), emailVerificationToken: null, sessionToken },
    });

    const therapist = user.therapistProfile ?? await fastify.prisma.therapist.findFirst({
      where: { userId: user.id },
    });
    if (!therapist) return reply.badRequest('Kein Therapeutenprofil gefunden.');

    await fastify.prisma.therapist.update({
      where: { id: therapist.id },
      data: { sessionToken },
    });

    return reply.status(200).send({
      token: sessionToken,
      therapistId: therapist.id,
      fullName: therapist.fullName,
      accountType: 'therapist',
    });
  });

  fastify.get('/auth/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    let therapist = null as any;
    const user = await fastify.prisma.user.findUnique({
      where: { sessionToken: token },
      include: {
        therapistProfile: {
          include: {
            links: {
              where: { status: 'CONFIRMED' },
              include: { practice: true },
            },
          },
        },
      },
    });

    // Patient profile — return directly without therapist lookup
    if (user?.role === 'patient') {
      return {
        id: user.id,
        email: user.email,
        role: 'patient',
        firstName: (user as any).firstName ?? '',
        lastName: (user as any).lastName ?? '',
        phone: (user as any).phone ?? null,
        createdAt: user.createdAt,
      };
    }

    if (user?.therapistProfile) therapist = user.therapistProfile;

    if (!therapist) {
      therapist = await fastify.prisma.therapist.findUnique({
        where: { sessionToken: token },
        include: {
          links: {
            where: { status: 'CONFIRMED' },
            include: { practice: true },
          },
        },
      });
    }
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const managerAccount = await fastify.prisma.practiceManager.findUnique({
      where: { therapistId: therapist.id },
      include: { assignments: { include: { practice: { select: { id: true, name: true, city: true } } }, take: 1 } },
    });
    const adminPractice = managerAccount?.assignments[0]?.practice ?? null;

    const publication = getTherapistPublicationState(therapist, { links: therapist.links });
    return {
      id: therapist.id,
      email: therapist.email,
      fullName: therapist.fullName,
      professionalTitle: therapist.professionalTitle,
      isFreelancer: therapist.isFreelancer,
      city: therapist.city,
      bio: therapist.bio,
      homeVisit: therapist.homeVisit,
      serviceRadiusKm: (therapist as any).serviceRadiusKm ?? null,
      kassenart: (therapist as any).kassenart ?? '',
      emailVerified: !!(user?.emailVerifiedAt ?? true),
      specializations: splitList(therapist.specializations),
      languages: splitList(therapist.languages),
      certifications: splitList(therapist.certifications),
      photo: therapist.photo,
      isVisible: therapist.isVisible,
      availability: therapist.availability,
      reviewStatus: therapist.reviewStatus,
      visibilityPreference: therapist.visibilityPreference,
      isPublished: therapist.isPublished,
      onboardingStatus: therapist.onboardingStatus,
      postalCode: therapist.postalCode ?? null,
      street: therapist.street ?? null,
      houseNumber: therapist.houseNumber ?? null,
      locationPrecision: therapist.locationPrecision ?? 'approximate',
      latitude: therapist.latitude ?? null,
      longitude: therapist.longitude ?? null,
      gender: therapist.gender ?? null,
      phone: (therapist as any).phone ?? null,
      taxRegistrationStatus: therapist.taxRegistrationStatus ?? null,
      healthAuthorityStatus: therapist.healthAuthorityStatus ?? null,
      complianceUpdatedAt: therapist.complianceUpdatedAt ?? null,
      bookingMode: therapist.bookingMode ?? 'DIRECTORY_ONLY',
      ...publication,
      adminPractice: adminPractice ?? null,
      practices: therapist.links.map((l: any) => ({
        id: l.practice.id,
        name: l.practice.name,
        city: l.practice.city,
        address: l.practice.address,
        phone: l.practice.phone,
        hours: l.practice.hours,
        lat: l.practice.lat,
        lng: l.practice.lng,
      })),
    };
  });

  fastify.patch('/auth/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    let therapist = null as any;
    const user = await fastify.prisma.user.findUnique({
      where: { sessionToken: token },
      include: { therapistProfile: true },
    });

    // Patient profile update — only firstName/lastName
    if (user?.role === 'patient') {
      const patientSchema = z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        phone: z.string().max(30).nullable().optional(),
      });
      const parsed = patientSchema.safeParse(request.body);
      if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());
      const updated = await fastify.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(parsed.data.firstName !== undefined ? { firstName: parsed.data.firstName } : {}),
          ...(parsed.data.lastName !== undefined ? { lastName: parsed.data.lastName } : {}),
          ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
        },
      });
      return {
        id: updated.id,
        email: updated.email,
        role: 'patient',
        firstName: updated.firstName ?? '',
        lastName: updated.lastName ?? '',
        phone: (updated as any).phone ?? null,
      };
    }

    if (user?.therapistProfile) therapist = user.therapistProfile;
    if (!therapist) {
      therapist = await fastify.prisma.therapist.findUnique({
        where: { sessionToken: token },
      });
    }
    // Also allow manager token to edit their linked therapist profile
    if (!therapist) {
      const manager = await fastify.prisma.practiceManager.findUnique({ where: { sessionToken: token } });
      if (manager?.therapistId) {
        therapist = await fastify.prisma.therapist.findUnique({ where: { id: manager.therapistId } });
      }
    }
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const parsed = updateMeSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const data = parsed.data;
    const updateData: Record<string, any> = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.professionalTitle !== undefined) updateData.professionalTitle = data.professionalTitle;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.homeVisit !== undefined) updateData.homeVisit = data.homeVisit;
    if (data.serviceRadiusKm !== undefined) updateData.serviceRadiusKm = data.serviceRadiusKm;
    if (data.isVisible !== undefined) updateData.isVisible = data.isVisible;
    if (data.availability !== undefined) updateData.availability = data.availability;
    if (data.kassenart !== undefined) updateData.kassenart = data.kassenart;
    if (data.specializations !== undefined) updateData.specializations = data.specializations.join(', ');
    if (data.languages !== undefined) updateData.languages = data.languages.join(', ');
    if (data.certifications !== undefined) updateData.certifications = data.certifications.join(', ');
    if (data.photo !== undefined) updateData.photo = data.photo;
    if (data.bookingMode !== undefined) updateData.bookingMode = data.bookingMode;
    if (data.phone !== undefined) updateData.phone = data.phone;

    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
    if (data.street !== undefined) updateData.street = data.street;
    if (data.houseNumber !== undefined) updateData.houseNumber = data.houseNumber;
    if (data.locationPrecision !== undefined) updateData.locationPrecision = data.locationPrecision;
    if (data.city !== undefined) updateData.city = data.city;

    // Re-geocode whenever any address field changes, then apply privacy rule for homeLat/homeLng
    const addressChanged = data.city !== undefined || data.postalCode !== undefined
      || data.street !== undefined || data.houseNumber !== undefined || data.locationPrecision !== undefined;
    if (addressChanged || (therapist.homeLat === 0 && therapist.homeLng === 0)) {
      const effectiveStreet = (data.street ?? therapist.street ?? '');
      const effectiveHouseNumber = (data.houseNumber ?? therapist.houseNumber ?? '');
      const effectiveCity = (data.city ?? therapist.city ?? '');
      const effectivePostalCode = (data.postalCode ?? therapist.postalCode ?? '');
      const effectivePrecision = (data.locationPrecision ?? (therapist as any).locationPrecision ?? 'approximate');
      const streetPart = [effectiveStreet, effectiveHouseNumber].filter(Boolean).join(' ');
      const cityPart = [effectivePostalCode, effectiveCity].filter(Boolean).join(' ');

      const exactCoords = streetPart && effectiveCity ? await geocodeAddress(streetPart, cityPart) : null;
      if (exactCoords) {
        updateData.latitude = exactCoords.lat;
        updateData.longitude = exactCoords.lng;
      }
      if (effectivePrecision === 'exact' && exactCoords) {
        updateData.homeLat = exactCoords.lat;
        updateData.homeLng = exactCoords.lng;
      } else {
        const approxCoords = await geocodeAddress('', cityPart || effectiveCity);
        if (approxCoords) {
          updateData.homeLat = approxCoords.lat;
          updateData.homeLng = approxCoords.lng;
        } else if (exactCoords) {
          updateData.homeLat = exactCoords.lat;
          updateData.homeLng = exactCoords.lng;
        }
      }
    }

    const nextTherapist = {
      ...therapist,
      ...updateData,
    };
    const requiresExplicitPublication =
      therapist.onboardingStatus === 'manager_onboarding' ||
      therapist.onboardingStatus === 'invited' ||
      therapist.onboardingStatus === 'claimed' ||
      therapist.visibilityPreference === 'visible';
    const completion = getTherapistProfileCompletion(nextTherapist, { requireBio: requiresExplicitPublication });
    if (therapist.visibilityPreference === 'visible') {
      updateData.isPublished = completion.complete;
      if (!completion.complete && therapist.onboardingStatus === 'complete') {
        updateData.onboardingStatus = 'claimed';
      }
    }

    await fastify.prisma.therapist.update({
      where: { id: therapist.id },
      data: updateData,
    });

    const updated = await fastify.prisma.therapist.findUnique({
      where: { id: therapist.id },
      include: {
        links: {
          where: { status: 'CONFIRMED' },
          include: { practice: true },
        },
      },
    });
    if (!updated) return reply.notFound('Therapeuten-Profil nicht gefunden');

    const publication = getTherapistPublicationState(updated, { links: updated.links });
    return {
      success: true,
      fullName: updated.fullName,
      isFreelancer: updated.isFreelancer,
      isPublished: updated.isPublished,
      ...publication,
    };
  });

  fastify.delete('/auth/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    let therapist = null as any;
    const user = await fastify.prisma.user.findUnique({
      where: { sessionToken: token },
      include: { therapistProfile: true },
    });

    // Patient deletion — delete User record directly
    if (user?.role === 'patient') {
      await fastify.prisma.user.delete({ where: { id: user.id } });
      return { success: true };
    }

    if (user?.therapistProfile) therapist = user.therapistProfile;
    if (!therapist) {
      therapist = await fastify.prisma.therapist.findUnique({
        where: { sessionToken: token },
      });
    }
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    await fastify.prisma.therapist.delete({ where: { id: therapist.id } });
    if (user) {
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { sessionToken: null },
      });
    }

    return { success: true };
  });

  fastify.patch('/auth/push-token', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');
    const { expoPushToken } = z.object({ expoPushToken: z.string() }).parse(request.body);

    // Patient (User) token
    const user = await fastify.prisma.user.findUnique({ where: { sessionToken: token } });
    if (user) {
      await fastify.prisma.user.update({ where: { id: user.id }, data: { expoPushToken } });
      return { success: true };
    }

    // Therapist token
    const therapist = await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } });
    if (!therapist) return reply.unauthorized('Ungültiger Token');
    await fastify.prisma.therapist.update({ where: { id: therapist.id }, data: { expoPushToken } });
    return { success: true };
  });

  // Returns the document list for the authenticated therapist (no stored filenames exposed)
  fastify.get('/auth/documents', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    let therapistId: string | null = null;
    const user = await fastify.prisma.user.findUnique({
      where: { sessionToken: token },
      include: { therapistProfile: true },
    });
    if (user?.therapistProfile) {
      therapistId = user.therapistProfile.id;
    } else {
      const t = await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } });
      if (t) therapistId = t.id;
    }
    if (!therapistId) return reply.unauthorized('Ungültiger Token');

    const docs = await fastify.prisma.therapistDocument.findMany({
      where: { therapistId },
      orderBy: { uploadedAt: 'desc' },
    });

    // Do not expose internal filename (UUID-based) to the client
    return docs.map((d) => ({
      id: d.id,
      originalName: d.originalName,
      mimetype: d.mimetype,
      uploadedAt: d.uploadedAt.toISOString(),
    }));
  });

  fastify.post('/auth/logout', async (request, reply) => {
    const token = getToken(request);
    if (!token) return { success: true };

    const user = await fastify.prisma.user.findUnique({ where: { sessionToken: token } });
    if (user) {
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { sessionToken: null },
      });
      if (user.role === 'manager') {
        await fastify.prisma.practiceManager.updateMany({
          where: { userId: user.id },
          data: { sessionToken: null },
        });
      }
      if (user.role === 'therapist') {
        await fastify.prisma.therapist.updateMany({
          where: { userId: user.id },
          data: { sessionToken: null },
        });
      }
      return { success: true };
    }

    const therapist = await fastify.prisma.therapist.findUnique({
      where: { sessionToken: token },
    });
    if (therapist) {
      await fastify.prisma.therapist.update({
        where: { id: therapist.id },
        data: { sessionToken: null },
      });
    }

    return { success: true };
  });

  // ── Therapeuten-Favoriten ─────────────────────────────────────────────────

  async function resolveUserForFavorites(request: any, reply: any): Promise<string | null> {
    const token = getToken(request);
    if (!token) { reply.unauthorized('Kein Token'); return null; }

    // Primary lookup via User.sessionToken (patients, modern therapists, managers)
    let user = await fastify.prisma.user.findUnique({ where: { sessionToken: token } });

    // Fallback: legacy therapists may only have Therapist.sessionToken set
    if (!user) {
      const therapist = await fastify.prisma.therapist.findUnique({
        where: { sessionToken: token },
        include: { user: true },
      });
      if (therapist?.user) user = therapist.user;
    }

    if (!user) { reply.unauthorized('Ungültiger Token'); return null; }
    return user.id;
  }

  fastify.get('/auth/favorites/therapists', async (request, reply) => {
    const userId = await resolveUserForFavorites(request, reply);
    if (!userId) return;

    const rows = await fastify.prisma.userFavoriteTherapist.findMany({
      where: { userId },
      include: {
        therapist: {
          select: {
            id: true, fullName: true, professionalTitle: true,
            city: true, photo: true, specializations: true,
            languages: true, homeVisit: true, isVisible: true,
            reviewStatus: true, email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      therapists: rows.map((r) => ({
        ...r.therapist,
        specializations: r.therapist.specializations.split(',').map((s: string) => s.trim()).filter(Boolean),
        languages: r.therapist.languages.split(',').map((s: string) => s.trim()).filter(Boolean),
      })),
    };
  });

  fastify.post('/auth/favorites/therapists', async (request, reply) => {
    const userId = await resolveUserForFavorites(request, reply);
    if (!userId) return;

    const parsed = z.object({ therapistId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) {
      fastify.log.warn({ body: request.body, error: parsed.error.flatten() }, 'POST /auth/favorites/therapists validation failed');
      return reply.badRequest(JSON.stringify(parsed.error.flatten()));
    }

    const therapist = await fastify.prisma.therapist.findUnique({ where: { id: parsed.data.therapistId } });
    if (!therapist) return reply.notFound('Therapeut nicht gefunden');

    await fastify.prisma.userFavoriteTherapist.upsert({
      where: { userId_therapistId: { userId, therapistId: parsed.data.therapistId } },
      create: { userId, therapistId: parsed.data.therapistId },
      update: {},
    });

    return { ok: true };
  });

  fastify.delete('/auth/favorites/therapists/:therapistId', async (request, reply) => {
    const userId = await resolveUserForFavorites(request, reply);
    if (!userId) return;

    const { therapistId } = request.params as { therapistId: string };

    await fastify.prisma.userFavoriteTherapist.deleteMany({
      where: { userId, therapistId },
    });

    return { ok: true };
  });

  // ── Forgot password ───────────────────────────────────────────────────────

  fastify.post('/auth/forgot-password', async (request, reply) => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige E-Mail-Adresse.');

    const { email } = parsed.data;

    // Always return success to prevent email enumeration
    const user = await fastify.prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true };

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt },
    });

    const resetLink = `revo://reset-password?token=${token}`;
    const name = user.firstName ?? email;
    await sendPasswordResetEmail({ to: email, name, resetLink }).catch((err) => {
      fastify.log.error({ err }, 'Failed to send password reset email');
    });

    return { ok: true };
  });

  fastify.post('/auth/reset-password', async (request, reply) => {
    const schema = z.object({
      token: z.string().min(1),
      password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein.'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Ungültige Eingabe.';
      return reply.badRequest(msg);
    }

    const { token, password } = parsed.data;

    const user = await fastify.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) return reply.badRequest('Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.');

    const passwordHash = await hashPassword(password);
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null },
    });

    // Also update legacy Therapist.passwordHash if linked
    if (user.role === 'therapist') {
      await fastify.prisma.therapist.updateMany({
        where: { userId: user.id },
        data: { passwordHash },
      });
    }

    return { ok: true };
  });
};
