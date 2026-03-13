import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hashPassword, verifyPassword, getToken } from './auth-utils.js';
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

export const practiceAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Login ───────────────────────────────────────────────────────────────
  fastify.post('/practice-auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { email, password } = parsed.data;

    const practice = await fastify.prisma.practice.findUnique({ where: { adminEmail: email } });
    if (!practice || !practice.adminPasswordHash) {
      return reply.unauthorized('Ungültige Zugangsdaten');
    }

    const valid = await verifyPassword(password, practice.adminPasswordHash);
    if (!valid) return reply.unauthorized('Ungültige Zugangsdaten');

    const token = randomBytes(32).toString('hex');
    await fastify.prisma.practice.update({
      where: { id: practice.id },
      data: { adminSessionToken: token },
    });

    return { token, practiceId: practice.id, name: practice.name };
  });

  // ── Get own practice profile ────────────────────────────────────────────
  fastify.get('/practice-auth/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findUnique({
      where: { adminSessionToken: token },
      include: {
        links: {
          where: { status: 'CONFIRMED' },
          include: { therapist: { select: { id: true, fullName: true, professionalTitle: true } } },
        },
      },
    });
    if (!practice) return reply.unauthorized('Ungültiger Token');

    return {
      id: practice.id,
      name: practice.name,
      city: practice.city,
      address: practice.address,
      phone: practice.phone,
      hours: practice.hours,
      lat: practice.lat,
      lng: practice.lng,
      reviewStatus: practice.reviewStatus,
      therapists: practice.links.map((l) => ({
        id: l.therapist.id,
        fullName: l.therapist.fullName,
        professionalTitle: l.therapist.professionalTitle,
      })),
    };
  });

  // ── Update own practice profile ─────────────────────────────────────────
  fastify.patch('/practice-auth/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const practice = await fastify.prisma.practice.findUnique({
      where: { adminSessionToken: token },
    });
    if (!practice) return reply.unauthorized('Ungültiger Token');

    const parsed = updatePracticeSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const data = parsed.data;
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.hours !== undefined) updateData.hours = data.hours;
    if (data.city !== undefined) updateData.city = data.city;

    const updated = await fastify.prisma.practice.update({
      where: { id: practice.id },
      data: updateData,
    });

    return { success: true, name: updated.name };
  });

  // ── Logout ──────────────────────────────────────────────────────────────
  fastify.post('/practice-auth/logout', async (request, reply) => {
    const token = getToken(request);
    if (!token) return { success: true };

    const practice = await fastify.prisma.practice.findUnique({
      where: { adminSessionToken: token },
    });
    if (practice) {
      await fastify.prisma.practice.update({
        where: { id: practice.id },
        data: { adminSessionToken: null },
      });
    }

    return { success: true };
  });
};
