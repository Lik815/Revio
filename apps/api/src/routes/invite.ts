import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword } from './auth-utils.js';
import { getToken } from './auth-utils.js';
import { sendInviteEmail, sendReinviteEmail } from '../utils/mailer.js';
import { getTherapistProfileCompletion } from '../utils/profile-completeness.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getPracticeByToken(fastify: any, token: string | null) {
  if (!token) return null;
  const manager = await fastify.prisma.practiceManager.findUnique({
    where: { sessionToken: token },
    include: {
      assignments: {
        include: { practice: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });
  if (!manager) return null;
  if (manager.assignments[0]?.practice) return manager.assignments[0].practice;
  if (manager.practiceId) {
    return fastify.prisma.practice.findUnique({ where: { id: manager.practiceId } });
  }
  return null;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const inviteRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /invite/therapist — Practice manager creates a therapist profile + invitation
  fastify.post('/invite/therapist', async (request, reply) => {
    const token = getToken(request);
    const practice = await getPracticeByToken(fastify, token);
    if (!practice) return reply.unauthorized('Ungültiger oder fehlender Praxis-Token');

    const schema = z.object({
      fullName: z.string().min(2),
      professionalTitle: z.string().min(2),
      email: z.string().email(),
      specializations: z.array(z.string()).optional().default([]),
      languages: z.array(z.string()).optional().default([]),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { fullName, professionalTitle, email, specializations, languages } = parsed.data;

    // Check if a therapist with this email already exists
    const existing = await fastify.prisma.therapist.findUnique({ where: { email } });
    if (existing) return reply.conflict('Ein Therapeut mit dieser E-Mail-Adresse existiert bereits.');
    const existingUser = await fastify.prisma.user.findUnique({ where: { email } });
    if (existingUser) return reply.conflict('Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.');

    const isDev = process.env.NODE_ENV !== 'production';
    const reviewStatus = isDev ? 'APPROVED' : 'PENDING_REVIEW';

    // Create the therapist record with invited status
    const therapist = await fastify.prisma.therapist.create({
      data: {
        email,
        fullName,
        professionalTitle,
        city: practice.city,
        specializations: specializations.join(', '),
        languages: languages.join(', '),
        reviewStatus,
        onboardingStatus: 'invited',
        visibilityPreference: 'hidden',
        isPublished: false,
        invitedByPracticeId: practice.id,
      },
    });

    // Link therapist to practice as CONFIRMED
    await fastify.prisma.therapistPracticeLink.create({
      data: {
        therapistId: therapist.id,
        practiceId: practice.id,
        status: 'CONFIRMED',
        initiatedBy: 'ADMIN',
      } as any,
    });

    // Create invitation token, expires in 7 days
    const inviteToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await fastify.prisma.invitation.create({
      data: {
        token: inviteToken,
        therapistId: therapist.id,
        practiceId: practice.id,
        email,
        expiresAt,
      },
    });

    const baseUrl = process.env.MOBILE_URL ?? 'https://my-revio.de';
    const inviteLink = `${baseUrl}/invite?token=${inviteToken}`;

    // Send invitation email (best-effort — don't fail the request if mail fails)
    try {
      await sendInviteEmail({
        to: email,
        therapistName: fullName,
        practiceName: practice.name,
        inviteLink,
      });
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to send invite email');
    }

    return reply.status(201).send({
      therapistId: therapist.id,
      inviteToken,
      inviteLink,
    });
  });

  // GET /invite/validate?token=<token> — Validate invite token
  fastify.get('/invite/validate', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.badRequest('Token fehlt');

    const invitation = await fastify.prisma.invitation.findUnique({
      where: { token },
      include: {
        therapist: {
          select: {
            id: true,
            fullName: true,
            professionalTitle: true,
            email: true,
            onboardingStatus: true,
          },
        },
        practice: {
          select: { id: true, name: true, city: true },
        },
      },
    });

    if (!invitation) return reply.badRequest('Ungültige Einladung');
    if (invitation.usedAt) return reply.badRequest('Diese Einladung wurde bereits verwendet');
    if (new Date() > invitation.expiresAt) return reply.badRequest('Diese Einladung ist abgelaufen');

    return {
      valid: true,
      therapist: invitation.therapist,
      practice: invitation.practice,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  });

  // POST /invite/claim — Therapist claims their profile
  fastify.post('/invite/claim', async (request, reply) => {
    const schema = z.object({
      token: z.string().min(1),
      password: z.string().min(6),
      fullName: z.string().min(2).optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { token, password, fullName } = parsed.data;

    const invitation = await fastify.prisma.invitation.findUnique({
      where: { token },
      include: { therapist: true },
    });

    if (!invitation) return reply.badRequest('Ungültige Einladung');
    if (invitation.usedAt) return reply.badRequest('Diese Einladung wurde bereits verwendet');
    if (new Date() > invitation.expiresAt) return reply.badRequest('Diese Einladung ist abgelaufen');

    const passwordHash = await hashPassword(password);
    const sessionToken = randomBytes(32).toString('hex');
    const now = new Date();

    // Mark invitation as used
    await fastify.prisma.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: now },
    });

    // Ensure user account exists (invite flow creates therapist first, then user on claim)
    const existingUser = await fastify.prisma.user.findUnique({
      where: { email: invitation.therapist.email },
    });
    const user = existingUser ?? await fastify.prisma.user.create({
      data: {
        email: invitation.therapist.email,
        role: 'therapist',
      },
    });

    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionToken },
    });

    // Update therapist
    const updateData: Record<string, any> = {
      passwordHash,
      sessionToken,
      onboardingStatus: 'claimed',
      userId: invitation.therapist.userId ?? user.id,
    };
    if (fullName) updateData.fullName = fullName;

    await fastify.prisma.therapist.update({
      where: { id: invitation.therapistId },
      data: updateData,
    });

    return {
      token: sessionToken,
      therapistId: invitation.therapistId,
      fullName: fullName ?? invitation.therapist.fullName,
    };
  });

  // PATCH /invite/visibility — Save visibility preference
  fastify.patch('/invite/visibility', async (request, reply) => {
    const bearerToken = getToken(request);
    if (!bearerToken) return reply.unauthorized('Kein Token');

    const user = await fastify.prisma.user.findUnique({
      where: { sessionToken: bearerToken },
      include: { therapistProfile: true },
    });
    const therapist = user?.therapistProfile ?? await fastify.prisma.therapist.findUnique({
      where: { sessionToken: bearerToken },
    });
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const schema = z.object({
      visibilityPreference: z.enum(['visible', 'hidden']),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { visibilityPreference } = parsed.data;
    const { complete, missingFields } = getTherapistProfileCompletion(therapist);
    const isPublished = visibilityPreference === 'visible' && complete;

    // Determine final onboarding status
    let onboardingStatus = therapist.onboardingStatus;
    if (isPublished) {
      onboardingStatus = 'complete';
    } else if (therapist.onboardingStatus === 'claimed' || therapist.onboardingStatus === 'invited') {
      onboardingStatus = 'claimed'; // stays claimed until complete
    }

    await fastify.prisma.therapist.update({
      where: { id: therapist.id },
      data: { visibilityPreference, isPublished, onboardingStatus },
    });

    return { isPublished, profileComplete: complete, missingFields };
  });

  // POST /invite/resend — Resend invitation (practice manager)
  fastify.post('/invite/resend', async (request, reply) => {
    const token = getToken(request);
    const practice = await getPracticeByToken(fastify, token);
    if (!practice) return reply.unauthorized('Ungültiger oder fehlender Praxis-Token');

    const schema = z.object({
      therapistId: z.string().min(1),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { therapistId } = parsed.data;

    // Check therapist belongs to this practice
    const link = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId, practiceId: practice.id } },
    });
    if (!link) return reply.notFound('Therapeut ist nicht mit dieser Praxis verknüpft');

    const therapist = await fastify.prisma.therapist.findUnique({ where: { id: therapistId } });
    if (!therapist) return reply.notFound('Therapeut nicht gefunden');

    // Invalidate old invitations
    await fastify.prisma.invitation.updateMany({
      where: {
        therapistId,
        practiceId: practice.id,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Create new invitation
    const inviteToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await fastify.prisma.invitation.create({
      data: {
        token: inviteToken,
        therapistId,
        practiceId: practice.id,
        email: therapist.email,
        expiresAt,
      },
    });

    const baseUrl = process.env.MOBILE_URL ?? 'https://my-revio.de';
    const inviteLink = `${baseUrl}/invite?token=${inviteToken}`;

    try {
      await sendReinviteEmail({
        to: therapist.email,
        therapistName: therapist.fullName,
        practiceName: practice.name,
        inviteLink,
      });
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to resend invite email');
    }

    return { inviteToken, inviteLink };
  });

  // GET /invite/status/:therapistId — Get onboarding status (practice manager)
  fastify.get('/invite/status/:therapistId', async (request, reply) => {
    const token = getToken(request);
    const practice = await getPracticeByToken(fastify, token);
    if (!practice) return reply.unauthorized('Ungültiger oder fehlender Praxis-Token');

    const { therapistId } = request.params as { therapistId: string };

    // Check therapist belongs to this practice
    const link = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId, practiceId: practice.id } },
    });
    if (!link) return reply.notFound('Therapeut ist nicht mit dieser Praxis verknüpft');

    const therapist = await fastify.prisma.therapist.findUnique({ where: { id: therapistId } });
    if (!therapist) return reply.notFound('Therapeut nicht gefunden');

    // Get latest invitation
    const latestInvitation = await fastify.prisma.invitation.findFirst({
      where: { therapistId, practiceId: practice.id },
      orderBy: { createdAt: 'desc' },
    });

    const invitationStatus = latestInvitation
      ? {
          id: latestInvitation.id,
          expiresAt: latestInvitation.expiresAt.toISOString(),
          usedAt: latestInvitation.usedAt?.toISOString() ?? null,
          expired: new Date() > latestInvitation.expiresAt,
          createdAt: latestInvitation.createdAt.toISOString(),
        }
      : null;

    return {
      therapistId,
      fullName: therapist.fullName,
      email: therapist.email,
      onboardingStatus: therapist.onboardingStatus,
      visibilityPreference: therapist.visibilityPreference,
      isPublished: therapist.isPublished,
      ...getTherapistProfileCompletion(therapist),
      invitation: invitationStatus,
    };
  });
};
