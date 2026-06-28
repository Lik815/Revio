import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword, getToken } from './auth-utils.js';
import {
  getTherapistProfileCompletion,
  getTherapistProfileCompletionDetail,
  getTherapistPublicationState,
  getProfileStatus,
} from '../utils/profile-completeness.js';
import { normalizeKassenarten, serializeKassenarten } from '../utils/kassenarten.js';
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
  kassenarten: z.array(z.string()).optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  heilmittel: z.array(z.string()).optional(),
  photo: z.string().optional(),
  bookingMode: z.enum(['DIRECTORY_ONLY', 'FIRST_APPOINTMENT_REQUEST']).optional(),
  phone: z.string().max(30).nullable().optional(),
  gender: z.enum(['female', 'male']).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  street: z.string().max(120).nullable().optional(),
  houseNumber: z.string().max(30).nullable().optional(),
  locationPrecision: z.enum(['approximate', 'exact']).optional(),
});

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const newTokenExpiry = () => new Date(Date.now() + TOKEN_TTL_MS);

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

function activeAppointmentsMessage(count: number): string {
  const subject = count === 1 ? '1 aktiven Termin' : `${count} aktive Termine`;
  const pronoun = count === 1 ? 'ihn' : 'sie';
  const verb = count === 1 ? 'er vorbei ist' : 'sie vorbei sind';
  return `Du hast noch ${subject}. Bitte sage ${pronoun} zuerst ab oder warte, bis ${verb}.`;
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (request, reply) => {
    try {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

      const { email, password } = parsed.data;

      const user = await fastify.prisma.user.findUnique({
        where: { email },
        include: { therapistProfile: true },
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
          data: { sessionToken: token, sessionTokenExpiresAt: newTokenExpiry() },
        });

        if (user.role === 'patient') {
          return {
            token,
            userId: user.id,
            accountType: 'patient',
          };
        }

        if (user.role === 'practice_admin') {
          const practice = await fastify.prisma.practice.findFirst({
            where: { ownerUserId: user.id },
            orderBy: { createdAt: 'asc' },
          });
          return {
            token,
            userId: user.id,
            accountType: 'practice_admin',
            practiceId: practice?.id ?? null,
            practiceName: practice?.name ?? null,
          };
        }

        const therapist = user.therapistProfile
          ?? await fastify.prisma.therapist.findFirst({ where: { userId: user.id } })
          ?? await fastify.prisma.therapist.findUnique({ where: { email } });
        if (!therapist) return reply.unauthorized('Benutzer mit dieser E-Mail nicht gefunden.');

        await fastify.prisma.therapist.update({
          where: { id: therapist.id },
          data: { sessionToken: token, sessionTokenExpiresAt: newTokenExpiry() },
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
            data: { sessionToken: token, sessionTokenExpiresAt: newTokenExpiry() },
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
      data: { emailVerifiedAt: new Date(), emailVerificationToken: null, sessionToken, sessionTokenExpiresAt: newTokenExpiry() },
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
    });
    if (user?.sessionTokenExpiresAt && user.sessionTokenExpiresAt < new Date()) {
      await fastify.prisma.user.update({ where: { id: user.id }, data: { sessionToken: null, sessionTokenExpiresAt: null } });
      return reply.unauthorized('Sitzung abgelaufen. Bitte erneut anmelden.');
    }
    const userWithProfile = await fastify.prisma.user.findUnique({
      where: { sessionToken: token },
      include: {
        therapistProfile: {
          include: {
            links: {
              where: { status: 'CONFIRMED' },
              include: { practice: true },
            },
            _count: {
              select: { documents: true },
            },
          },
        },
      },
    });

    // Patient profile — return directly without therapist lookup
    if (userWithProfile?.role === 'patient') {
      return {
        id: userWithProfile.id,
        email: userWithProfile.email,
        role: 'patient',
        firstName: (userWithProfile as any).firstName ?? '',
        lastName: (userWithProfile as any).lastName ?? '',
        phone: (userWithProfile as any).phone ?? null,
        createdAt: userWithProfile.createdAt,
      };
    }

    // Practice admin — return the owned practice (editing happens via /practice/me)
    if (userWithProfile?.role === 'practice_admin') {
      const practice = await fastify.prisma.practice.findFirst({
        where: { ownerUserId: userWithProfile.id },
        orderBy: { createdAt: 'asc' },
      });
      let photos: string[] | undefined;
      if (practice?.photos) { try { photos = JSON.parse(practice.photos); } catch {} }
      return {
        id: userWithProfile.id,
        email: userWithProfile.email,
        role: 'practice_admin',
        accountType: 'practice_admin',
        firstName: (userWithProfile as any).firstName ?? '',
        lastName: (userWithProfile as any).lastName ?? '',
        phone: (userWithProfile as any).phone ?? null,
        createdAt: userWithProfile.createdAt,
        practice: practice
          ? {
              id: practice.id,
              name: practice.name,
              city: practice.city,
              postalCode: practice.postalCode ?? null,
              address: practice.address ?? null,
              phone: practice.phone ?? null,
              email: practice.email ?? null,
              website: practice.website ?? null,
              description: practice.description ?? null,
              specialties: splitList(practice.specialties),
              services: splitList(practice.services),
              openingHours: practice.openingHours ?? null,
              hours: practice.hours ?? null,
              logo: practice.logo ?? null,
              photos,
              lat: practice.lat,
              lng: practice.lng,
              isVisible: practice.isVisible,
              reviewStatus: practice.reviewStatus,
            }
          : null,
      };
    }

    if (userWithProfile?.therapistProfile) therapist = userWithProfile.therapistProfile;

    if (!therapist) {
      therapist = await fastify.prisma.therapist.findUnique({
        where: { sessionToken: token },
        include: {
          links: {
            where: { status: 'CONFIRMED' },
            include: { practice: true },
          },
          _count: {
            select: { documents: true },
          },
        },
      });
    }
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const normalizedKassenarten = normalizeKassenarten((therapist as any).kassenart);
    const serializedKassenarten = serializeKassenarten((therapist as any).kassenart);
    const documentCount = therapist._count?.documents ?? 0;
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
      kassenart: serializedKassenarten,
      kassenarten: normalizedKassenarten,
      emailVerified: !!(userWithProfile?.emailVerifiedAt ?? true),
      specializations: splitList(therapist.specializations),
      languages: splitList(therapist.languages),
      certifications: splitList(therapist.certifications),
      heilmittel: splitList((therapist as any).heilmittel ?? ''),
      photo: therapist.photo,
      isVisible: therapist.isVisible,
      availability: therapist.availability,
      reviewStatus: therapist.reviewStatus,
      employmentStatus: (therapist as any).employmentStatus ?? 'SELF_EMPLOYED',
      profileCompletion: getTherapistProfileCompletionDetail({
        ...(therapist as any),
        kassenart: serializedKassenarten,
        documentCount,
      }),
      visibilityPreference: therapist.visibilityPreference,
      isPublished: therapist.isPublished,
      postalCode: therapist.postalCode ?? null,
      street: therapist.street ?? null,
      houseNumber: therapist.houseNumber ?? null,
      locationPrecision: therapist.locationPrecision ?? 'approximate',
      latitude: therapist.latitude ?? null,
      longitude: therapist.longitude ?? null,
      homeLat: (therapist as any).homeLat ?? null,
      homeLng: (therapist as any).homeLng ?? null,
      gender: therapist.gender ?? null,
      phone: (therapist as any).phone ?? null,
      documentCount,
      taxRegistrationStatus: therapist.taxRegistrationStatus ?? null,
      healthAuthorityStatus: therapist.healthAuthorityStatus ?? null,
      complianceUpdatedAt: therapist.complianceUpdatedAt ?? null,
      compliance: {
        taxRegistrationStatus: therapist.taxRegistrationStatus ?? null,
        healthAuthorityStatus: therapist.healthAuthorityStatus ?? null,
        updatedAt: therapist.complianceUpdatedAt ?? null,
      },
      bookingMode: therapist.bookingMode ?? 'DIRECTORY_ONLY',
      profileStatus: getProfileStatus({
        ...(therapist as any),
        kassenart: serializedKassenarten,
      }),
      ...publication,
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

    // Practice profiles are edited through PATCH /practice/me, not here.
    if (user?.role === 'practice_admin') {
      return reply.badRequest('Praxisprofile werden über /practice/me bearbeitet.');
    }

    if (user?.therapistProfile) therapist = user.therapistProfile;
    if (!therapist) {
      therapist = await fastify.prisma.therapist.findUnique({
        where: { sessionToken: token },
      });
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
    if (data.kassenarten !== undefined || data.kassenart !== undefined) {
      updateData.kassenart = serializeKassenarten(data.kassenarten ?? data.kassenart);
    }
    if (data.specializations !== undefined) updateData.specializations = data.specializations.join(', ');
    if (data.languages !== undefined) updateData.languages = data.languages.join(', ');
    if (data.certifications !== undefined) updateData.certifications = data.certifications.join(', ');
    if (data.heilmittel !== undefined) updateData.heilmittel = data.heilmittel.join(', ');
    if (data.photo !== undefined) updateData.photo = data.photo;
    if (data.bookingMode !== undefined) {
      if (therapist.reviewStatus !== 'APPROVED') {
        return reply.badRequest('Terminanfragen können erst nach der Profilprüfung aktiviert werden.');
      }
      if (data.bookingMode === 'FIRST_APPOINTMENT_REQUEST') {
        // Heilmittel sind Voraussetzung für Online-Terminanfragen: Patient:innen
        // müssen sofort sehen können, was angeboten wird, ohne es selbst angeben
        // zu müssen. Berücksichtigt sowohl bereits gespeicherte als auch in
        // diesem Request mitgesendete Heilmittel.
        const effectiveHeilmittel = data.heilmittel !== undefined
          ? data.heilmittel
          : splitList((therapist as any).heilmittel ?? '');
        if (effectiveHeilmittel.length === 0) {
          return reply.badRequest('Bitte wähle zuerst, welche Heilmittel du behandelst, bevor du Terminanfragen aktivierst.');
        }
      }
      updateData.bookingMode = data.bookingMode;
    }
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.gender !== undefined) updateData.gender = data.gender;

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
      } else if (exactCoords) {
        // Already have a geocoded point — use it for approximate too (avoids second Nominatim request)
        updateData.homeLat = exactCoords.lat;
        updateData.homeLng = exactCoords.lng;
      } else if (cityPart || effectiveCity) {
        // No street → geocode city only (single request)
        const approxCoords = await geocodeAddress('', cityPart || effectiveCity);
        if (approxCoords) {
          updateData.homeLat = approxCoords.lat;
          updateData.homeLng = approxCoords.lng;
        }
      }
    }

    const nextTherapist = {
      ...therapist,
      ...updateData,
    };
    const requiresExplicitPublication =
      therapist.visibilityPreference === 'visible';
    const completion = getTherapistProfileCompletion(nextTherapist, { requireBio: requiresExplicitPublication });
    if (therapist.visibilityPreference === 'visible') {
      updateData.isPublished = completion.complete;
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
        _count: {
          select: { documents: true },
        },
      },
    });
    if (!updated) return reply.notFound('Therapeuten-Profil nicht gefunden');

    const publication = getTherapistPublicationState(updated, { links: updated.links });
    const normalizedKassenarten = normalizeKassenarten((updated as any).kassenart);
    const serializedKassenarten = serializeKassenarten((updated as any).kassenart);
    const documentCount = updated._count?.documents ?? 0;
    return {
      success: true,
      fullName: updated.fullName,
      isFreelancer: updated.isFreelancer,
      isPublished: updated.isPublished,
      city: updated.city,
      postalCode: (updated as any).postalCode ?? null,
      street: (updated as any).street ?? null,
      houseNumber: (updated as any).houseNumber ?? null,
      locationPrecision: (updated as any).locationPrecision ?? 'approximate',
      latitude: (updated as any).latitude ?? null,
      longitude: (updated as any).longitude ?? null,
      homeLat: (updated as any).homeLat ?? null,
      homeLng: (updated as any).homeLng ?? null,
      gender: updated.gender ?? null,
      phone: (updated as any).phone ?? null,
      kassenart: serializedKassenarten,
      kassenarten: normalizedKassenarten,
      documentCount,
      profileCompletion: getTherapistProfileCompletionDetail({
        ...(updated as any),
        kassenart: serializedKassenarten,
        documentCount,
      }),
      ...publication,
    };
  });

  // ── POST /therapists/me/submit-for-review ──────────────────────────────────
  // The ONLY endpoint that moves a therapist into PENDING_REVIEW. Regular
  // PATCH /auth/me updates never change reviewStatus. Allowed only from DRAFT or
  // CHANGES_REQUESTED, only when the minimum criteria are met, and never for
  // PREPARING profiles (which can never become publicly visible).
  fastify.post('/therapists/me/submit-for-review', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const user = await fastify.prisma.user.findUnique({ where: { sessionToken: token } });
    const therapist = (user
      ? (await fastify.prisma.therapist.findFirst({ where: { userId: user.id } }))
        ?? (await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } }))
      : await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } }));
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    if ((therapist as any).employmentStatus === 'PREPARING') {
      return reply.badRequest(
        'Profile mit Status "in Vorbereitung" können nicht zur Prüfung eingereicht werden. Wechsle zuerst auf "selbstständig".',
      );
    }

    const documentCount = await fastify.prisma.therapistDocument.count({
      where: { therapistId: therapist.id },
    });
    const completion = getTherapistProfileCompletionDetail({
      ...(therapist as any),
      kassenart: serializeKassenarten((therapist as any).kassenart),
      documentCount,
    });
    if (!completion.readyForReview) {
      return reply.badRequest(
        'Profil noch nicht vollständig genug für die Prüfung. Fehlende Angaben: ' +
          completion.missingItems.join(', '),
      );
    }

    if (!['DRAFT', 'CHANGES_REQUESTED'].includes(therapist.reviewStatus)) {
      return reply.badRequest(
        therapist.reviewStatus === 'PENDING_REVIEW'
          ? 'Dein Profil wird bereits geprüft.'
          : 'Dein Profil kann in diesem Status nicht erneut eingereicht werden.',
      );
    }

    const updated = await fastify.prisma.therapist.update({
      where: { id: therapist.id },
      data: { reviewStatus: 'PENDING_REVIEW' },
    });

    return {
      success: true,
      reviewStatus: updated.reviewStatus,
      profileCompletion: getTherapistProfileCompletionDetail({
        ...(updated as any),
        kassenart: serializeKassenarten((updated as any).kassenart),
        documentCount,
      }),
    };
  });

  fastify.patch('/auth/me/compliance', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const schema = z.object({
      taxRegistrationStatus: z.enum(['yes', 'no', 'in_progress']).nullable().optional(),
      healthAuthorityStatus: z.enum(['yes', 'no', 'in_progress', 'unknown']).nullable().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const user = await fastify.prisma.user.findUnique({ where: { sessionToken: token } });
    const therapist = (user
      ? (await fastify.prisma.therapist.findFirst({ where: { userId: user.id } }))
        ?? (await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } }))
      : await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } }));
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const updateData: Record<string, unknown> = { complianceUpdatedAt: new Date() };
    if (parsed.data.taxRegistrationStatus !== undefined) updateData.taxRegistrationStatus = parsed.data.taxRegistrationStatus;
    if (parsed.data.healthAuthorityStatus !== undefined) updateData.healthAuthorityStatus = parsed.data.healthAuthorityStatus;

    const updated = await fastify.prisma.therapist.update({ where: { id: therapist.id }, data: updateData as any });

    const merged = { ...therapist, ...updated };
    const { missingFields } = getTherapistProfileCompletion(merged as any);
    const profileStatus = getProfileStatus(merged as any);

    return {
      compliance: {
        taxRegistrationStatus: (updated as any).taxRegistrationStatus ?? null,
        healthAuthorityStatus: (updated as any).healthAuthorityStatus ?? null,
        updatedAt: (updated as any).complianceUpdatedAt ?? null,
      },
      profileStatus,
      missingFields,
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
      const activeCount = await fastify.prisma.bookingRequest.count({
        where: {
          patientUserId: user.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          confirmedSlotAt: { gte: new Date() },
        },
      });
      if (activeCount > 0) return reply.badRequest(activeAppointmentsMessage(activeCount));

      await fastify.prisma.user.delete({ where: { id: user.id } });
      return { success: true };
    }

    // Practice admin deletion — owned practices become ownerless (Practice.ownerUserId
    // is SetNull) rather than deleted, so team links / public data are preserved.
    if (user?.role === 'practice_admin') {
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

    {
      const activeCount = await fastify.prisma.bookingRequest.count({
        where: {
          therapistId: therapist.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          confirmedSlotAt: { gte: new Date() },
        },
      });
      if (activeCount > 0) return reply.badRequest(activeAppointmentsMessage(activeCount));
    }

    await fastify.prisma.therapist.delete({ where: { id: therapist.id } });
    if (user) {
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { sessionToken: null, sessionTokenExpiresAt: null },
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
        data: { sessionToken: null, sessionTokenExpiresAt: null },
      });
      if (user.role === 'therapist') {
        await fastify.prisma.therapist.updateMany({
          where: { userId: user.id },
          data: { sessionToken: null, sessionTokenExpiresAt: null },
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
        data: { sessionToken: null, sessionTokenExpiresAt: null },
      });
    }

    return { success: true };
  });

  // ── Therapeuten-Favoriten ─────────────────────────────────────────────────

  async function resolveUserForFavorites(request: any, reply: any): Promise<string | null> {
    const token = getToken(request);
    if (!token) { reply.unauthorized('Kein Token'); return null; }

    // Primary lookup via User.sessionToken (patients, modern therapists)
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

  // ── Practice favorites ──────────────────────────────────────────────────────
  fastify.get('/auth/favorites/practices', async (request, reply) => {
    const userId = await resolveUserForFavorites(request, reply);
    if (!userId) return;

    const rows = await fastify.prisma.userFavoritePractice.findMany({
      where: { userId },
      include: {
        practice: {
          select: {
            id: true, name: true, city: true, postalCode: true, address: true,
            phone: true, email: true, website: true, description: true,
            specialties: true, services: true, openingHours: true, hours: true,
            logo: true, photos: true, lat: true, lng: true, reviewStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      practices: rows.map((r) => {
        let photos: string[] | undefined;
        if (r.practice.photos) { try { photos = JSON.parse(r.practice.photos); } catch {} }
        return {
          ...r.practice,
          specialties: splitList(r.practice.specialties),
          services: splitList(r.practice.services),
          photos,
        };
      }),
    };
  });

  fastify.post('/auth/favorites/practices', async (request, reply) => {
    const userId = await resolveUserForFavorites(request, reply);
    if (!userId) return;

    const parsed = z.object({ practiceId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.badRequest(JSON.stringify(parsed.error.flatten()));

    const practice = await fastify.prisma.practice.findUnique({ where: { id: parsed.data.practiceId } });
    if (!practice) return reply.notFound('Praxis nicht gefunden');

    await fastify.prisma.userFavoritePractice.upsert({
      where: { userId_practiceId: { userId, practiceId: parsed.data.practiceId } },
      create: { userId, practiceId: parsed.data.practiceId },
      update: {},
    });

    return { ok: true };
  });

  fastify.delete('/auth/favorites/practices/:practiceId', async (request, reply) => {
    const userId = await resolveUserForFavorites(request, reply);
    if (!userId) return;

    const { practiceId } = request.params as { practiceId: string };

    await fastify.prisma.userFavoritePractice.deleteMany({
      where: { userId, practiceId },
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
    let user = await fastify.prisma.user.findUnique({ where: { email } });

    // Legacy: Therapist without a User row — create one now
    if (!user) {
      const legacyTherapist = await fastify.prisma.therapist.findUnique({ where: { email } });
      if (legacyTherapist?.passwordHash && !legacyTherapist.userId) {
        user = await fastify.prisma.user.create({
          data: { email, passwordHash: legacyTherapist.passwordHash, role: 'therapist' },
        });
        await fastify.prisma.therapist.update({
          where: { id: legacyTherapist.id },
          data: { userId: user.id },
        });
      }
    }

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

  // Browser landing page for reset-password link
  fastify.get('/auth/reset-password', async (request, reply) => {
    const { token } = request.query as { token?: string };
    reply.header('Content-Type', 'text/html; charset=utf-8');
    if (!token) return reply.code(400).send('<html><body>Token fehlt.</body></html>');

    const user = await fastify.prisma.user.findFirst({
      where: { passwordResetToken: token, passwordResetExpiresAt: { gt: new Date() } },
    });
    if (!user) {
      return reply.code(400).send(`
        <html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
          <h2>Link nicht mehr gültig</h2>
          <p>Bitte fordere einen neuen Link an.</p>
        </body></html>
      `);
    }

    return reply.send(`
      <html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px">
        <h2>Passwort zurücksetzen</h2>
        <p>Öffne die Revio-App, um dein Passwort zurückzusetzen.</p>
        <a href="revo://reset-password?token=${token}" style="display:inline-block;background:#3E6271;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:16px">App öffnen</a>
      </body></html>
    `);
  });

  // ── Change password (authenticated) ─────────────────────────────────────────
  fastify.patch('/auth/password', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein.'),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Ungültige Eingabe.';
      return reply.badRequest(msg);
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await fastify.prisma.user.findUnique({ where: { sessionToken: token } });
    if (!user || !user.passwordHash) return reply.unauthorized('Ungültiger Token');

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return reply.unauthorized('Aktuelles Passwort ist falsch.');

    const newHash = await hashPassword(newPassword);

    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, passwordResetToken: null, passwordResetExpiresAt: null },
    });

    if (user.role === 'therapist') {
      await fastify.prisma.therapist.updateMany({
        where: { userId: user.id },
        data: { passwordHash: newHash },
      });
    }

    return { ok: true };
  });
};
