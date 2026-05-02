import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword } from './auth.js';
import { geocodeAddress } from '../utils/geocode.js';
import { sendEmailOtpEmail } from '../utils/mailer.js';
import { sha256 } from '../utils/hash.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  fullName: z.string().min(2),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  street: z.string().optional(),
  houseNumber: z.string().optional(),
  locationPrecision: z.string().optional(),
  gender: z.string().optional(),
  compliance: z.object({
    taxRegistrationStatus: z.string().nullable().optional(),
    healthAuthorityStatus: z.string().nullable().optional(),
  }).optional(),
  specializations: z.array(z.string()).default([]),
  languages: z.array(z.string()).min(1),
  certifications: z.array(z.string()).default([]),
  homeVisit: z.boolean().optional(),
  serviceRadiusKm: z.number().min(1).max(200).nullable().optional(),
  kassenart: z.string().optional(),
  availability: z.string().optional(),
  practice: z.object({
    name: z.string().min(1),
    city: z.string().min(1),
    address: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
});

export const registerRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /register/send-otp ────────────────────────────────────────────────
  fastify.post('/register/send-otp', {
    config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = z.object({ email: z.string().email() }).safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige E-Mail-Adresse.');

    const email = parsed.data.email.trim().toLowerCase();

    const existingTherapist = await fastify.prisma.therapist.findUnique({ where: { email } });
    if (existingTherapist) return reply.conflict('Diese E-Mail-Adresse ist bereits registriert.');
    const existingUser = await fastify.prisma.user.findUnique({ where: { email } });
    if (existingUser) return reply.conflict('Diese E-Mail-Adresse ist bereits registriert.');

    // DB-level rate limit: max 3 sends per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await fastify.prisma.emailOtp.count({
      where: { email, createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= 3) {
      return reply.tooManyRequests('Zu viele Anfragen. Bitte warte eine Stunde.');
    }

    // Clear old unconfirmed OTPs for this email
    await fastify.prisma.emailOtp.deleteMany({ where: { email, verifiedAt: null } });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await fastify.prisma.emailOtp.create({ data: { email, codeHash, expiresAt } });

    if (!process.env.RESEND_API_KEY) {
      console.log(`[DEV] OTP for ${email}: ${code}`);
    } else {
      await sendEmailOtpEmail({ to: email, code });
    }

    return reply.send({ ok: true });
  });

  // ── POST /register/confirm-otp ─────────────────────────────────────────────
  fastify.post('/register/confirm-otp', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      code: z.string().length(6),
    }).safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabe.');

    const email = parsed.data.email.trim().toLowerCase();
    const codeHash = sha256(parsed.data.code);
    const now = new Date();

    const otp = await fastify.prisma.emailOtp.findFirst({
      where: { email, verifiedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });

    // Same error for "not found" and "wrong code" — prevents email enumeration
    if (!otp || otp.codeHash !== codeHash) {
      return reply.badRequest('Ungültiger oder abgelaufener Code.');
    }

    await fastify.prisma.emailOtp.update({
      where: { id: otp.id },
      data: { verifiedAt: now },
    });

    return reply.send({ ok: true });
  });

  // ── POST /register/therapist ───────────────────────────────────────────────
  fastify.post('/register/therapist', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const fieldMsgs = Object.entries(flat.fieldErrors)
        .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
        .join('; ');
      return reply.badRequest(fieldMsgs || flat.formErrors.join('; ') || 'Ungültige Eingabe');
    }

    const data = {
      ...parsed.data,
      email: parsed.data.email.trim().toLowerCase(),
    };

    const existing = await fastify.prisma.therapist.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      return reply.conflict('A therapist with this email already exists.');
    }
    const existingUser = await fastify.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      return reply.conflict('A user with this email already exists.');
    }

    // Require a confirmed OTP — 2-hour window measured from verifiedAt
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const confirmedOtp = await fastify.prisma.emailOtp.findFirst({
      where: {
        email: data.email,
        verifiedAt: { not: null, gte: twoHoursAgo },
      },
      orderBy: { verifiedAt: 'desc' },
    });
    if (!confirmedOtp) {
      return reply.badRequest('E-Mail-Adresse nicht bestätigt. Bitte starte die Registrierung erneut.');
    }

    const passwordHash = data.password ? await hashPassword(data.password) : undefined;

    // Geocode therapist's own address (best-effort, never blocks registration)
    const streetPart = [data.street, data.houseNumber].filter(Boolean).join(' ');
    const cityPart = [data.postalCode, data.city].filter(Boolean).join(' ');
    const coords = (data.street && data.city)
      ? await geocodeAddress(streetPart, cityPart)
      : null;

    const sessionToken = randomBytes(32).toString('hex');

    const { therapist } = await (fastify.prisma as any).$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: 'therapist',
          emailVerifiedAt: confirmedOtp.verifiedAt,
          requiresEmailVerification: false,
          sessionToken,
        },
      });

      const therapist = await tx.therapist.create({
        data: {
          email: data.email,
          userId: user.id,
          fullName: data.fullName,
          professionalTitle: 'Physiotherapeut/in',
          city: data.city ?? '',
          postalCode: data.postalCode ?? null,
          street: data.street ?? null,
          houseNumber: data.houseNumber ?? null,
          locationPrecision: data.locationPrecision ?? 'approximate',
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          gender: data.gender ?? null,
          specializations: data.specializations.join(', '),
          languages: data.languages.join(', '),
          certifications: data.certifications.join(', '),
          homeVisit: data.homeVisit ?? false,
          isFreelancer: true,
          serviceRadiusKm: data.serviceRadiusKm ?? null,
          kassenart: data.kassenart ?? '',
          availability: data.availability ?? '',
          passwordHash,
          reviewStatus: 'PENDING_REVIEW',
          sessionToken,
          ...(data.compliance?.taxRegistrationStatus !== undefined && {
            taxRegistrationStatus: data.compliance.taxRegistrationStatus,
          }),
          ...(data.compliance?.healthAuthorityStatus !== undefined && {
            healthAuthorityStatus: data.compliance.healthAuthorityStatus,
          }),
          ...(data.compliance && { complianceUpdatedAt: new Date() }),
        },
      });

      if (data.practice) {
        const practiceCoords = await geocodeAddress(
          data.practice.address ?? '',
          data.practice.city,
        );
        const practice = await tx.practice.create({
          data: {
            name: data.practice.name,
            city: data.practice.city,
            address: data.practice.address ?? '',
            phone: data.practice.phone ?? null,
            lat: practiceCoords?.lat ?? 0,
            lng: practiceCoords?.lng ?? 0,
            reviewStatus: 'PENDING_REVIEW',
          },
        });
        await tx.therapistPracticeLink.create({
          data: { therapistId: therapist.id, practiceId: practice.id, status: 'PROPOSED' },
        });
      }

      await tx.emailOtp.delete({ where: { id: confirmedOtp.id } });

      return { user, therapist };
    });

    return reply.status(201).send({
      therapistId: therapist.id,
      message: 'Registration submitted. Your profile will be reviewed by an admin before it appears in search.',
      token: sessionToken,
    });
  });
};
