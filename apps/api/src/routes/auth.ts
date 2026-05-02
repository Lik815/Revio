import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import type { LocationPrecision } from '@revio/shared';
import { hashPassword, verifyPassword, getToken } from './auth-utils.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';
import type { JwtPayload } from '../plugins/jwt.js';
import {
  getProfileStatus,
  getTherapistProfileCompletion,
  getTherapistPublicationState,
} from '../utils/profile-completeness.js';
import {
  buildComplianceUpdateData,
  COMPLIANCE_STATUS_VALUES,
  getTherapistCompliance,
  HEALTH_AUTHORITY_STATUS_VALUES,
} from '../utils/compliance.js';
import {
  geocodeAddress,
  geocodeTherapistLocation,
  normalizeLocationPrecision,
} from '../utils/geocode.js';

export { hashPassword, verifyPassword, getToken };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(6),
});

const locationPrecisionSchema = z.enum(['exact', 'approximate'] satisfies [LocationPrecision, ...LocationPrecision[]]);
const PASSWORD_RESET_WINDOW_MS = 2 * 60 * 60 * 1000;

const updateMeSchema = z.object({
  fullName: z.string().min(2).optional(),
  professionalTitle: z.string().min(2).optional(),
  bio: z.string().optional(),
  city: z.string().min(2).optional(),
  postalCode: z.string().trim().regex(/^\d{5}$/).nullable().optional(),
  street: z.string().trim().min(2).nullable().optional(),
  houseNumber: z.string().trim().min(1).nullable().optional(),
  locationPrecision: locationPrecisionSchema.optional(),
  homeVisit: z.boolean().optional(),
  serviceRadiusKm: z.number().min(1).max(200).nullable().optional(),
  isVisible: z.boolean().optional(),
  availability: z.string().optional(),
  kassenart: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  photo: z.string().optional(),
  gender: z.enum(['female', 'male']).nullable().optional(),
});

const updateComplianceSchema = z.object({
  taxRegistrationStatus: z.enum(COMPLIANCE_STATUS_VALUES).nullable().optional(),
  healthAuthorityStatus: z.enum(HEALTH_AUTHORITY_STATUS_VALUES).nullable().optional(),
}).refine(
  (value) =>
    Object.prototype.hasOwnProperty.call(value, 'taxRegistrationStatus') ||
    Object.prototype.hasOwnProperty.call(value, 'healthAuthorityStatus'),
  { message: 'Mindestens ein Compliance-Feld ist erforderlich.' },
);

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

const serializeCompliance = (therapist: Record<string, any>) => {
  const compliance = getTherapistCompliance(therapist);

  return {
    taxRegistrationStatus: compliance.taxRegistrationStatus ?? null,
    healthAuthorityStatus: compliance.healthAuthorityStatus ?? null,
    updatedAt: compliance.updatedAt ? compliance.updatedAt.toISOString() : null,
  };
};

const getForgotPasswordResponse = () => ({
  success: true,
  message: 'Wenn ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt.',
});

