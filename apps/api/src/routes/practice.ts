import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getToken } from './auth-utils.js';

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

    const practice = await fastify.prisma.practice.create({
      data: {
        ...parsed.data,
        adminTherapistId: therapist.id,
        reviewStatus: process.env.NODE_ENV === 'production' ? 'PENDING_REVIEW' : 'APPROVED',
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
      logo: z.string().optional(),
      photos: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const updated = await fastify.prisma.practice.update({
      where: { id: practice.id },
      data: parsed.data,
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
      data: { therapistId: invitee.id, practiceId: practice.id, status: 'PROPOSED' },
    });
    return reply.status(201).send({ link });
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
};
