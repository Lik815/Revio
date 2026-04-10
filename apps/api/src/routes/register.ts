import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword } from './auth.js';
import type { LocationPrecision } from '@revio/shared';
import {
  buildComplianceUpdateData,
  COMPLIANCE_STATUS_VALUES,
  HEALTH_AUTHORITY_STATUS_VALUES,
} from '../utils/compliance.js';
import { geocodeAddress, geocodeTherapistLocation, normalizeLocationPrecision } from '../utils/geocode.js';
import { sendVerificationEmail } from '../utils/mailer.js';
import { getEnv } from '../env.js';

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
  practice: z.object({
    name: z.string().min(1),
    city: z.string().min(1),
    address: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  compliance: complianceSchema.optional(),
});

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
    if (existingUser) {
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

    const emailVerificationToken = randomBytes(32).toString('hex');

    const user = await fastify.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: 'therapist',
        emailVerifiedAt: null,
        requiresEmailVerification: true,
        emailVerificationToken,
      },
    });

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

    // Send verification email — if RESEND_API_KEY is missing, log the link for dev use
    const env = getEnv();
    const deepLink = `revo://verify?token=${emailVerificationToken}`;
    const browserLink = `${env.APP_URL}/auth/verify-email?token=${emailVerificationToken}`;

    if (env.RESEND_API_KEY) {
      await sendVerificationEmail({
        to: data.email,
        name: data.fullName,
        verifyLink: deepLink,
        browserFallbackLink: browserLink,
      });
    } else {
      fastify.log.warn(`[dev] Email verification link for ${data.email}: ${browserLink}`);
    }

    return reply.status(201).send({
      therapistId: therapist.id,
      message: 'Registration submitted. Please verify your email address.',
      requiresEmailVerification: true,
    });
  });
};
