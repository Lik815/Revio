import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword } from './auth.js';
import { sendEmailOtpEmail } from '../utils/mailer.js';
import { getEnv } from '../env.js';
import type { LocationPrecision } from '@revio/shared';
import {
  buildComplianceUpdateData,
  COMPLIANCE_STATUS_VALUES,
  HEALTH_AUTHORITY_STATUS_VALUES,
} from '../utils/compliance.js';
import { geocodeAddress, geocodeTherapistLocation, normalizeLocationPrecision } from '../utils/geocode.js';

const complianceSchema = z.object({
  taxRegistrationStatus: z.enum(COMPLIANCE_STATUS_VALUES).optional(),
  healthAuthorityStatus: z.enum(HEALTH_AUTHORITY_STATUS_VALUES).optional(),
});

const locationPrecisionSchema = z.enum(['exact', 'approximate'] satisfies [LocationPrecision, ...LocationPrecision[]]);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  fullName: z.string().min(2),
  city: z.string().optional(),
  postalCode: z.string().trim().regex(/^\d{5}$/).optional(),
  street: z.string().trim().min(2).optional(),
  houseNumber: z.string().trim().min(1).optional(),
  locationPrecision: locationPrecisionSchema.optional(),
  specializations: z.array(z.string()).default([]),
  languages: z.array(z.string()).min(1),
  certifications: z.array(z.string()).default([]),
  homeVisit: z.boolean().optional(),
  serviceRadiusKm: z.number().min(1).max(200).nullable().optional(),
  kassenart: z.string().optional(),
  availability: z.string().optional(),
  gender: z.enum(['female', 'male']).nullable().optional(),
  practice: z.object({
    name: z.string().min(1),
    city: z.string().min(1),
    address: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  compliance: complianceSchema.optional(),
});

