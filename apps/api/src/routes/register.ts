import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  professionalTitle: z.string().min(2),
  city: z.string().min(1),
  bio: z.string().optional(),
  homeVisit: z.boolean(),
  specializations: z.array(z.string()).min(1),
  languages: z.array(z.string()).min(1),
  certifications: z.array(z.string()).default([]),
  practice: z.object({
    name: z.string().min(2),
    city: z.string().min(1),
    address: z.string().optional(),
    phone: z.string().optional(),
  }),
});

export const registerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register/therapist', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.flatten().toString());
    }

    const data = parsed.data;

    const existing = await fastify.prisma.therapist.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      return reply.conflict('A therapist with this email already exists.');
    }

    const practice = await fastify.prisma.practice.create({
      data: {
        name: data.practice.name,
        city: data.practice.city,
        address: data.practice.address,
        phone: data.practice.phone,
        reviewStatus: 'PENDING_REVIEW',
      },
    });

    const therapist = await fastify.prisma.therapist.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        professionalTitle: data.professionalTitle,
        city: data.city,
        bio: data.bio,
        homeVisit: data.homeVisit,
        specializations: data.specializations.join(', '),
        languages: data.languages.join(', '),
        certifications: data.certifications.join(', '),
        reviewStatus: 'PENDING_REVIEW',
        links: {
          create: {
            practiceId: practice.id,
            status: 'PROPOSED',
          },
        },
      },
    });

    return reply.status(201).send({
      message: 'Registration submitted successfully. Your profile is under review.',
      therapistId: therapist.id,
    });
  });
};
