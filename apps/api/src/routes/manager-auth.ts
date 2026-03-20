import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hashPassword, verifyPassword, getToken } from './auth-utils.js';
import { randomBytes } from 'crypto';
import { geocodeAddress } from '../utils/geocode.js';
import { sendInviteEmail } from '../utils/mailer.js';
import { getTherapistPublicationState } from '../utils/profile-completeness.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  practiceName: z.string().min(2),
  practiceCity: z.string().min(2),
  practiceAddress: z.string().optional(),
  practicePhone: z.string().optional(),
  // If the manager is also a therapist:
  isTherapist: z.boolean().default(false),
  fullName: z.string().optional(),
  professionalTitle: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updatePracticeSchema = z.object({
  practiceId: z.string(),
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  hours: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().nullable().optional(),
  photos: z.string().nullable().optional(),
});

const createPracticeSchema = z.object({
  practiceName: z.string().min(2),
  practiceCity: z.string().min(2),
  practiceAddress: z.string().optional(),
  practicePhone: z.string().optional(),
});

// ── Helper ───────────────────────────────────────────────────────────────────

async function getManagerByToken(fastify: any, token: string) {
  return fastify.prisma.practiceManager.findUnique({
    where: { sessionToken: token },
    include: {
      therapist: {
        select: {
          id: true, fullName: true, professionalTitle: true,
          city: true, bio: true, photo: true,
          specializations: true, languages: true,
          isVisible: true, isPublished: true, reviewStatus: true,
          visibilityPreference: true, onboardingStatus: true,
        },
      },
    },
  });
}

