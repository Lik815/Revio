import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getEnv } from '../env.js';

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

function mapTherapist(t: {
  id: string; email: string; fullName: string; professionalTitle: string;
  city: string; bio: string | null; homeVisit: boolean; specializations: string;
  languages: string; certifications: string; reviewStatus: string;
  createdAt: Date; updatedAt: Date;
  links?: Array<{ id: string; status: string; practice: { id: string; name: string; city: string; address: string | null; phone: string | null; hours: string | null; lat: number; lng: number; reviewStatus: string; createdAt: Date; updatedAt: Date } }>;
}) {
  return {
    id: t.id, email: t.email, fullName: t.fullName,
    professionalTitle: t.professionalTitle, city: t.city,
    bio: t.bio ?? undefined, homeVisit: t.homeVisit,
    specializations: splitList(t.specializations),
    languages: splitList(t.languages),
    certifications: splitList(t.certifications),
    reviewStatus: t.reviewStatus,
    createdAt: t.createdAt.toISOString(),
    links: t.links?.map((l) => ({ id: l.id, status: l.status, practice: mapPractice(l.practice) })),
  };
}

function mapPractice(p: {
  id: string; name: string; city: string; address: string | null;
  phone: string | null; hours: string | null; lat: number; lng: number; reviewStatus: string;
  createdAt: Date; updatedAt: Date;
  links?: Array<{ id: string; status: string; therapist: { id: string; fullName: string; professionalTitle: string } }>;
}) {
  return {
    id: p.id, name: p.name, city: p.city,
    address: p.address ?? undefined, phone: p.phone ?? undefined,
    hours: p.hours ?? undefined,
    lat: p.lat, lng: p.lng, reviewStatus: p.reviewStatus,
    createdAt: p.createdAt.toISOString(),
    links: p.links?.map((l) => ({
      id: l.id, status: l.status,
      therapist: { id: l.therapist.id, fullName: l.therapist.fullName, professionalTitle: l.therapist.professionalTitle },
    })),
  };
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const env = getEnv();

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabedaten');

    if (parsed.data.email !== env.REVIO_ADMIN_EMAIL || parsed.data.password !== env.REVIO_ADMIN_PASSWORD) {
      return reply.unauthorized('Ungültige Zugangsdaten');
    }

    return {
      token: env.REVIO_ADMIN_TOKEN,
      admin: {
        email: env.REVIO_ADMIN_EMAIL,
        name: 'Revio Admin',
        role: 'Super Admin',
      },
    };
  });

  fastify.addHook('onRequest', async (request, reply) => {
    const pathname = request.url.split('?')[0];
    if (pathname === '/login' || pathname === '/admin/login') return;
    return fastify.verifyAdmin(request, reply);
  });

  // Visibility issues: always returns empty since APPROVED therapists are always visible
  fastify.get('/visibility-issues', async () => {
    return { count: 0, issues: [] };
  });

  // Stats
  fastify.get('/stats', async () => {
    const [tCounts, pCounts, lCounts] = await Promise.all([
      fastify.prisma.therapist.groupBy({ by: ['reviewStatus'], _count: true }),
      fastify.prisma.practice.groupBy({ by: ['reviewStatus'], _count: true }),
      fastify.prisma.therapistPracticeLink.groupBy({ by: ['status'], _count: true }),
    ]);
    const tMap = Object.fromEntries(tCounts.map((r) => [r.reviewStatus, r._count]));
    const pMap = Object.fromEntries(pCounts.map((r) => [r.reviewStatus, r._count]));
    const lMap = Object.fromEntries(lCounts.map((r) => [r.status, r._count]));
    return {
      therapists: { draft: tMap['DRAFT'] ?? 0, pending_review: tMap['PENDING_REVIEW'] ?? 0, approved: tMap['APPROVED'] ?? 0, rejected: tMap['REJECTED'] ?? 0, changes_requested: tMap['CHANGES_REQUESTED'] ?? 0, suspended: tMap['SUSPENDED'] ?? 0 },
      practices: { draft: pMap['DRAFT'] ?? 0, pending_review: pMap['PENDING_REVIEW'] ?? 0, approved: pMap['APPROVED'] ?? 0, rejected: pMap['REJECTED'] ?? 0, changes_requested: pMap['CHANGES_REQUESTED'] ?? 0, suspended: pMap['SUSPENDED'] ?? 0 },
      links: { proposed: lMap['PROPOSED'] ?? 0, confirmed: lMap['CONFIRMED'] ?? 0, disputed: lMap['DISPUTED'] ?? 0, rejected: lMap['REJECTED'] ?? 0 },
    };
  });

  // Therapists
  fastify.get('/therapists', async (request) => {
    const { status } = request.query as { status?: string };
    const therapists = await fastify.prisma.therapist.findMany({
      where: status ? { reviewStatus: status as never } : undefined,
      include: { links: { include: { practice: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return therapists.map(mapTherapist);
  });

  fastify.get('/therapists/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const therapist = await fastify.prisma.therapist.findUnique({ where: { id }, include: { links: { include: { practice: true } } } });
    if (!therapist) return reply.notFound('Therapist not found');
    return mapTherapist(therapist);
  });

  fastify.post('/therapists/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const t = await fastify.prisma.therapist.update({
      where: { id },
      data: { reviewStatus: 'APPROVED' },
      include: { links: { include: { practice: true } } },
    }).catch(() => null);
    if (!t) return reply.notFound('Therapist not found');

    // Cascade: approve PENDING_REVIEW practices and PROPOSED links for this therapist
    const practiceIds = t.links.map((l) => l.practiceId);
    const [updatedPractices, updatedLinks] = await Promise.all([
      fastify.prisma.practice.updateMany({
        where: { id: { in: practiceIds }, reviewStatus: { in: ['PENDING_REVIEW', 'DRAFT'] } },
        data: { reviewStatus: 'APPROVED' },
      }),
      fastify.prisma.therapistPracticeLink.updateMany({
        where: { therapistId: id, status: 'PROPOSED' },
        data: { status: 'CONFIRMED' },
      }),
    ]);

    return {
      message: 'Therapeut freigegeben.',
      sideEffects: {
        practicesApproved: updatedPractices.count,
        linksConfirmed: updatedLinks.count,
      },
    };
  });

  fastify.post('/therapists/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const t = await fastify.prisma.therapist.update({ where: { id }, data: { reviewStatus: 'REJECTED' } }).catch(() => null);
    if (!t) return reply.notFound('Therapist not found');
    return { message: 'Therapist rejected.' };
  });

  fastify.post('/therapists/:id/request-changes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const t = await fastify.prisma.therapist.update({ where: { id }, data: { reviewStatus: 'CHANGES_REQUESTED' } }).catch(() => null);
    if (!t) return reply.notFound('Therapist not found');
    return { message: 'Changes requested.' };
  });

  fastify.post('/therapists/:id/suspend', async (request, reply) => {
    const { id } = request.params as { id: string };
    const t = await fastify.prisma.therapist.update({ where: { id }, data: { reviewStatus: 'SUSPENDED' } }).catch(() => null);
    if (!t) return reply.notFound('Therapist not found');
    return { message: 'Therapist suspended.' };
  });

  // Practices
  fastify.get('/practices', async (request) => {
    const { status } = request.query as { status?: string };
    const practices = await fastify.prisma.practice.findMany({
      where: status ? { reviewStatus: status as never } : undefined,
      include: { links: { include: { therapist: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return practices.map(mapPractice);
  });

  fastify.get('/practices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const practice = await fastify.prisma.practice.findUnique({ where: { id }, include: { links: { include: { therapist: true } } } });
    if (!practice) return reply.notFound('Practice not found');
    return mapPractice(practice);
  });

  fastify.post('/practices/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const p = await fastify.prisma.practice.update({ where: { id }, data: { reviewStatus: 'APPROVED' } }).catch(() => null);
    if (!p) return reply.notFound('Practice not found');
    return { message: 'Practice approved.' };
  });

  fastify.post('/practices/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const p = await fastify.prisma.practice.update({ where: { id }, data: { reviewStatus: 'REJECTED' } }).catch(() => null);
    if (!p) return reply.notFound('Practice not found');
    return { message: 'Practice rejected.' };
  });

  fastify.post('/practices/:id/suspend', async (request, reply) => {
    const { id } = request.params as { id: string };
    const p = await fastify.prisma.practice.update({ where: { id }, data: { reviewStatus: 'SUSPENDED' } }).catch(() => null);
    if (!p) return reply.notFound('Practice not found');
    return { message: 'Practice suspended.' };
  });

  // Links
  fastify.get('/links', async (request) => {
    const { status } = request.query as { status?: string };
    const links = await fastify.prisma.therapistPracticeLink.findMany({
      where: status ? { status: status as never } : undefined,
      include: {
        therapist: { select: { id: true, fullName: true, professionalTitle: true } },
        practice: { select: { id: true, name: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((l) => ({
      id: l.id, therapistId: l.therapistId, practiceId: l.practiceId,
      status: l.status, createdAt: l.createdAt.toISOString(),
      therapist: l.therapist, practice: l.practice,
    }));
  });

  fastify.post('/links/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const l = await fastify.prisma.therapistPracticeLink.update({ where: { id }, data: { status: 'CONFIRMED' } }).catch(() => null);
    if (!l) return reply.notFound('Link not found');
    return { message: 'Link confirmed.' };
  });

  fastify.post('/links/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const l = await fastify.prisma.therapistPracticeLink.update({ where: { id }, data: { status: 'REJECTED' } }).catch(() => null);
    if (!l) return reply.notFound('Link not found');
    return { message: 'Link rejected.' };
  });

  fastify.post('/links/:id/dispute', async (request, reply) => {
    const { id } = request.params as { id: string };
    const l = await fastify.prisma.therapistPracticeLink.update({ where: { id }, data: { status: 'DISPUTED' } }).catch(() => null);
    if (!l) return reply.notFound('Link not found');
    return { message: 'Link disputed.' };
  });
};
