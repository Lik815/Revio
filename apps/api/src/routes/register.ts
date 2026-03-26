import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword } from './auth.js';
import { sendVerificationEmail } from '../utils/mailer.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  fullName: z.string().min(2),
  city: z.string().optional(),
  specializations: z.array(z.string()).default([]),
  languages: z.array(z.string()).min(1),
  certifications: z.array(z.string()).default([]),
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

    // In development, auto-approve so the profile immediately appears in search
    const isDev = process.env.NODE_ENV !== 'production';
    const reviewStatus = isDev ? 'APPROVED' : 'PENDING_REVIEW';

    const passwordHash = data.password ? await hashPassword(data.password) : undefined;

    // Email verification: skip in dev, require in prod
    const verificationToken = isDev ? null : randomBytes(32).toString('hex');

    const user = await fastify.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: 'therapist',
        emailVerificationToken: verificationToken,
        emailVerifiedAt: isDev ? new Date() : null,
        requiresEmailVerification: !isDev,
      },
    });

    await fastify.prisma.therapist.create({
      data: {
        email: data.email,
        userId: user.id,
        fullName: data.fullName,
        professionalTitle: 'Physiotherapeut/in',
        city: data.city ?? '',
        specializations: data.specializations.join(', '),
        languages: data.languages.join(', '),
        certifications: data.certifications.join(', '),
        passwordHash,
        reviewStatus,
      },
    });

    if (!isDev && verificationToken) {
      const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';
      const deepLink = `revo://verify?token=${verificationToken}`;
      const browserLink = `${apiBaseUrl}/auth/verify-email?token=${verificationToken}`;
      try {
        await sendVerificationEmail({
          to: data.email,
          name: data.fullName,
          verifyLink: deepLink,
          browserFallbackLink: browserLink,
        });
      } catch {
        fastify.log.warn(`Failed to send verification email to ${data.email}`);
      }
    }

    // In dev: generate a session token so the app can auto-login after registration
    let devToken: string | undefined;
    if (isDev) {
      devToken = randomBytes(32).toString('hex');
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { sessionToken: devToken },
      });
    }

    return reply.status(201).send({
      message: isDev
        ? 'Profile auto-approved (development mode). Visible in search immediately.'
        : 'Registration submitted. Please check your email to verify your account.',
      token: devToken,
    });
  });
};