async function getManagerPractices(fastify: any, managerId: string) {
  const assignments = await fastify.prisma.managerPracticeAssignment.findMany({
    where: { managerId },
    include: {
      practice: {
        include: {
          links: {
            where: { status: 'CONFIRMED' },
            include: {
              therapist: {
                select: {
                  id: true, fullName: true, professionalTitle: true,
                  photo: true, email: true, onboardingStatus: true,
                  isPublished: true, invitedByPracticeId: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return assignments.map((a: any) => ({
    id: a.practice.id,
    name: a.practice.name,
    city: a.practice.city,
    address: a.practice.address,
    phone: a.practice.phone,
    hours: a.practice.hours,
    description: a.practice.description,
    logo: a.practice.logo,
    photos: a.practice.photos,
    lat: a.practice.lat,
    lng: a.practice.lng,
    reviewStatus: a.practice.reviewStatus,
    therapists: a.practice.links.map((l: any) => l.therapist),
  }));
}

async function getLegacyManagerPractice(fastify: any, manager: any) {
  if (!manager?.practiceId) return null;
  const practice = await fastify.prisma.practice.findUnique({
    where: { id: manager.practiceId },
    include: {
      links: {
        where: { status: 'CONFIRMED' },
        include: {
          therapist: {
            select: {
              id: true, fullName: true, professionalTitle: true,
              photo: true, email: true, onboardingStatus: true,
              isPublished: true, invitedByPracticeId: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!practice) return null;
  return {
    id: practice.id,
    name: practice.name,
    city: practice.city,
    address: practice.address,
    phone: practice.phone,
    hours: practice.hours,
    description: practice.description,
    logo: practice.logo,
    photos: practice.photos,
    lat: practice.lat,
    lng: practice.lng,
    reviewStatus: practice.reviewStatus,
    therapists: practice.links.map((l: any) => l.therapist),
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

export const managerAuthRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /manager/register
  // Creates a PracticeManager + Practice.
  // If isTherapist=true, also creates a linked Therapist profile (unpublished).
  fastify.post('/manager/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const {
      email, password,
      practiceName, practiceCity, practiceAddress, practicePhone,
      isTherapist, fullName, professionalTitle,
    } = parsed.data;

    if (isTherapist && (!fullName || !professionalTitle)) {
      return reply.badRequest('fullName und professionalTitle sind erforderlich wenn isTherapist=true');
    }

    // Check email not already used
    const existingUser = await fastify.prisma.user.findUnique({ where: { email } });
    if (existingUser) return reply.conflict('E-Mail wird bereits verwendet');

    const existingManager = await fastify.prisma.practiceManager.findUnique({ where: { email } });
    if (existingManager) return reply.conflict('E-Mail wird bereits verwendet');

    const existingTherapist = await fastify.prisma.therapist.findUnique({ where: { email } });
    if (existingTherapist) return reply.conflict('E-Mail wird bereits verwendet');

    const passwordHash = await hashPassword(password);
    const isDev = process.env.NODE_ENV !== 'production';

    // Geocode practice address
    const geo = await geocodeAddress(practiceAddress ?? '', practiceCity);

    // Create practice
    const practice = await fastify.prisma.practice.create({
      data: {
        name: practiceName,
        city: practiceCity,
        address: practiceAddress,
        phone: practicePhone,
        reviewStatus: isDev ? 'APPROVED' : 'PENDING_REVIEW',
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
      },
    });

    // Optionally create therapist profile (unpublished, hidden by default)
    let therapist = null;
    if (isTherapist) {
      therapist = await fastify.prisma.therapist.create({
        data: {
          email,
          fullName: fullName!,
          professionalTitle: professionalTitle!,
          city: practiceCity,
          specializations: '',
          languages: '',
          reviewStatus: isDev ? 'APPROVED' : 'PENDING_REVIEW',
          isVisible: false,
          isPublished: false,
          visibilityPreference: 'hidden',
          onboardingStatus: 'manager_onboarding',
        },
      });

      // Auto-link therapist to practice as CONFIRMED
      await fastify.prisma.therapistPracticeLink.create({
        data: { therapistId: therapist.id, practiceId: practice.id, status: 'CONFIRMED' },
      });
    }

    // Create user + manager account
    const sessionToken = randomBytes(32).toString('hex');
    const user = await fastify.prisma.user.create({
      data: { email, passwordHash, role: 'manager', sessionToken },
    });
    if (therapist) {
      await fastify.prisma.therapist.update({
        where: { id: therapist.id },
        data: { userId: user.id },
      });
    }
    const manager = await fastify.prisma.practiceManager.create({
      data: {
        email,
        userId: user.id,
        passwordHash,
        sessionToken,
        practiceId: practice.id,
        therapistId: therapist?.id ?? null,
      },
    });

    // Create initial practice assignment
    await fastify.prisma.managerPracticeAssignment.create({
      data: { managerId: manager.id, practiceId: practice.id },
    });

    return reply.status(201).send({
      token: sessionToken,
      managerId: manager.id,
      practiceId: practice.id,
      isTherapist,
      therapistId: therapist?.id ?? null,
    });
  });

  // POST /manager/login
  fastify.post('/manager/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { email, password } = parsed.data;

    const user = await fastify.prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'manager' || !user.passwordHash) return reply.unauthorized('Ungültige Zugangsdaten');

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return reply.unauthorized('Ungültige Zugangsdaten');

    const manager = await fastify.prisma.practiceManager.findFirst({
      where: { userId: user.id },
    });
    if (!manager) return reply.unauthorized('Manager-Profil nicht gefunden');

    const token = randomBytes(32).toString('hex');
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { sessionToken: token },
    });
    await fastify.prisma.practiceManager.update({
      where: { id: manager.id },
      data: { sessionToken: token },
    });

    return {
      token,
      managerId: manager.id,
      practiceId: manager.practiceId ?? null,
    };
  });

  // GET /manager/me
  fastify.get('/manager/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const manager = await getManagerByToken(fastify, token);
    if (!manager) return reply.unauthorized('Ungültiger Token');

    const practices = await getManagerPractices(fastify, manager.id);
    const primaryPractice = practices[0] ?? await getLegacyManagerPractice(fastify, manager);
    const therapistProfile = manager.therapist
      ? {
          ...manager.therapist,
          ...getTherapistPublicationState(manager.therapist),
        }
      : null;

    return {
      id: manager.id,
      email: manager.email,
      isTherapist: !!manager.therapistId,
      therapistProfile,
      practice: primaryPractice,
      practices,
    };
  });

  // POST /manager/practices — create an additional practice and assign to this manager
  fastify.post('/manager/practices', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const manager = await fastify.prisma.practiceManager.findUnique({ where: { sessionToken: token } });
    if (!manager) return reply.unauthorized('Ungültiger Token');

    const parsed = createPracticeSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { practiceName, practiceCity, practiceAddress, practicePhone } = parsed.data;
    const isDev = process.env.NODE_ENV !== 'production';
    const geo = await geocodeAddress(practiceAddress ?? '', practiceCity);

    const practice = await fastify.prisma.practice.create({
      data: {
        name: practiceName,
        city: practiceCity,
        address: practiceAddress,
        phone: practicePhone,
        reviewStatus: isDev ? 'APPROVED' : 'PENDING_REVIEW',
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
      },
    });

    await fastify.prisma.managerPracticeAssignment.create({
      data: { managerId: manager.id, practiceId: practice.id },
    });

    return reply.status(201).send({ practiceId: practice.id });
  });

  // PATCH /manager/practice — update a practice the manager is assigned to
  fastify.patch('/manager/practice', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const manager = await fastify.prisma.practiceManager.findUnique({ where: { sessionToken: token } });
    if (!manager) return reply.unauthorized('Ungültiger Token');

    const parsed = updatePracticeSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { practiceId, ...d } = parsed.data;

    // Authorization: verify manager is assigned to this practice
    const assignment = await fastify.prisma.managerPracticeAssignment.findUnique({
      where: { managerId_practiceId: { managerId: manager.id, practiceId } },
    });
    if (!assignment) return reply.forbidden('Keine Berechtigung für diese Praxis');

    const practice = await fastify.prisma.practice.findUnique({ where: { id: practiceId } });
    if (!practice) return reply.notFound('Praxis nicht gefunden');

    const needsGeocode = d.address !== undefined || d.city !== undefined;
    let geoUpdate = {};
    if (needsGeocode) {
      const geo = await geocodeAddress(d.address ?? practice.address ?? '', d.city ?? practice.city);
      if (geo) geoUpdate = { lat: geo.lat, lng: geo.lng };
    }

    const updated = await fastify.prisma.practice.update({
      where: { id: practice.id },
      data: { ...d, ...geoUpdate },
    });

    return { practice: updated };
  });

  // DELETE /manager/practice/therapists/:therapistId — remove therapist from a practice
  fastify.delete('/manager/practice/therapists/:therapistId', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const manager = await fastify.prisma.practiceManager.findUnique({ where: { sessionToken: token } });
    if (!manager) return reply.unauthorized('Ungültiger Token');

    const { therapistId } = request.params as { therapistId: string };
    const { practiceId } = request.query as { practiceId?: string };
    if (!practiceId) return reply.badRequest('practiceId ist erforderlich');

    // Authorization: verify manager is assigned to this practice
    const assignment = await fastify.prisma.managerPracticeAssignment.findUnique({
      where: { managerId_practiceId: { managerId: manager.id, practiceId } },
    });
    if (!assignment) return reply.forbidden('Keine Berechtigung für diese Praxis');

    if (manager.therapistId && manager.therapistId === therapistId) {
      return reply.badRequest('Du kannst dich nicht selbst aus der Praxis entfernen');
    }

    const link = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId, practiceId } },
    });
    if (!link || link.status !== 'CONFIRMED') return reply.notFound('Therapeut nicht in dieser Praxis gefunden');

    await fastify.prisma.therapistPracticeLink.delete({ where: { id: link.id } });

    const remaining = await fastify.prisma.therapistPracticeLink.count({
      where: {
        therapistId,
        status: 'CONFIRMED',
        practice: { reviewStatus: 'APPROVED' },
      },
    });

    let visibilityChanged = false;
    if (remaining === 0) {
      await fastify.prisma.therapist.update({
        where: { id: therapistId },
        data: { isVisible: false },
      });
      visibilityChanged = true;
    }

    await fastify.prisma.therapistRemovalLog.create({
      data: { therapistId, practiceId, managerId: manager.id },
    });

    return { success: true, visibilityChanged };
  });

  // GET /manager/therapists/search?q=&practiceId= — search therapists to add
  fastify.get('/manager/therapists/search', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const manager = await fastify.prisma.practiceManager.findUnique({ where: { sessionToken: token } });
    if (!manager) return reply.unauthorized('Ungültiger Token');

    const { q, practiceId } = request.query as { q?: string; practiceId?: string };
    if (!practiceId) return reply.badRequest('practiceId ist erforderlich');

    const assignment = await fastify.prisma.managerPracticeAssignment.findUnique({
      where: { managerId_practiceId: { managerId: manager.id, practiceId } },
    });
    if (!assignment) return reply.forbidden('Keine Berechtigung für diese Praxis');

    if (!q || q.trim().length < 2) return { therapists: [] };

    const therapists = await fastify.prisma.therapist.findMany({
      where: {
        OR: [
          { fullName: { contains: q.trim() } },
          { email: { contains: q.trim() } },
        ],
        reviewStatus: { in: ['APPROVED', 'PENDING_REVIEW', 'DRAFT'] },
        NOT: {
          links: { some: { practiceId, status: { in: ['CONFIRMED', 'PROPOSED'] } } },
        },
      },
      select: { id: true, fullName: true, professionalTitle: true, email: true, photo: true },
      take: 10,
    });

    return { therapists };
  });

  // POST /manager/practice/therapists — add existing therapist to practice
  fastify.post('/manager/practice/therapists', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const manager = await fastify.prisma.practiceManager.findUnique({ where: { sessionToken: token } });
    if (!manager) return reply.unauthorized('Ungültiger Token');

    const { therapistId, practiceId } = request.body as { therapistId?: string; practiceId?: string };
    if (!therapistId || !practiceId) return reply.badRequest('therapistId und practiceId sind erforderlich');

    const assignment = await fastify.prisma.managerPracticeAssignment.findUnique({
      where: { managerId_practiceId: { managerId: manager.id, practiceId } },
    });
    if (!assignment) return reply.forbidden('Keine Berechtigung für diese Praxis');

    const therapist = await fastify.prisma.therapist.findUnique({ where: { id: therapistId } });
    if (!therapist) return reply.notFound('Therapeut nicht gefunden');

    // Upsert: if link exists (e.g. REJECTED), update to CONFIRMED; otherwise create
    const existing = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId, practiceId } },
    });

    if (existing) {
      await fastify.prisma.therapistPracticeLink.update({
        where: { id: existing.id },
        data: { status: 'CONFIRMED' },
      });
    } else {
      await fastify.prisma.therapistPracticeLink.create({
        data: { therapistId, practiceId, status: 'CONFIRMED' },
      });
    }

    return { success: true };
  });

  // POST /manager/practice/create-therapist — create new therapist profile + link to practice
  fastify.post('/manager/practice/create-therapist', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const manager = await fastify.prisma.practiceManager.findUnique({ where: { sessionToken: token } });
    if (!manager) return reply.unauthorized('Ungültiger Token');

    const schema = z.object({
      fullName: z.string().min(2),
      professionalTitle: z.string().min(2),
      email: z.string().email(),
      practiceId: z.string(),
      city: z.string().optional(),
      bio: z.string().optional(),
      specializations: z.array(z.string()).optional().default([]),
      languages: z.array(z.string()).optional().default([]),
      kassenart: z.string().optional(),
      homeVisit: z.boolean().optional().default(false),
      availability: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { fullName, professionalTitle, email, practiceId, city, bio, specializations, languages, kassenart, homeVisit, availability } = parsed.data;

    const assignment = await fastify.prisma.managerPracticeAssignment.findUnique({
      where: { managerId_practiceId: { managerId: manager.id, practiceId } },
      include: { practice: true },
    });
    if (!assignment) return reply.forbidden('Keine Berechtigung für diese Praxis');

    const existing = await fastify.prisma.therapist.findUnique({ where: { email } });
    if (existing) return reply.conflict('Ein Therapeut mit dieser E-Mail-Adresse existiert bereits.');

    const practice = assignment.practice;
    const isDev = process.env.NODE_ENV !== 'production';

    const newTherapist = await fastify.prisma.therapist.create({
      data: {
        email, fullName, professionalTitle,
        city: city ?? practice.city,
        bio: bio ?? null,
        specializations: specializations.join(', '),
        languages: languages.join(', '),
        kassenart: kassenart ?? '',
        homeVisit: homeVisit ?? false,
        availability: availability ?? undefined,
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

  // GET /manager/practice/invite-token?practiceId= — get or create shareable invite token
  fastify.get('/manager/practice/invite-token', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const manager = await fastify.prisma.practiceManager.findUnique({ where: { sessionToken: token } });
    if (!manager) return reply.unauthorized('Ungültiger Token');

    const { practiceId } = request.query as { practiceId?: string };
    if (!practiceId) return reply.badRequest('practiceId ist erforderlich');

    const assignment = await fastify.prisma.managerPracticeAssignment.findUnique({
      where: { managerId_practiceId: { managerId: manager.id, practiceId } },
      include: { practice: true },
    });
    if (!assignment) return reply.forbidden('Keine Berechtigung für diese Praxis');

    const practice = assignment.practice;
    let inviteToken = practice.inviteToken;
    if (!inviteToken) {
      inviteToken = randomBytes(12).toString('hex');
      await fastify.prisma.practice.update({ where: { id: practice.id }, data: { inviteToken } });
    }

    return { token: inviteToken, practiceId: practice.id, practiceName: practice.name };
  });

  // POST /manager/logout
  fastify.post('/manager/logout', async (request) => {
    const token = getToken(request);
    if (token) {
      await fastify.prisma.practiceManager.updateMany({
        where: { sessionToken: token },
        data: { sessionToken: null },
      });
    }
    return { success: true };
  });
};
