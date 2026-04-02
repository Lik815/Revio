import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword, getToken } from './auth-utils.js';
import {
  getTherapistProfileCompletion,
  getTherapistPublicationState,
  getTherapistRequestabilityState,
} from '../utils/profile-completeness.js';
import { geocodeAddress } from '../utils/geocode.js';

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
  bookingMode: z.enum(['DIRECTORY_ONLY', 'FIRST_APPOINTMENT_REQUEST']).optional(),
  nextFreeSlotAt: z.string().trim().min(10).nullable().optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  photo: z.string().optional(),
});

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { email, password } = parsed.data;

    const user = await fastify.prisma.user.findUnique({
      where: { email },
      include: { therapistProfile: true, managerProfile: true },
    });

    if (user?.passwordHash) {
      const validUserPassword = await verifyPassword(password, user.passwordHash);
      if (!validUserPassword) return reply.unauthorized('Ungültige Zugangsdaten');

      // Block self-registered therapists who have not verified their email yet
      if (user.role === 'therapist' && user.requiresEmailVerification && !user.emailVerifiedAt) {
        return reply.unauthorized('Bitte bestätige zunächst deine E-Mail-Adresse. Überprüfe deinen Posteingang.');
      }

      const token = randomBytes(32).toString('hex');
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { sessionToken: token },
      });

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

      const therapist = user.therapistProfile ?? await fastify.prisma.therapist.findFirst({
        where: { userId: user.id },
      });
      if (!therapist) return reply.unauthorized('Therapeuten-Profil nicht gefunden');

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

    // Legacy fallback: therapist credentials without a migrated User row.
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

    // Legacy fallback: manager credentials without a migrated User row.
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

    return reply.unauthorized('Ungültige Zugangsdaten');
  });

  fastify.get('/auth/verify-email', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.badRequest('Token fehlt.');

    const user = await fastify.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });
    if (!user) {
      return reply.code(400).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2 style="color:#e05a77">Ungültiger oder abgelaufener Link</h2>
          <p>Bitte registriere dich erneut oder kontaktiere den Support.</p>
        </body></html>
      `);
    }

    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), emailVerificationToken: null },
    });

    reply.header('Content-Type', 'text/html');
    return reply.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:#2563eb">E-Mail bestätigt ✓</h2>
        <p>Dein Konto ist jetzt aktiv. Du kannst die Revio-App öffnen und dich einloggen.</p>
      </body></html>
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
    const requestability = getTherapistRequestabilityState(therapist, { links: therapist.links });

    return {
      id: therapist.id,
      email: therapist.email,
      fullName: therapist.fullName,
      professionalTitle: therapist.professionalTitle,
      city: therapist.city,
      bio: therapist.bio,
      homeVisit: therapist.homeVisit,
      serviceRadiusKm: (therapist as any).serviceRadiusKm ?? null,
      kassenart: (therapist as any).kassenart ?? '',
      bookingMode: (therapist as any).bookingMode ?? 'DIRECTORY_ONLY',
      nextFreeSlotAt: (therapist as any).nextFreeSlotAt
        ? new Date((therapist as any).nextFreeSlotAt).toISOString()
        : null,
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
      requestability,
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
    if (data.bookingMode !== undefined) updateData.bookingMode = data.bookingMode;
    if (data.nextFreeSlotAt !== undefined) {
      updateData.nextFreeSlotAt = data.nextFreeSlotAt ? new Date(data.nextFreeSlotAt) : null;
    }
    if (data.specializations !== undefined) updateData.specializations = data.specializations.join(', ');
    if (data.languages !== undefined) updateData.languages = data.languages.join(', ');
    if (data.certifications !== undefined) updateData.certifications = data.certifications.join(', ');
    if (data.photo !== undefined) updateData.photo = data.photo;

    // Wenn city geändert: Stadt geocodieren → homeLat/homeLng setzen
    if (data.city !== undefined) {
      updateData.city = data.city;
      const coords = await geocodeAddress('', data.city);
      if (coords) {
        updateData.homeLat = coords.lat;
        updateData.homeLng = coords.lng;
      }
    } else if (therapist.homeLat === 0 && therapist.homeLng === 0 && therapist.city) {
      // Einmalige Nachrüstung: bestehender Therapeut ohne Koordinaten
      const coords = await geocodeAddress('', therapist.city);
      if (coords) {
        updateData.homeLat = coords.lat;
        updateData.homeLng = coords.lng;
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
    const requestability = getTherapistRequestabilityState(updated, { links: updated.links });

    return {
      success: true,
      fullName: updated.fullName,
      isPublished: updated.isPublished,
      bookingMode: (updated as any).bookingMode ?? 'DIRECTORY_ONLY',
      nextFreeSlotAt: (updated as any).nextFreeSlotAt
        ? new Date((updated as any).nextFreeSlotAt).toISOString()
        : null,
      requestability,
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

  fastify.post('/auth/push-token', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const { pushToken } = request.body as { pushToken?: string };
    if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
      return reply.badRequest('Ungültiger Push-Token');
    }

    // Resolve therapist via User row or direct session token
    let therapistId: string | null = null;
    const user = await fastify.prisma.user.findUnique({
      where: { sessionToken: token },
      include: { therapistProfile: true },
    });
    if (user?.therapistProfile) {
      therapistId = user.therapistProfile.id;
    } else {
      const therapist = await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } });
      if (therapist) therapistId = therapist.id;
    }

    if (!therapistId) return reply.unauthorized('Ungültiger Token');

    await fastify.prisma.therapist.update({
      where: { id: therapistId },
      data: { expoPushToken: pushToken },
    });

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
};
