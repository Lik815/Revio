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

// Returns the first practice assigned to the manager linked to this therapist, or null
async function getAdminPractice(fastify: any, therapistId: string) {
  const assignment = await fastify.prisma.managerPracticeAssignment.findFirst({
    where: { manager: { therapistId } },
    include: { practice: true },
  });
  return assignment?.practice ?? null;
}

export const practiceRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /practice — create new practice, therapist becomes manager
  fastify.post('/practice', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

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
        reviewStatus: process.env.NODE_ENV === 'production' ? 'PENDING_REVIEW' : 'APPROVED',
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
      },
    });

    // Create PracticeManager for this therapist (or reuse if already exists)
    let manager = await fastify.prisma.practiceManager.findUnique({ where: { therapistId: therapist.id } });
    if (!manager) {
      manager = await fastify.prisma.practiceManager.create({
        data: { email: therapist.email, passwordHash: therapist.passwordHash ?? '', therapistId: therapist.id, practiceId: practice.id },
      });
    }

    // Create ManagerPracticeAssignment so getAdminPractice() can find it
    const existingAssignment = await fastify.prisma.managerPracticeAssignment.findUnique({
      where: { managerId_practiceId: { managerId: manager.id, practiceId: practice.id } },
    });
    if (!existingAssignment) {
      await fastify.prisma.managerPracticeAssignment.create({
        data: { managerId: manager.id, practiceId: practice.id },
      });
    }

    // Auto-link therapist to practice as CONFIRMED
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
        ...(q ? { OR: [{ name: { contains: q } }, { city: { contains: q } }, { address: { contains: q } }] } : {}),
        ...(city ? { city: { contains: city } } : {}),
      },
      include: {
        links: {
          where: { status: 'CONFIRMED' },
          include: { therapist: { select: { id: true, fullName: true, professionalTitle: true } } },
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
    if (!practice || practice.reviewStatus !== 'APPROVED') return reply.notFound('Praxis nicht gefunden');

    const existingLink = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId: therapist.id, practiceId } },
    });
    if (existingLink) return reply.conflict('Anfrage bereits gesendet oder bereits verbunden');

    const link = await fastify.prisma.therapistPracticeLink.create({
      data: { therapistId: therapist.id, practiceId, status: 'PROPOSED' },
    });
    return reply.status(201).send({ link });
  });

  // GET /my/practice — get the practice this therapist manages
  fastify.get('/my/practice', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const manager = await fastify.prisma.practiceManager.findUnique({ where: { therapistId: therapist.id } });
    if (!manager) return reply.notFound('Keine eigene Praxis');

    const practice = await fastify.prisma.practice.findUnique({
      where: { id: manager.practiceId ?? undefined },
      include: {
        links: {
          include: {
            therapist: {
              select: { id: true, fullName: true, professionalTitle: true, photo: true,
                specializations: true, email: true, onboardingStatus: true, isPublished: true, invitedByPracticeId: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!practice) return reply.notFound('Keine eigene Praxis');
    return { practice };
  });

  // PATCH /my/practice — update practice info
  fastify.patch('/my/practice', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await getAdminPractice(fastify, therapist.id);
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    const schema = z.object({
      name: z.string().min(1).optional(),
      city: z.string().min(1).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      hours: z.string().optional(),
      description: z.string().optional(),
      homeVisit: z.boolean().optional(),
      logo: z.string().optional(),
      photos: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const d = parsed.data;
    const needsGeocode = d.address !== undefined || d.city !== undefined;
    let geoUpdate = {};
    if (needsGeocode) {
      const geo = await geocodeAddress(d.address ?? practice.address ?? '', d.city ?? practice.city);
      if (geo) geoUpdate = { lat: geo.lat, lng: geo.lng };
    }

    const updated = await fastify.prisma.practice.update({ where: { id: practice.id }, data: { ...d, ...geoUpdate } });
    return { practice: updated };
  });

  // PATCH /my/practice/links/:linkId — accept or reject a connection request
  fastify.patch('/my/practice/links/:linkId', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await getAdminPractice(fastify, therapist.id);
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

    const practice = await getAdminPractice(fastify, therapist.id);
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const invitee = await fastify.prisma.therapist.findUnique({ where: { email: parsed.data.email } });
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

    const practice = await getAdminPractice(fastify, therapist.id);
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    let token = practice.inviteToken;
    if (!token) {
      token = randomBytes(12).toString('hex');
      await fastify.prisma.practice.update({ where: { id: practice.id }, data: { inviteToken: token } });
    }
    return { token, practiceId: practice.id, practiceName: practice.name };
  });

  // POST /practice/join/:token — therapist joins via invite link
  fastify.post('/practice/join/:token', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const { token } = request.params as { token: string };
    const practice = await fastify.prisma.practice.findUnique({ where: { inviteToken: token } });
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
        OR: [{ fullName: { contains: q } }, { email: { contains: q } }],
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

    const practice = await getAdminPractice(fastify, therapist.id);
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

    const practice = await getAdminPractice(fastify, therapist.id);
    if (!practice) return reply.forbidden('Kein Praxis-Admin');

    const { linkId } = request.params as { linkId: string };
    const link = await fastify.prisma.therapistPracticeLink.findUnique({ where: { id: linkId } });
    if (!link || link.practiceId !== practice.id) return reply.notFound('Link nicht gefunden');

    await fastify.prisma.therapistPracticeLink.delete({ where: { id: link.id } });
    return { success: true };
  });

  // DELETE /my/practice — delete the practice this therapist manages
  fastify.delete('/my/practice', async (request, reply) => {
    const therapist = await getAuthedTherapist(request, fastify);
    if (!therapist) return reply.unauthorized('Kein Token');

    const practice = await getAdminPractice(fastify, therapist.id);
    if (!practice) return reply.notFound('Keine eigene Praxis');

    const bodySchema = z.object({
      reason: z.string().min(1),
      reasonDetail: z.string().optional(),
    });
    const body = bodySchema.safeParse(request.body);
    if (!body.success) return reply.badRequest('reason ist erforderlich');

    const linkedCount = await fastify.prisma.therapistPracticeLink.count({
      where: { practiceId: practice.id },
    });

    const managerAssignment = await fastify.prisma.managerPracticeAssignment.findFirst({
      where: { practiceId: practice.id },
      include: { manager: true },
    });

    await fastify.prisma.practiceDeletionLog.create({
      data: {
        practiceId: practice.id,
        practiceName: practice.name,
        managerId: managerAssignment?.managerId ?? therapist.id,
        reason: body.data.reason,
        reasonDetail: body.data.reasonDetail ?? null,
        linkedTherapists: linkedCount,
      },
    });

    await fastify.prisma.practice.delete({ where: { id: practice.id } });
    return { success: true };
  });

  // POST /my/practice/create-therapist — create new therapist + send invitation
  fastify.post('/my/practice/create-therapist', async (request, reply) => {
    const admin = await getAuthedTherapist(request, fastify);
    if (!admin) return reply.unauthorized('Kein Token');

    const practice = await getAdminPractice(fastify, admin.id);
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
    const newTherapist = await fastify.prisma.therapist.create({
      data: {
        email, fullName, professionalTitle,
        city: practice.city,
        specializations: specializations.join(', '),
        languages: languages.join(', '),
        reviewStatus: isDev ? 'APPROVED' : 'PENDING_REVIEW',
        onboardingStatus: 'invited',
        visibilityPreference: 'hidden',
        isPublished: false,
        invitedByPracticeId: practice.id,
      },
    });

    await fastify.prisma.therapistPracticeLink.create({
      data: { therapistId: newTherapist.id, practiceId: practice.id, status: 'CONFIRMED', initiatedBy: 'ADMIN' } as any,
    });

    const inviteToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await fastify.prisma.invitation.create({
      data: { token: inviteToken, therapistId: newTherapist.id, practiceId: practice.id, email, expiresAt },
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

  // POST /my/practice/resend-invite/:therapistId — resend invitation
  fastify.post('/my/practice/resend-invite/:therapistId', async (request, reply) => {
    const admin = await getAuthedTherapist(request, fastify);
    if (!admin) return reply.unauthorized('Kein Token');

    const practice = await getAdminPractice(fastify, admin.id);
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

  // GET /notifications — pending notifications for the logged-in user (therapist or manager)
  fastify.get('/notifications', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const notifications: { id: string; type: string; message: string; createdAt: Date }[] = [];

    // Try therapist token first
    const therapist = await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } });
    if (therapist) {
      // Therapist-as-admin: join requests for their managed practice
      const adminPractice = await getAdminPractice(fastify, therapist.id);
      if (adminPractice) {
        const joinRequests = await fastify.prisma.therapistPracticeLink.findMany({
          where: { practiceId: adminPractice.id, status: 'PROPOSED', initiatedBy: 'THERAPIST' } as any,
          include: { therapist: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        });
        for (const link of joinRequests) {
          notifications.push({
            id: link.id, type: 'JOIN_REQUEST',
            message: `${link.therapist.fullName} möchte deiner Praxis beitreten.`,
            createdAt: link.createdAt,
          });
        }
      }
      // Therapist invites
      const invites = await (fastify.prisma as any).therapistPracticeLink.findMany({
        where: { therapistId: therapist.id, status: 'PROPOSED', initiatedBy: 'ADMIN' },
        include: { practice: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      for (const link of invites) {
        notifications.push({
          id: link.id, type: 'INVITE',
          message: `${link.practice.name} hat dich eingeladen, der Praxis beizutreten.`,
          createdAt: link.createdAt,
        });
      }
      return { notifications };
    }

    // Try manager token
    const manager = await fastify.prisma.practiceManager.findUnique({
      where: { sessionToken: token },
      include: { assignments: { select: { practiceId: true } } },
    });
    if (manager) {
      // Join requests across all assigned practices
      const practiceIds = manager.assignments.map((a: any) => a.practiceId);
      if (practiceIds.length > 0) {
        const joinRequests = await fastify.prisma.therapistPracticeLink.findMany({
          where: { practiceId: { in: practiceIds }, status: 'PROPOSED', initiatedBy: 'THERAPIST' } as any,
          include: {
            therapist: { select: { id: true, fullName: true } },
            practice: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
        for (const link of joinRequests) {
          notifications.push({
            id: link.id, type: 'JOIN_REQUEST',
            message: `${(link as any).therapist.fullName} möchte ${(link as any).practice.name} beitreten.`,
            createdAt: link.createdAt,
          });
        }
      }
      return { notifications };
    }

    return reply.unauthorized('Kein Token');
  });
};
