import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { getToken } from './auth-utils.js';
import { geocodeAddress } from '../utils/geocode.js';
import { sendInviteEmail, sendReinviteEmail } from '../utils/mailer.js';

async function getAuthedTherapist(request: any, fastify: any) {
  const token = getToken(request);
  if (!token) return null;
  return fastify.prisma.therapist.findUnique({ where: { sessionToken: token } });
}

export const practiceRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /practice — create new practice, therapist becomes admin
  fastify.post('/practice', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const existing = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: therapist.id },
    });
    if (existing) return reply.conflict('Du bist bereits Admin einer Praxis');

    const schema = z.object({
      name: z.string().min(1),
      city: z.string().min(1),
      address: z.string().optional(),
      phone: z.string().optional(),
      hours: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const d = parsed.data;
    const geo = await geocodeAddress(d.address ?? '', d.city);

    const practice = await fastify.prisma.practice.create({
      data: {
        ...d,
        adminTherapistId: therapist.id,
        reviewStatus: process.env.NODE_ENV === 'production' ? 'PENDING_REVIEW' : 'APPROVED',
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
      },
    });

    // Auto-link the therapist to the practice as CONFIRMED
    await fastify.prisma.therapistPracticeLink.create({
      data: { therapistId: therapist.id, practiceId: practice.id, status: 'CONFIRMED' },
    });

    return reply.status(201).send({ practice });
  });

  // GET /practice/search?q=&city= — search approved practices
  fastify.get('/practice/search', async (request, reply) => {
    const { q = '', city = '' } = request.query as { q?: string; city?: string };
    const practices = await fastify.prisma.practice.findMany({
      where: {
        reviewStatus: 'APPROVED',
        ...(q ? {
          OR: [
            { name: { contains: q } },
            { city: { contains: q } },
            { address: { contains: q } },
          ],
        } : {}),
        ...(city ? { city: { contains: city } } : {}),
      },
      include: {
        links: {
          where: { status: 'CONFIRMED' },
          include: {
            therapist: { select: { id: true, fullName: true, professionalTitle: true } },
          },
        },
      },
      take: 20,
      orderBy: { name: 'asc' },
    });
    return { practices };
  });

  // POST /practice/:id/connect — send connection request to a practice
  fastify.post('/practice/:id/connect', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const { id: practiceId } = request.params as { id: string };
    const practice = await fastify.prisma.practice.findUnique({ where: { id: practiceId } });
    if (!practice || practice.reviewStatus !== 'APPROVED') {
      return reply.notFound('Praxis nicht gefunden');
    }

    const existingLink = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId: therapist.id, practiceId } },
    });
    if (existingLink) return reply.conflict('Anfrage bereits gesendet oder bereits verbunden');

    const link = await fastify.prisma.therapistPracticeLink.create({
      data: { therapistId: therapist.id, practiceId, status: 'PROPOSED' },
    });
    return reply.status(201).send({ link });
  });

  // GET /my/practice — get the practice this therapist admins (full detail)
  fastify.get('/my/practice', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: therapist.id },
      include: {
        links: {
          include: {
            therapist: {
              select: {
                id: true,
                fullName: true,
                professionalTitle: true,
                photo: true,
                specializations: true,
                email: true,
                onboardingStatus: true,
                isPublished: true,
                invitedByPracticeId: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!practice) return reply.notFound('Keine eigene Praxis');
    return { practice };
  });

  // PATCH /my/practice — update practice info (admin only)
  fastify.patch('/my/practice', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: therapist.id },
    });
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    const schema = z.object({
      name: z.string().min(1).optional(),
      city: z.string().min(1).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      hours: z.string().optional(),
      description: z.string().optional(),
      logo: z.string().optional(),
      photos: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const d = parsed.data;

    // Re-geocode if address or city changed
    const needsGeocode = d.address !== undefined || d.city !== undefined;
    let geoUpdate = {};
    if (needsGeocode) {
      const newAddress = d.address ?? practice.address ?? '';
      const newCity = d.city ?? practice.city;
      const geo = await geocodeAddress(newAddress, newCity);
      if (geo) geoUpdate = { lat: geo.lat, lng: geo.lng };
    }

    const updated = await fastify.prisma.practice.update({
      where: { id: practice.id },
      data: { ...d, ...geoUpdate },
    });
    return { practice: updated };
  });

  // PATCH /my/practice/links/:linkId — accept or reject a connection request
  fastify.patch('/my/practice/links/:linkId', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: therapist.id },
    });
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    const { linkId } = request.params as { linkId: string };
    const { action } = request.body as { action: 'accept' | 'reject' };

    const link = await fastify.prisma.therapistPracticeLink.findUnique({ where: { id: linkId } });
    if (!link || link.practiceId !== practice.id) return reply.notFound('Link nicht gefunden');

    const updated = await fastify.prisma.therapistPracticeLink.update({
      where: { id: linkId },
      data: { status: action === 'accept' ? 'CONFIRMED' : 'REJECTED' },
    });
    return { link: updated };
  });

  // POST /my/practice/invite — invite a therapist by email
  fastify.post('/my/practice/invite', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: therapist.id },
    });
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const invitee = await fastify.prisma.therapist.findUnique({
      where: { email: parsed.data.email },
    });
    if (!invitee) return reply.notFound('Therapeut nicht gefunden');

    const existingLink = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId: invitee.id, practiceId: practice.id } },
    });
    if (existingLink) return reply.conflict('Therapeut bereits verknüpft oder Einladung ausstehend');

    const link = await fastify.prisma.therapistPracticeLink.create({
      data: { therapistId: invitee.id, practiceId: practice.id, status: 'PROPOSED', initiatedBy: 'ADMIN' } as any,
    });
    return reply.status(201).send({ link });
  });

  // GET /my/practice/invite-token — get or create shareable invite token
  fastify.get('/my/practice/invite-token', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: therapist.id },
    });
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    let token = (practice as any).inviteToken;
    if (!token) {
      token = randomBytes(12).toString('hex');
      await (fastify.prisma as any).practice.update({
        where: { id: practice.id },
        data: { inviteToken: token },
      });
    }
    return { token, practiceId: practice.id, practiceName: practice.name };
  });

  // POST /practice/join/:token — therapist joins via invite link
  fastify.post('/practice/join/:token', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const { token } = request.params as { token: string };
    const practice = await (fastify.prisma as any).practice.findUnique({
      where: { inviteToken: token },
    });
    if (!practice || practice.reviewStatus !== 'APPROVED') return reply.notFound('Einladung ungültig');

    const existing = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId: therapist.id, practiceId: practice.id } },
    });
    if (existing) return reply.conflict('Bereits verbunden oder Anfrage ausstehend');

    const link = await fastify.prisma.therapistPracticeLink.create({
      data: { therapistId: therapist.id, practiceId: practice.id, status: 'PROPOSED', initiatedBy: 'THERAPIST' } as any,
    });
    return reply.status(201).send({ link, practiceName: practice.name });
  });

  // GET /therapists/search?q= — search approved therapists by name or email
  fastify.get('/therapists/search', async (request) => {
    const { q = '' } = request.query as { q?: string };
    if (q.length < 2) return { therapists: [] };

    const therapists = await fastify.prisma.therapist.findMany({
      where: {
        reviewStatus: 'APPROVED',
        OR: [
          { fullName: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, fullName: true, professionalTitle: true, email: true, city: true, photo: true },
      take: 10,
    });
    return { therapists };
  });

  // DELETE /my/practice/invite/:therapistId — cancel a pending invite
  fastify.delete('/my/practice/invite/:therapistId', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: therapist.id },
    });
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    const { therapistId } = request.params as { therapistId: string };
    const link = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId, practiceId: practice.id } },
    });
    if (!link || link.status !== 'PROPOSED') return reply.notFound('Ausstehende Einladung nicht gefunden');

    await fastify.prisma.therapistPracticeLink.delete({ where: { id: link.id } });
    return { success: true };
  });

  // DELETE /my/practice/links/:linkId — remove a therapist from the practice
  fastify.delete('/my/practice/links/:linkId', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: therapist.id },
    });
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    const { linkId } = request.params as { linkId: string };
    const link = await fastify.prisma.therapistPracticeLink.findUnique({ where: { id: linkId } });
    if (!link || link.practiceId !== practice.id) return reply.notFound('Link nicht gefunden');

    await fastify.prisma.therapistPracticeLink.delete({ where: { id: linkId } });
    return { success: true };
  });

  // DELETE /my/practice — delete the practice this therapist admins
  fastify.delete('/my/practice', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: therapist.id },
    });
    if (!practice) return reply.notFound('Keine eigene Praxis');

    await fastify.prisma.practice.delete({ where: { id: practice.id } });

    return { success: true };
  });

  // POST /my/practice/create-therapist — create a new therapist profile and send invitation
  fastify.post('/my/practice/create-therapist', async (request, reply) => {
    const admin = await getAuthedTherapist(request, fastify);
    if (!admin) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: admin.id },
    });
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

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

    const existing = await fastify.prisma.therapist.findUnique({ where: { email } });
    if (existing) return reply.conflict('Ein Therapeut mit dieser E-Mail-Adresse existiert bereits.');

    const isDev = process.env.NODE_ENV !== 'production';
    const reviewStatus = isDev ? 'APPROVED' : 'PENDING_REVIEW';

    const newTherapist = await fastify.prisma.therapist.create({
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

    await fastify.prisma.therapistPracticeLink.create({
      data: {
        therapistId: newTherapist.id,
        practiceId: practice.id,
        status: 'CONFIRMED',
        initiatedBy: 'ADMIN',
      } as any,
    });

    const inviteToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await fastify.prisma.invitation.create({
      data: {
        token: inviteToken,
        therapistId: newTherapist.id,
        practiceId: practice.id,
        email,
        expiresAt,
      },
    });

    const baseUrl = process.env.MOBILE_URL ?? 'http://localhost:8081';
    const inviteLink = `${baseUrl}/invite?token=${inviteToken}`;

    try {
      await sendInviteEmail({ to: email, therapistName: fullName, practiceName: practice.name, inviteLink });
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to send invite email');
    }

    return reply.status(201).send({ therapistId: newTherapist.id, inviteToken, inviteLink });
  });

  // POST /my/practice/resend-invite/:therapistId — resend invitation to an invited therapist
  fastify.post('/my/practice/resend-invite/:therapistId', async (request, reply) => {
    const admin = await getAuthedTherapist(request, fastify);
    if (!admin) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: admin.id },
    });
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    const { therapistId } = request.params as { therapistId: string };

    const link = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId, practiceId: practice.id } },
    });
    if (!link) return reply.notFound('Therapeut ist nicht mit dieser Praxis verknüpft');

    const target = await fastify.prisma.therapist.findUnique({ where: { id: therapistId } });
    if (!target) return reply.notFound('Therapeut nicht gefunden');
    if (target.onboardingStatus !== 'invited') {
      return reply.badRequest('Einladung kann nur erneut gesendet werden, wenn der Therapeut noch nicht eingeloggt ist.');
    }

    // Invalidate old pending invitations
    await fastify.prisma.invitation.updateMany({
      where: { therapistId, practiceId: practice.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const inviteToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await fastify.prisma.invitation.create({
      data: { token: inviteToken, therapistId, practiceId: practice.id, email: target.email, expiresAt },
    });

    const baseUrl = process.env.MOBILE_URL ?? 'http://localhost:8081';
    const inviteLink = `${baseUrl}/invite?token=${inviteToken}`;

    try {
      await sendReinviteEmail({ to: target.email, therapistName: target.fullName, practiceName: practice.name, inviteLink });
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to resend invite email');
    }

    return { inviteToken, inviteLink };
  });

  // GET /notifications — returns pending notifications for the logged-in therapist
  fastify.get('/notifications', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const notifications: { id: string; type: string; message: string; createdAt: Date }[] = [];

    // Admin notifications: therapist-initiated join requests (initiatedBy = THERAPIST)
    const adminPractice = await fastify.prisma.practice.findFirst({
      where: { adminTherapistId: therapist.id },
      include: {
        links: {
          where: { status: 'PROPOSED', initiatedBy: 'THERAPIST' } as any,
          include: { therapist: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (adminPractice) {
      for (const link of adminPractice.links) {
        notifications.push({
          id: link.id,
          type: 'JOIN_REQUEST',
          message: `${link.therapist.fullName} möchte deiner Praxis beitreten.`,
          createdAt: link.createdAt,
        });
      }
    }

    // Therapist notifications: admin-initiated invites (initiatedBy = ADMIN)
    const invites = await (fastify.prisma as any).therapistPracticeLink.findMany({
      where: { therapistId: therapist.id, status: 'PROPOSED', initiatedBy: 'ADMIN' },
      include: { practice: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    for (const link of invites) {
      notifications.push({
        id: link.id,
        type: 'INVITE',
        message: `${link.practice.name} hat dich eingeladen, der Praxis beizutreten.`,
        createdAt: link.createdAt,
      });
    }

    return { notifications };
  });
};
