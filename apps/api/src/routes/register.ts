import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hashPassword } from './auth.js';
import { geocodeAddress } from '../utils/geocode.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
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
  }).optional(),
  existingPracticeId: z.string().optional(),
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

    // In development, auto-approve so the profile immediately appears in search
    const isDev = process.env.NODE_ENV !== 'production';
    const reviewStatus = isDev ? 'APPROVED' : 'PENDING_REVIEW';
    const linkStatus = isDev ? 'CONFIRMED' : 'PROPOSED';

    const practice = data.practice
      ? await (async () => {
          const geo = await geocodeAddress(data.practice!.address ?? '', data.practice!.city);
          return fastify.prisma.practice.create({
            data: {
              name: data.practice!.name,
              city: data.practice!.city,
              address: data.practice!.address,
              phone: data.practice!.phone,
              reviewStatus,
              ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
            },
          });
        })()
      : data.existingPracticeId
      ? await fastify.prisma.practice.findUnique({ where: { id: data.existingPracticeId } })
      : null;

    if (data.existingPracticeId && !practice) {
      return reply.badRequest('Praxis nicht gefunden.');
    }

    const passwordHash = data.password ? await hashPassword(data.password) : undefined;

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
        passwordHash,
        reviewStatus,
        ...(practice ? {
          links: {
            create: {
              practiceId: practice.id,
              // existing practice links start as PROPOSED (need practice admin confirmation)
              status: data.existingPracticeId ? 'PROPOSED' : linkStatus,
            },
          },
        } : {}),
      },
    });

    return reply.status(201).send({
      message: isDev
        ? 'Profile auto-approved (development mode). Visible in search immediately.'
        : 'Registration submitted successfully. Your profile is under review.',
      therapistId: therapist.id,
    });
  });
};