const getPublicApiBaseUrl = (request: Record<string, any>) => {
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

export const registerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register/therapist', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const fieldMsgs = Object.entries(flat.fieldErrors)
        .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
        .join('; ');
      return reply.badRequest(fieldMsgs || flat.formErrors.join('; ') || 'Ungültige Eingabe');
    }

    const data = parsed.data;

    const existing = await fastify.prisma.therapist.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      return reply.conflict('A therapist with this email already exists.');
    }
    const existingUser = await fastify.prisma.user.findUnique({
      where: { email: data.email },
    });
    // Allow if the user was created by OTP flow (verified, no therapist yet)
    if (existingUser && existingUser.role === 'therapist' && !existingUser.emailVerifiedAt) {
      return reply.conflict('A user with this email already exists.');
    }
    if (existingUser && existingUser.role !== 'therapist') {
      return reply.conflict('A user with this email already exists.');
    }

    const passwordHash = data.password ? await hashPassword(data.password) : undefined;
    const therapistLocation = await geocodeTherapistLocation({
      city: data.city,
      postalCode: data.postalCode,
      street: data.street,
      houseNumber: data.houseNumber,
      locationPrecision: data.locationPrecision,
    });

    let user;
    if (existingUser?.emailVerifiedAt) {
      // Reuse the OTP-verified user record, just set the password
      user = await (fastify.prisma as any).user.update({
        where: { email: data.email },
        data: { passwordHash, requiresEmailVerification: false },
      });
    } else {
      user = await fastify.prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: 'therapist',
          emailVerifiedAt: new Date(),
          requiresEmailVerification: false,
        },
      });
    }

    const therapist = await fastify.prisma.therapist.create({
      data: {
        email: data.email,
        userId: user.id,
        fullName: data.fullName,
        professionalTitle: 'Physiotherapeut/in',
        city: data.city ?? '',
        postalCode: data.postalCode ?? null,
        street: data.street ?? null,
        houseNumber: data.houseNumber ?? null,
        locationPrecision: normalizeLocationPrecision(data.locationPrecision),
        specializations: data.specializations.join(', '),
        languages: data.languages.join(', '),
        certifications: data.certifications.join(', '),
        homeVisit: data.homeVisit ?? false,
        isFreelancer: true,
        serviceRadiusKm: data.serviceRadiusKm ?? null,
        latitude: therapistLocation.exactCoords?.lat ?? null,
        longitude: therapistLocation.exactCoords?.lng ?? null,
        homeLat: therapistLocation.publicCoords?.lat ?? 0,
        homeLng: therapistLocation.publicCoords?.lng ?? 0,
        kassenart: data.kassenart ?? '',
        gender: data.gender ?? null,
        availability: data.availability ?? '',
        ...buildComplianceUpdateData(data.compliance ?? {}),
        passwordHash,
        reviewStatus: 'PENDING_REVIEW',
      } as any,
    });

    // Create practice + link if provided
    if (data.practice) {
      const coords = await geocodeAddress(data.practice.address ?? '', data.practice.city);
      const practice = await fastify.prisma.practice.create({
        data: {
          name: data.practice.name,
          city: data.practice.city,
          address: data.practice.address ?? '',
          phone: data.practice.phone ?? null,
          lat: coords?.lat ?? 0,
          lng: coords?.lng ?? 0,
          reviewStatus: 'PENDING_REVIEW',
        },
      });
      await (fastify.prisma as any).therapistPracticeLink.create({
        data: {
          therapistId: therapist.id,
          practiceId: practice.id,
          status: 'PROPOSED',
        },
      });
    }

    return reply.status(201).send({
      therapistId: therapist.id,
      message: 'Registration submitted. Awaiting admin review.',
      requiresEmailVerification: false,
    });
  });

  // ── POST /register/send-otp ───────────────────────────────────────────────
  // Sends a 6-digit OTP to verify the email before registration continues.
  // Creates a temporary User record (no therapist yet) or reuses one if the
  // email already has a pending OTP user.
  fastify.post('/register/send-otp', async (request, reply) => {
    const parsed = z.object({ email: z.string().email() }).safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige E-Mail-Adresse.');

    const { email } = parsed.data;

    // Block if email already has a fully registered therapist
    const existing = await (fastify.prisma as any).user.findUnique({ where: { email } });
    if (existing && existing.emailVerifiedAt && existing.role === 'therapist') {
      return reply.status(409).send({ message: 'Diese E-Mail-Adresse ist bereits registriert.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (existing) {
      await (fastify.prisma as any).user.update({
        where: { email },
        data: { emailOtpCode: code, emailOtpExpiresAt: expiresAt },
      });
    } else {
      await (fastify.prisma as any).user.create({
        data: {
          email,
          role: 'therapist',
          emailOtpCode: code,
          emailOtpExpiresAt: expiresAt,
          requiresEmailVerification: true,
        },
      });
    }

    const env = getEnv();
    if (env.RESEND_API_KEY) {
      await sendEmailOtpEmail({ to: email, code });
    } else {
      fastify.log.warn(`[dev] Email OTP for ${email}: ${code}`);
    }

    return reply.send({ message: 'Code gesendet.' });
  });

  // ── POST /register/confirm-otp ────────────────────────────────────────────
  // Verifies the OTP. On success marks email as verified so registration can continue.
  fastify.post('/register/confirm-otp', async (request, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      code: z.string().length(6),
    }).safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabe.');

    const { email, code } = parsed.data;
    const user = await (fastify.prisma as any).user.findUnique({ where: { email } });

    if (!user || !user.emailOtpCode) return reply.status(400).send({ message: 'Kein Code angefordert.' });
    if (new Date() > new Date(user.emailOtpExpiresAt)) return reply.status(400).send({ message: 'Der Code ist abgelaufen. Bitte neuen Code anfordern.' });
    if (user.emailOtpCode !== code) return reply.status(400).send({ message: 'Falscher Code. Bitte erneut versuchen.' });

    await (fastify.prisma as any).user.update({
      where: { email },
      data: { emailOtpCode: null, emailOtpExpiresAt: null, emailVerifiedAt: new Date() },
    });

    return reply.send({ verified: true });
  });
};
