import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createReadStream, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { getEnv } from '../env.js';
import { geocodeAddress } from '../utils/geocode.js';
import { tryEnsurePracticeLogoAsset } from '../../prisma/practice-logo.js';
import { getTherapistPublicationState } from '../utils/profile-completeness.js';
import { sendProfileApprovedEmail, sendProfileRejectedEmail, sendProfileChangesRequestedEmail } from '../utils/mailer.js';
import { sendPushNotification } from '../utils/push.js';
import { ensureDefaultCertificationOptions } from '../utils/certification-options.js';
import { getPublicSiteSettings, setBooleanAppSetting, SITE_UNDER_CONSTRUCTION_KEY } from '../utils/app-settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCUMENTS_DIR = join(__dirname, '../../../documents');

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

type TherapistRow = {
  id: string; email: string; fullName: string; professionalTitle: string;
  city: string; bio: string | null; homeVisit: boolean; specializations: string;
  languages: string; certifications: string; reviewStatus: string;
  serviceRadiusKm: number | null; kassenart: string;
  isVisible: boolean; isPublished: boolean; onboardingStatus: string | null;
  createdAt: Date; updatedAt: Date;
  links?: Array<{ id: string; status: string; practice: { id: string; name: string; city: string; address: string | null; phone: string | null; hours: string | null; lat: number; lng: number; reviewStatus: string; createdAt: Date; updatedAt: Date } }>;
};

function computeVisibility(t: TherapistRow) {
  if (t.reviewStatus !== 'APPROVED') {
    return { visibilityState: 'not_approved' as const, publicSearchEligible: false, blockingReasons: [] };
  }

  const pubState = getTherapistPublicationState(t, { links: t.links });
  // pubState.blockingReasons already includes: manually_hidden, no_home_visit,
  // no_service_radius, no_kassenart, no_confirmed_practice_link
  const blockingReasons: string[] = [...(pubState.blockingReasons ?? [])];

  if (!pubState.publicSearchEligible && pubState.complete === false) {
    blockingReasons.push('profile_incomplete');
  }

  const requiresExplicitPublication =
    t.onboardingStatus === 'manager_onboarding' ||
    t.onboardingStatus === 'invited' ||
    t.onboardingStatus === 'claimed';
  if (requiresExplicitPublication && !t.isPublished) blockingReasons.push('publication_missing');

  // Deduplicate and remove internal 'not_approved' (handled by outer check)
  const uniqueReasons = [...new Set(blockingReasons.filter(r => r !== 'not_approved'))];

  return {
    visibilityState: uniqueReasons.length === 0 ? 'visible' as const : 'blocked' as const,
    publicSearchEligible: uniqueReasons.length === 0,
    blockingReasons: uniqueReasons,
  };
}

