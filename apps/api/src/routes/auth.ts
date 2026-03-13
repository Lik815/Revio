import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword, getToken } from './auth-utils.js';

export { hashPassword, verifyPassword, getToken };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  fullName: z.string().min(2).optional(),
  professionalTitle: z.string().min(2).optional(),
  bio: z.string().optional(),
  homeVisit: z.boolean().optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  photo: z.string().optional(),
});

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { email, password } = parsed.data;

    const therapist = await fastify.prisma.therapist.findUnique({ where: { email } });
    if (!therapist || !therapist.passwordHash) {
      return reply.unauthorized('Ungültige Zugangsdaten');
    }

    const valid = await verifyPassword(password, therapist.passwordHash);
    if (!valid) return reply.unauthorized('Ungültige Zugangsdaten');

    const token = randomBytes(32).toString('hex');
    await fastify.prisma.therapist.update({
      where: { id: therapist.id },
      data: { sessionToken: token },
    });

    return { token, therapistId: therapist.id, fullName: therapist.fullName };
  });

  fastify.get('/auth/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const therapist = await fastify.prisma.therapist.findUnique({
      where: { sessionToken: token },
      include: {
        links: {
          where: { status: 'CONFIRMED' },
          include: { practice: true },
        },
      },
    });
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    return {
      id: therapist.id,
      email: therapist.email,
      fullName: therapist.fullName,
      professionalTitle: therapist.professionalTitle,
      city: therapist.city,
      bio: therapist.bio,
      homeVisit: therapist.homeVisit,
      specializations: splitList(therapist.specializations),
      languages: splitList(therapist.languages),
      certifications: splitList(therapist.certifications),
      photo: therapist.photo,
      reviewStatus: therapist.reviewStatus,
      practices: therapist.links.map((l) => ({
        id: l.practice.id,
        name: l.practice.name,
        city: l.practice.city,
        phone: l.practice.phone,
      })),
    };
  });

  fastify.patch('/auth/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const therapist = await fastify.prisma.therapist.findUnique({
      where: { sessionToken: token },
    });
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const parsed = updateMeSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const data = parsed.data;
    const updateData: Record<string, any> = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.professionalTitle !== undefined) updateData.professionalTitle = data.professionalTitle;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.homeVisit !== undefined) updateData.homeVisit = data.homeVisit;
    if (data.specializations !== undefined) updateData.specializations = data.specializations.join(', ');
    if (data.languages !== undefined) updateData.languages = data.languages.join(', ');
    if (data.certifications !== undefined) updateData.certifications = data.certifications.join(', ');
    if (data.photo !== undefined) updateData.photo = data.photo;

    const updated = await fastify.prisma.therapist.update({
      where: { id: therapist.id },
      data: updateData,
    });

    return { success: true, fullName: updated.fullName };
  });

  fastify.post('/auth/logout', async (request, reply) => {
    const token = getToken(request);
    if (!token) return { success: true };

    const therapist = await fastify.prisma.therapist.findUnique({
      where: { sessionToken: token },
    });
    if (therapist) {
      await fastify.prisma.therapist.update({
        where: { id: therapist.id },
        data: { sessionToken: null },
      });
    }

    return { success: true };
  });
};
