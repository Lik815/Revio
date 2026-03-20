// Legacy practice-auth routes — now backed by PracticeManager model.
// New integrations should use /manager/* routes instead.
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { verifyPassword, getToken } from './auth-utils.js';
import { randomBytes } from 'crypto';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updatePracticeSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  hours: z.string().optional(),
  city: z.string().optional(),
});

async function getManagerByToken(fastify: any, token: string) {
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
  const practice = manager.assignments[0]?.practice
    ?? (manager.practiceId
      ? await fastify.prisma.practice.findUnique({ where: { id: manager.practiceId } })
      : null);
  return { ...manager, practice };
}

export const practiceAuthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/practice-auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { email, password } = parsed.data;
    const manager = await fastify.prisma.practiceManager.findUnique({ where: { email } });
    if (!manager || !manager.passwordHash) return reply.unauthorized('Ungültige Zugangsdaten');

    const valid = await verifyPassword(password, manager.passwordHash);
    if (!valid) return reply.unauthorized('Ungültige Zugangsdaten');

    const token = randomBytes(32).toString('hex');
    await fastify.prisma.practiceManager.update({ where: { id: manager.id }, data: { sessionToken: token } });

    const practice = await fastify.prisma.practice.findUnique({ where: { id: manager.practiceId ?? undefined } });
    return { token, practiceId: manager.practiceId, name: practice?.name };
  });

  fastify.get('/practice-auth/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const manager = await getManagerByToken(fastify, token);
    if (!manager || !manager.practice) return reply.unauthorized('Ungültiger Token');

    const p = manager.practice;
    const links = await fastify.prisma.therapistPracticeLink.findMany({
      where: { practiceId: p.id, status: 'CONFIRMED' },
      include: { therapist: { select: { id: true, fullName: true, professionalTitle: true } } },
    });

    return {
      id: p.id, name: p.name, city: p.city, address: p.address,
      phone: p.phone, hours: p.hours, lat: p.lat, lng: p.lng,
      reviewStatus: p.reviewStatus,
      therapists: links.map((l: any) => l.therapist),
    };
  });

  fastify.patch('/practice-auth/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const manager = await getManagerByToken(fastify, token);
    if (!manager) return reply.unauthorized('Ungültiger Token');

    const parsed = updatePracticeSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const updated = await fastify.prisma.practice.update({
      where: { id: manager.practiceId },
      data: parsed.data,
    });
    return { success: true, name: updated.name };
  });

  fastify.post('/practice-auth/logout', async (request) => {
    const token = getToken(request);
    if (token) {
      await fastify.prisma.practiceManager.updateMany({ where: { sessionToken: token }, data: { sessionToken: null } });
    }
    return { success: true };
  });
};