function mapTherapist(t: TherapistRow) {
  return {
    id: t.id, email: t.email, fullName: t.fullName,
    professionalTitle: t.professionalTitle, city: t.city,
    bio: t.bio ?? undefined, homeVisit: t.homeVisit,
    serviceRadiusKm: t.serviceRadiusKm ?? undefined,
    kassenart: t.kassenart,
    specializations: splitList(t.specializations),
    languages: splitList(t.languages),
    certifications: splitList(t.certifications),
    reviewStatus: t.reviewStatus,
    isVisible: t.isVisible,
    isPublished: t.isPublished,
    onboardingStatus: t.onboardingStatus,
    createdAt: t.createdAt.toISOString(),
    links: t.links?.map((l) => ({ id: l.id, status: l.status, practice: mapPractice(l.practice) })),
    visibility: computeVisibility(t),
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
  const certificationSchema = z.object({
    label: z.string().trim().min(2),
  });
  const siteSettingsSchema = z.object({
    underConstruction: z.boolean(),
  });

  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabedaten');

    const passwordMatch = parsed.data.password.trim() === env.REVIO_ADMIN_PASSWORD;
    const tokenMatch = parsed.data.password.trim() === env.REVIO_ADMIN_TOKEN;
    const emailMatch = parsed.data.email.trim() === env.REVIO_ADMIN_EMAIL;
    // Accept: correct email+password, OR correct email+token, OR just token (any email)
    const authorized = tokenMatch || (emailMatch && passwordMatch);
    if (!authorized) {
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

  fastify.get('/me', async () => {
    return {
      admin: {
        email: env.REVIO_ADMIN_EMAIL,
        name: 'Revio Admin',
        role: 'Super Admin',
      },
    };
  });

  fastify.get('/site-settings', async () => {
    return getPublicSiteSettings(fastify.prisma);
  });

  fastify.post('/site-settings/update', async (request, reply) => {
    const parsed = siteSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabedaten');

    await setBooleanAppSetting(
      fastify.prisma,
      SITE_UNDER_CONSTRUCTION_KEY,
      parsed.data.underConstruction,
    );

    return {
      success: true,
      underConstruction: parsed.data.underConstruction,
    };
  });

  fastify.get('/certifications', async () => {
    await ensureDefaultCertificationOptions(fastify.prisma);

    const certifications = await fastify.prisma.certificationOption.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });

    return {
      certifications: certifications.map((option) => ({
        id: option.id,
        key: option.key,
        label: option.label,
        isActive: option.isActive,
        sortOrder: option.sortOrder,
      })),
    };
  });

  fastify.post('/certifications', async (request, reply) => {
    await ensureDefaultCertificationOptions(fastify.prisma);

    const parsed = certificationSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabedaten');

    const label = parsed.data.label;
    const existing = await fastify.prisma.certificationOption.findFirst({
      where: {
        OR: [{ key: label }, { label }],
      },
    });
    if (existing) return reply.conflict('Diese Fortbildung existiert bereits');

    const maxSortOrder = await fastify.prisma.certificationOption.aggregate({
      _max: { sortOrder: true },
    });

    const option = await fastify.prisma.certificationOption.create({
      data: {
        key: label,
        label,
        isActive: true,
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 10,
      },
    });

    return reply.status(201).send({
      id: option.id,
      key: option.key,
      label: option.label,
      isActive: option.isActive,
      sortOrder: option.sortOrder,
    });
  });

  fastify.post('/certifications/:id/update', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = certificationSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabedaten');

    const existing = await fastify.prisma.certificationOption.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Fortbildung nicht gefunden');

    const label = parsed.data.label;
    const duplicate = await fastify.prisma.certificationOption.findFirst({
      where: {
        id: { not: id },
        OR: [{ key: label }, { label }],
      },
    });
    if (duplicate) return reply.conflict('Diese Fortbildung existiert bereits');

    const option = await fastify.prisma.certificationOption.update({
      where: { id },
      data: { label },
    });

    return {
      id: option.id,
      key: option.key,
      label: option.label,
      isActive: option.isActive,
      sortOrder: option.sortOrder,
    };
  });

  fastify.post('/certifications/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.certificationOption.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Fortbildung nicht gefunden');

    const option = await fastify.prisma.certificationOption.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return {
      id: option.id,
      key: option.key,
      label: option.label,
      isActive: option.isActive,
      sortOrder: option.sortOrder,
    };
  });

  fastify.post('/certifications/:id/delete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.certificationOption.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Fortbildung nicht gefunden');

    await fastify.prisma.certificationOption.delete({ where: { id } });
    return { success: true };
  });

  // Visibility issues: APPROVED therapists who are not publicly visible
  fastify.get('/visibility-issues', async () => {
    const therapists = await fastify.prisma.therapist.findMany({
      where: { reviewStatus: 'APPROVED' },
      include: {
        links: {
          include: { practice: { select: { id: true, name: true, reviewStatus: true } } },
        },
      },
    });

    const issues: Array<{
      therapistId: string;
      therapistName: string;
      email: string;
      reason: string;
      detail: string;
      linkedPractices: Array<{ id: string; name: string; status: string; reviewStatus: string }>;
    }> = [];

    for (const t of therapists) {
      const pubState = getTherapistPublicationState(t, { links: t.links });
      const confirmedLinks = t.links.filter((l) => l.status === 'CONFIRMED');
      const linkedPractices = t.links.map((l) => ({
        id: l.practice.id,
        name: l.practice.name,
        status: l.status,
        reviewStatus: l.practice.reviewStatus,
      }));

      if (!pubState.publicSearchEligible) {
        let reason = 'publication_incomplete';
        let detail = `Missing fields: ${pubState.missingFields.join(', ') || 'none'}; isVisible=${t.isVisible}; isPublished=${t.isPublished}; onboardingStatus=${t.onboardingStatus}`;
        issues.push({ therapistId: t.id, therapistName: t.fullName, email: t.email, reason, detail, linkedPractices });
        continue;
      }

      // publicSearchEligible is true — check practice links
      if (confirmedLinks.length === 0) {
        const hasProposed = t.links.some((l) => l.status === 'PROPOSED' || l.status === 'DISPUTED');
        const reason = hasProposed ? 'pending_link_only' : 'no_confirmed_link';
        const detail = hasProposed
          ? `Has ${t.links.filter((l) => l.status === 'PROPOSED' || l.status === 'DISPUTED').length} pending/disputed link(s), none confirmed`
          : 'No practice links at all';
        issues.push({ therapistId: t.id, therapistName: t.fullName, email: t.email, reason, detail, linkedPractices });
      } else {
        const unapprovedPractices = confirmedLinks.filter((l) => l.practice.reviewStatus !== 'APPROVED');
        if (unapprovedPractices.length > 0 && confirmedLinks.every((l) => l.practice.reviewStatus !== 'APPROVED')) {
          issues.push({
            therapistId: t.id,
            therapistName: t.fullName,
            email: t.email,
            reason: 'confirmed_link_practice_not_approved',
            detail: `All confirmed practices have non-APPROVED status: ${unapprovedPractices.map((l) => `${l.practice.name} (${l.practice.reviewStatus})`).join(', ')}`,
            linkedPractices,
          });
        }
      }
    }

    return { count: issues.length, issues };
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

    sendProfileApprovedEmail({ to: t.email, name: t.fullName }).catch((err) =>
      fastify.log.error({ err }, 'Failed to send profile approved email'),
    );

    if (t.expoPushToken) {
      sendPushNotification(
        t.expoPushToken,
        '🎉 Profil freigegeben!',
        'Dein Revio-Profil wurde vom Admin bestätigt. Du bist jetzt sichtbar.',
        { type: 'profile_approved' },
      ).catch(() => {});
    }

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

    sendProfileRejectedEmail({ to: t.email, name: t.fullName }).catch((err) =>
      fastify.log.error({ err }, 'Failed to send profile rejected email'),
    );

    return { message: 'Therapist rejected.' };
  });

  fastify.post('/therapists/:id/request-changes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const t = await fastify.prisma.therapist.update({ where: { id }, data: { reviewStatus: 'CHANGES_REQUESTED' } }).catch(() => null);
    if (!t) return reply.notFound('Therapist not found');

    sendProfileChangesRequestedEmail({ to: t.email, name: t.fullName }).catch((err) =>
      fastify.log.error({ err }, 'Failed to send profile changes-requested email'),
    );

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

  // Managers
  fastify.get('/managers', async () => {
    const managers = await fastify.prisma.practiceManager.findMany({
      include: {
        assignments: { include: { practice: { select: { id: true, name: true, city: true, reviewStatus: true } } }, take: 1 },
        therapist: { select: { id: true, fullName: true, email: true, reviewStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { managers: managers.map(m => ({ ...m, practice: m.assignments[0]?.practice ?? null })) };
  });

  // POST /admin/practices/geocode-all — geocode all practices with lat=0 lng=0
  fastify.post('/practices/geocode-all', async (_request, reply) => {
    const practices = await fastify.prisma.practice.findMany({
      where: { lat: 0, lng: 0 },
    });

    let updated = 0;
    let failed = 0;

    for (const p of practices) {
      // Nominatim rate limit: 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));
      const geo = await geocodeAddress(p.address ?? '', p.city);
      if (geo) {
        await fastify.prisma.practice.update({
          where: { id: p.id },
          data: { lat: geo.lat, lng: geo.lng },
        });
        updated++;
      } else {
        failed++;
      }
    }

    return { total: practices.length, updated, failed };
  });

  // POST /admin/practices/regenerate-logos — regenerate all managed practice logos on disk
  fastify.post('/practices/regenerate-logos', async (_request, _reply) => {
    const practices = await fastify.prisma.practice.findMany();
    let regenerated = 0;
    let failed = 0;

    for (const p of practices) {
      const result = tryEnsurePracticeLogoAsset(p.name, p.city);
      if (result) {
        await fastify.prisma.practice.update({
          where: { id: p.id },
          data: { logo: result },
        });
        regenerated++;
      } else {
        failed++;
      }
    }

    return { total: practices.length, regenerated, failed };
  });

  // Documents
  fastify.get('/therapists/:id/documents', async (request, reply) => {
    const { id } = request.params as { id: string };
    const therapist = await fastify.prisma.therapist.findUnique({ where: { id } });
    if (!therapist) return reply.notFound('Therapist not found');

    const docs = await fastify.prisma.therapistDocument.findMany({
      where: { therapistId: id },
      orderBy: { uploadedAt: 'desc' },
    });

    return docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      originalName: d.originalName,
      mimetype: d.mimetype,
      uploadedAt: d.uploadedAt.toISOString(),
    }));
  });

  // Serve a document file — admin-only (verifyAdmin hook covers this route)
  fastify.get('/documents/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };

    // Prevent path traversal: only allow plain filenames (no slashes, no dots leading path)
    if (!/^[a-f0-9]{32}\.(pdf|jpg|png|webp)$/.test(filename)) {
      return reply.badRequest('Ungültiger Dateiname');
    }

    const filepath = join(DOCUMENTS_DIR, filename);
    if (!existsSync(filepath)) return reply.notFound('Datei nicht gefunden');

    // Verify the file is actually tracked in the DB (no orphan access)
    const doc = await fastify.prisma.therapistDocument.findFirst({ where: { filename } });
    if (!doc) return reply.notFound('Datei nicht gefunden');

    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const ext = filename.split('.').pop() ?? '';
    const contentType = mimeMap[ext] ?? 'application/octet-stream';

    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `inline; filename="${doc.originalName}"`);
    return reply.send(createReadStream(filepath));
  });
};