const getPublicBaseUrl = (request: Record<string, any>) => {
  const forwardedProto = typeof request.headers?.['x-forwarded-proto'] === 'string'
    ? request.headers['x-forwarded-proto'].split(',')[0]?.trim()
    : '';
  const forwardedHost = typeof request.headers?.['x-forwarded-host'] === 'string'
    ? request.headers['x-forwarded-host'].split(',')[0]?.trim()
    : '';
  const host = forwardedHost || request.headers?.host || 'api.my-revio.de';
  const protocol = forwardedProto || (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
  return `${protocol}://${host}`;
};

const getPasswordResetName = (account: {
  user: Record<string, any>;
  therapist: Record<string, any> | null;
}) => account.therapist?.fullName || account.user.email;

const renderPasswordResetHtml = (opts: {
  token?: string;
  error?: string;
}) => {
  if (opts.error) {
    return `
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Revio Passwort zurücksetzen</title>
        </head>
        <body style="margin:0;background:#f5f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c2b33">
          <div style="max-width:420px;margin:48px auto;padding:0 18px">
            <div style="background:#fff;border-radius:20px;padding:32px 24px;box-shadow:0 10px 30px rgba(28,43,51,0.08)">
              <div style="font-size:40px;margin-bottom:12px">🔒</div>
              <h1 style="font-size:26px;line-height:1.2;margin:0 0 12px">Link nicht mehr gültig</h1>
              <p style="color:#6b838e;line-height:1.6;margin:0 0 24px">${opts.error}</p>
              <a href="revo://login" style="display:inline-block;background:#3e6271;color:#fff;padding:14px 20px;border-radius:12px;text-decoration:none;font-weight:600">
                Revio-App öffnen
              </a>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  const token = JSON.stringify(opts.token ?? '');
  return `
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Revio Passwort zurücksetzen</title>
      </head>
      <body style="margin:0;background:#f5f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c2b33">
        <div style="max-width:420px;margin:48px auto;padding:0 18px">
          <div id="card" style="background:#fff;border-radius:20px;padding:32px 24px;box-shadow:0 10px 30px rgba(28,43,51,0.08)">
            <div style="font-size:40px;margin-bottom:12px">🔐</div>
            <h1 style="font-size:26px;line-height:1.2;margin:0 0 12px">Neues Passwort festlegen</h1>
            <p style="color:#6b838e;line-height:1.6;margin:0 0 24px">Lege ein neues Passwort für dein Revio-Konto fest. Danach kannst du dich wieder in der App anmelden.</p>
            <form id="reset-form" style="display:flex;flex-direction:column;gap:14px">
              <input id="password" type="password" autocomplete="new-password" minlength="6" required placeholder="Neues Passwort" style="border:1px solid #d4dee3;border-radius:12px;padding:14px 16px;font-size:16px">
              <input id="confirmPassword" type="password" autocomplete="new-password" minlength="6" required placeholder="Passwort wiederholen" style="border:1px solid #d4dee3;border-radius:12px;padding:14px 16px;font-size:16px">
              <button id="submitBtn" type="submit" style="border:none;background:#3e6271;color:#fff;padding:14px 18px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer">
                Passwort zurücksetzen
              </button>
            </form>
            <p id="status" style="min-height:20px;color:#b94040;font-size:14px;margin:14px 0 0"></p>
          </div>
        </div>
        <script>
          const token = ${token};
          const form = document.getElementById('reset-form');
          const passwordInput = document.getElementById('password');
          const confirmInput = document.getElementById('confirmPassword');
          const submitBtn = document.getElementById('submitBtn');
          const status = document.getElementById('status');
          const card = document.getElementById('card');

          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            status.textContent = '';

            if (passwordInput.value.length < 6) {
              status.textContent = 'Das Passwort muss mindestens 6 Zeichen lang sein.';
              return;
            }

            if (passwordInput.value !== confirmInput.value) {
              status.textContent = 'Die Passwörter stimmen nicht überein.';
              return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Speichern…';

            try {
              const response = await fetch('/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password: passwordInput.value }),
              });
              const data = await response.json().catch(() => ({}));

              if (!response.ok) {
                status.textContent = data.message || 'Der Link ist ungültig oder abgelaufen.';
                return;
              }

              card.innerHTML = \`
                <div style="font-size:40px;margin-bottom:12px">✅</div>
                <h1 style="font-size:26px;line-height:1.2;margin:0 0 12px">Passwort aktualisiert</h1>
                <p style="color:#6b838e;line-height:1.6;margin:0 0 24px">Dein Passwort wurde erfolgreich geändert. Du kannst dich jetzt wieder in der Revio-App anmelden.</p>
                <a href="revo://login" style="display:inline-block;background:#3e6271;color:#fff;padding:14px 20px;border-radius:12px;text-decoration:none;font-weight:600">
                  Revio-App öffnen
                </a>
              \`;
            } catch (error) {
              status.textContent = 'Verbindungsfehler. Bitte versuche es erneut.';
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Passwort zurücksetzen';
            }
          });
        </script>
      </body>
    </html>
  `;
};

const ensurePasswordResetAccount = async (fastify: Record<string, any>, email: string) => {
  const prisma = fastify.prisma;
  const user = await prisma.user.findUnique({
    where: { email },
    include: { therapistProfile: true },
  });

  if (user) {
    let therapist = user.therapistProfile
      ?? await prisma.therapist.findFirst({ where: { OR: [{ userId: user.id }, { email }] } });

    if (therapist && therapist.userId !== user.id) {
      therapist = await prisma.therapist.update({
        where: { id: therapist.id },
        data: { userId: user.id },
      });
    }

    if (!therapist) {
      return null;
    }

    if (!(user.passwordHash || therapist.passwordHash)) {
      return null;
    }

    return { user, therapist };
  }

  const legacyTherapist = await prisma.therapist.findUnique({ where: { email } });
  if (legacyTherapist?.passwordHash) {
    const ensuredUser = await prisma.user.create({
      data: {
        email,
        passwordHash: legacyTherapist.passwordHash,
        role: 'therapist',
      },
    });

    const therapist = await prisma.therapist.update({
      where: { id: legacyTherapist.id },
      data: { userId: ensuredUser.id },
    });

    return { user: ensuredUser, therapist };
  }

  return null;
};

const syncPasswordReset = async (
  fastify: Record<string, any>,
  user: Record<string, any>,
  passwordHash: string,
) => {
  await fastify.prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      sessionToken: null,
    },
  });

  if (user.role === 'therapist') {
    await fastify.prisma.therapist.updateMany({
      where: {
        OR: [
          { userId: user.id },
          { email: user.email },
        ],
      },
      data: {
        passwordHash,
        sessionToken: null,
      },
    });
  }
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/forgot-password', async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Bitte gib eine gültige E-Mail-Adresse ein.');

    const email = parsed.data.email;
    const account = await ensurePasswordResetAccount(fastify, email);
    if (!account) {
      return reply.status(200).send(getForgotPasswordResponse());
    }

    const resetUser = await fastify.prisma.user.findUnique({
      where: { email: account.user.email },
    });
    if (!resetUser) {
      fastify.log.warn({ email }, 'Password reset requested for therapist account without a user row after ensure step');
      return reply.status(200).send(getForgotPasswordResponse());
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_WINDOW_MS);

    await fastify.prisma.user.update({
      where: { id: resetUser.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const resetLink = `${getPublicBaseUrl(request)}/auth/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await sendPasswordResetEmail({
        to: email,
        name: getPasswordResetName(account),
        resetLink,
      });
    } catch (err) {
      fastify.log.warn({ err, email }, 'Failed to send password reset email');
    }

    return reply.status(200).send(getForgotPasswordResponse());
  });

  fastify.get('/auth/reset-password', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) {
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return reply.code(400).send(renderPasswordResetHtml({
        error: 'Der Link ist unvollständig. Bitte fordere einen neuen Passwort-Link an.',
      }));
    }

    const user = await fastify.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    reply.header('Content-Type', 'text/html; charset=utf-8');
    if (!user) {
      return reply.code(400).send(renderPasswordResetHtml({
        error: 'Der Link ist ungültig oder bereits abgelaufen. Bitte fordere in der App einen neuen an.',
      }));
    }

    return reply.send(renderPasswordResetHtml({ token }));
  });

  fastify.post('/auth/reset-password', async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Bitte gib ein neues Passwort mit mindestens 6 Zeichen ein.');

    const { token, password } = parsed.data;
    const user = await fastify.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });
    if (!user) return reply.badRequest('Der Link ist ungültig oder abgelaufen.');

    const passwordHash = await hashPassword(password);
    await syncPasswordReset(fastify, user, passwordHash);

    return reply.status(200).send({
      success: true,
      message: 'Dein Passwort wurde aktualisiert.',
    });
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

  fastify.get('/auth/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    let therapist = null as any;

    // Detect JWT (starts with 'eyJ') vs legacy session token
    if (token.startsWith('eyJ')) {
      let payload: JwtPayload;
      try {
        payload = fastify.jwtVerify(token);
      } catch {
        return reply.unauthorized('Ungültiger Token');
      }
      // JWT belongs to a UserV2 — load therapist by userId
      const v2User = await (fastify.prisma as any).userV2.findUnique({ where: { id: payload.sub } });
      if (!v2User) return reply.unauthorized('Ungültiger Token');

      if (v2User.role === 'patient') {
        const profile = await (fastify.prisma as any).patientProfile.findUnique({ where: { userId: v2User.id } });
        return reply.send({
          id: v2User.id,
          email: v2User.email,
          role: 'patient',
          firstName: profile?.firstName ?? '',
          lastName: profile?.lastName ?? '',
          fullName: `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim(),
        });
      }

      // Therapist V2: load matching legacy Therapist row by email
      therapist = await fastify.prisma.therapist.findUnique({
        where: { email: v2User.email },
        include: {
          links: {
            where: { status: 'CONFIRMED' },
            include: { practice: true },
          },
        },
      });
      if (!therapist) return reply.unauthorized('Therapeuten-Profil nicht gefunden');
    } else {
      // Legacy session token path
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
      postalCode: therapist.postalCode ?? null,
      street: therapist.street ?? null,
      houseNumber: therapist.houseNumber ?? null,
      locationPrecision: (therapist as any).locationPrecision ?? 'approximate',
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
      compliance: serializeCompliance(therapist),
      profileStatus: getProfileStatus(therapist),
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
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const parsed = updateMeSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const data = parsed.data;
    const updateData: Record<string, any> = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.professionalTitle !== undefined) updateData.professionalTitle = data.professionalTitle;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode ?? null;
    if (data.street !== undefined) updateData.street = data.street ?? null;
    if (data.houseNumber !== undefined) updateData.houseNumber = data.houseNumber ?? null;
    if (data.locationPrecision !== undefined) updateData.locationPrecision = normalizeLocationPrecision(data.locationPrecision);
    if (data.homeVisit !== undefined) updateData.homeVisit = data.homeVisit;
    if (data.serviceRadiusKm !== undefined) updateData.serviceRadiusKm = data.serviceRadiusKm;
    // Only approved therapists can change their visibility
    if (data.isVisible !== undefined && therapist.reviewStatus === 'APPROVED') updateData.isVisible = data.isVisible;
    if (data.availability !== undefined) updateData.availability = data.availability;
    if (data.kassenart !== undefined) updateData.kassenart = data.kassenart;
    if (data.specializations !== undefined) updateData.specializations = data.specializations.join(', ');
    if (data.languages !== undefined) updateData.languages = data.languages.join(', ');
    if (data.certifications !== undefined) updateData.certifications = data.certifications.join(', ');
    if (data.photo !== undefined) updateData.photo = data.photo;
    if (data.gender !== undefined) updateData.gender = data.gender;

    if (data.city !== undefined) updateData.city = data.city;

    const locationChanged =
      data.city !== undefined ||
      data.postalCode !== undefined ||
      data.street !== undefined ||
      data.houseNumber !== undefined ||
      data.locationPrecision !== undefined;

    if (locationChanged) {
      const nextLocation = {
        city: data.city ?? therapist.city,
        postalCode: data.postalCode !== undefined ? data.postalCode : (therapist as any).postalCode,
        street: data.street !== undefined ? data.street : (therapist as any).street,
        houseNumber: data.houseNumber !== undefined ? data.houseNumber : (therapist as any).houseNumber,
        locationPrecision: data.locationPrecision ?? (therapist as any).locationPrecision,
      };
      const coords = await geocodeTherapistLocation(nextLocation);
      updateData.locationPrecision = coords.locationPrecision;
      updateData.latitude = coords.exactCoords?.lat ?? null;
      updateData.longitude = coords.exactCoords?.lng ?? null;
      updateData.homeLat = coords.publicCoords?.lat ?? 0;
      updateData.homeLng = coords.publicCoords?.lng ?? 0;
    } else if ((therapist as any).latitude == null && (therapist as any).longitude == null && therapist.city) {
      // Legacy backfill for older therapists that only stored city/homeLat/homeLng
      const coords = await geocodeAddress('', therapist.city, (therapist as any).postalCode ?? undefined);
      if (coords) {
        updateData.latitude = coords.lat;
        updateData.longitude = coords.lng;
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
      city: updated.city,
      postalCode: (updated as any).postalCode ?? null,
      street: (updated as any).street ?? null,
      houseNumber: (updated as any).houseNumber ?? null,
      locationPrecision: (updated as any).locationPrecision ?? 'approximate',
      isPublished: updated.isPublished,
      compliance: serializeCompliance(updated),
      profileStatus: getProfileStatus(updated),
      ...publication,
    };
  });

  fastify.patch('/auth/me/compliance', async (request, reply) => {
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

    const parsed = updateComplianceSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    await fastify.prisma.therapist.update({
      where: { id: therapist.id },
      data: buildComplianceUpdateData(parsed.data),
    });

    const updated = await fastify.prisma.therapist.findUnique({
      where: { id: therapist.id },
    });
    if (!updated) return reply.notFound('Therapeuten-Profil nicht gefunden');

    return {
      success: true,
      compliance: serializeCompliance(updated),
      profileStatus: getProfileStatus(updated),
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

  fastify.patch('/auth/push-token', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');
    const { expoPushToken } = z.object({ expoPushToken: z.string() }).parse(request.body);
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

};
