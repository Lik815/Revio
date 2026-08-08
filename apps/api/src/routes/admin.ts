import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hashPassword } from './auth-utils.js';
import { createReadStream, existsSync } from 'fs';
import { join, basename } from 'path';
import { getEnv } from '../env.js';
import { THERAPIST_VERIFICATIONS_DIR } from '../utils/storage-paths.js';
import { geocodeAddress } from '../utils/geocode.js';
import { serializeKassenarten } from '../utils/kassenarten.js';
import { getTherapistPublicationState, getTherapistRequestabilityState } from '../utils/profile-completeness.js';
import { resetSearchCache } from './search.js';
import { sendProfileApprovedEmail, sendProfileRejectedEmail, sendProfileChangesRequestedEmail } from '../utils/mailer.js';
import { sendPushNotification } from '../utils/push.js';
import { notify } from '../utils/notify.js';
import { ensureDefaultCertificationOptions } from '../utils/certification-options.js';
import { ensureDefaultHeilmittelOptions } from '../utils/heilmittel-options.js';
import {
  createSpecializationKey,
  ensureDefaultSpecializationOptions,
  getDefaultSpecializationOptions,
  isSpecializationOptionStorageError,
} from '../utils/specialization-options.js';
import { getPublicSiteSettings, setBooleanAppSetting, SITE_UNDER_CONSTRUCTION_KEY, APP_BOOKING_ENABLED_KEY } from '../utils/app-settings.js';


const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

type TherapistRow = {
  id: string; email: string; fullName: string; professionalTitle: string;
  city: string; bio: string | null; homeVisit: boolean; specializations: string;
  isFreelancer: boolean; userId?: string | null;
  languages: string; certifications: string; reviewStatus: string;
  employmentStatus?: string | null;
  serviceRadiusKm: number | null; kassenart: string;
  isVisible: boolean; isPublished: boolean;
  bookingMode?: string | null; nextFreeSlotAt?: Date | null;
  qualifikationenStatus?: string | null; qualifikationenVerifiziertAt?: Date | null;
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
    // Directory-First-Refactor: null = unbeansprucht, im Admin-Bereich bearbeitbar.
    userId: t.userId ?? null,
    professionalTitle: t.professionalTitle, city: t.city,
    bio: t.bio ?? undefined, homeVisit: t.homeVisit,
    isFreelancer: t.isFreelancer,
    serviceRadiusKm: t.serviceRadiusKm ?? undefined,
    kassenart: t.kassenart,
    specializations: splitList(t.specializations),
    languages: splitList(t.languages),
    certifications: splitList(t.certifications),
    reviewStatus: t.reviewStatus,
    employmentStatus: t.employmentStatus ?? 'SELF_EMPLOYED',
    isVisible: t.isVisible,
    isPublished: t.isPublished,
    createdAt: t.createdAt.toISOString(),
    links: t.links?.map((l) => ({ id: l.id, status: l.status, practice: mapPractice(l.practice) })),
    visibility: computeVisibility(t),
    bookingMode: t.bookingMode ?? 'DIRECTORY_ONLY',
    nextFreeSlotAt: t.nextFreeSlotAt?.toISOString() ?? null,
    requestability: getTherapistRequestabilityState(t, { links: t.links }),
    qualifikationenStatus: t.qualifikationenStatus ?? 'UNGEPRÜFT',
    qualifikationenVerifiziertAt: t.qualifikationenVerifiziertAt?.toISOString() ?? null,
  };
}

function mapPractice(p: {
  id: string; name: string; city: string; address: string | null;
  phone: string | null; hours: string | null; description?: string | null; homeVisit?: boolean;
  lat: number; lng: number; reviewStatus: string; ownerId?: string | null;
  createdAt: Date; updatedAt: Date;
  links?: Array<{ id: string; status: string; therapist: { id: string; fullName: string; professionalTitle: string } }>;
}) {
  return {
    id: p.id, name: p.name, city: p.city,
    address: p.address ?? undefined, phone: p.phone ?? undefined,
    hours: p.hours ?? undefined,
    description: p.description ?? undefined, homeVisit: p.homeVisit ?? false,
    lat: p.lat, lng: p.lng, reviewStatus: p.reviewStatus,
    // Directory-First-Refactor (P2): null = unbeansprucht, im Admin-Bereich frei bearbeitbar.
    ownerId: p.ownerId ?? null,
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
  const heilmittelSchema = z.object({
    label: z.string().trim().min(2),
  });
  const specializationSchema = z.object({
    label: z.string().trim().min(2).max(100),
  });
  const siteSettingsSchema = z.object({
    underConstruction: z.boolean().optional(),
    appBookingEnabled: z.boolean().optional(),
  });
  const blogPostSchema = z.object({
    slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, 'Ungültiger Slug'),
    title: z.string().trim().min(4).max(180),
    excerpt: z.string().trim().min(12).max(320),
    content: z.string().trim().min(30),
    authorName: z.string().trim().min(2).max(80).default('Revio Team'),
  });
  const appFeedbackStatusSchema = z.object({
    status: z.enum(['NEW', 'RESOLVED']),
  });

  const mapAppFeedback = (feedback: {
    id: string;
    userId: string | null;
    email: string;
    message: string;
    status: 'NEW' | 'RESOLVED';
    isAuthenticated: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) => ({
    id: feedback.id,
    userId: feedback.userId,
    email: feedback.email,
    message: feedback.message,
    status: feedback.status,
    isAuthenticated: feedback.isAuthenticated,
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString(),
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

  fastify.get('/feedback', async () => {
    const items = await fastify.prisma.appFeedback.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return items.map(mapAppFeedback);
  });

  fastify.post('/feedback/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = appFeedbackStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const updated = await fastify.prisma.appFeedback.update({
      where: { id },
      data: { status: parsed.data.status },
    }).catch(() => null);

    if (!updated) return reply.notFound('Feedback nicht gefunden');

    return {
      feedback: mapAppFeedback(updated),
    };
  });

  fastify.post('/site-settings/update', async (request, reply) => {
    const parsed = siteSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabedaten');

    // Alle Schalter sind unabhängig — nur das jeweils mitgeschickte Feld wird gesetzt.
    if (parsed.data.underConstruction !== undefined) {
      await setBooleanAppSetting(
        fastify.prisma,
        SITE_UNDER_CONSTRUCTION_KEY,
        parsed.data.underConstruction,
      );
    }
    if (parsed.data.appBookingEnabled !== undefined) {
      await setBooleanAppSetting(
        fastify.prisma,
        APP_BOOKING_ENABLED_KEY,
        parsed.data.appBookingEnabled,
      );
    }

    return {
      success: true,
      ...(await getPublicSiteSettings(fastify.prisma)),
    };
  });

  fastify.get('/blog-posts', async () => {
    const posts = await fastify.prisma.blogPost.findMany({
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    });

    return posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      authorName: post.authorName,
      isPublished: post.isPublished,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));
  });

  fastify.post('/blog-posts', async (request, reply) => {
    const parsed = blogPostSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const existing = await fastify.prisma.blogPost.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (existing) return reply.conflict('Ein Blogpost mit diesem Slug existiert bereits');

    const post = await fastify.prisma.blogPost.create({
      data: parsed.data,
    });

    return reply.status(201).send({
      id: post.id,
      slug: post.slug,
      title: post.title,
      isPublished: post.isPublished,
    });
  });

  fastify.post('/blog-posts/:id/update', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = blogPostSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const existing = await fastify.prisma.blogPost.findFirst({
      where: { id: { not: id }, slug: parsed.data.slug },
    });
    if (existing) return reply.conflict('Ein Blogpost mit diesem Slug existiert bereits');

    const post = await fastify.prisma.blogPost.update({
      where: { id },
      data: parsed.data,
    }).catch(() => null);
    if (!post) return reply.notFound('Blogpost nicht gefunden');

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      isPublished: post.isPublished,
    };
  });

  fastify.post('/blog-posts/:id/toggle-publish', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Blogpost nicht gefunden');

    const nextPublished = !existing.isPublished;
    const post = await fastify.prisma.blogPost.update({
      where: { id },
      data: {
        isPublished: nextPublished,
        publishedAt: nextPublished ? (existing.publishedAt ?? new Date()) : null,
      },
    });

    return {
      id: post.id,
      isPublished: post.isPublished,
      publishedAt: post.publishedAt?.toISOString() ?? null,
    };
  });

  fastify.post('/blog-posts/:id/delete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await fastify.prisma.blogPost.delete({ where: { id } }).catch(() => null);
    if (!deleted) return reply.notFound('Blogpost nicht gefunden');
    return { success: true };
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

  fastify.get('/heilmittel', async () => {
    await ensureDefaultHeilmittelOptions(fastify.prisma);

    const heilmittel = await fastify.prisma.heilmittelOption.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });

    return {
      heilmittel: heilmittel.map((option) => ({
        id: option.id,
        key: option.key,
        label: option.label,
        isActive: option.isActive,
        sortOrder: option.sortOrder,
      })),
    };
  });

  fastify.post('/heilmittel', async (request, reply) => {
    await ensureDefaultHeilmittelOptions(fastify.prisma);

    const parsed = heilmittelSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabedaten');

    const label = parsed.data.label;
    const existing = await fastify.prisma.heilmittelOption.findFirst({
      where: {
        OR: [{ key: label }, { label }],
      },
    });
    if (existing) return reply.conflict('Dieses Heilmittel existiert bereits');

    const maxSortOrder = await fastify.prisma.heilmittelOption.aggregate({
      _max: { sortOrder: true },
    });

    const option = await fastify.prisma.heilmittelOption.create({
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

  fastify.post('/heilmittel/:id/update', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = heilmittelSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabedaten');

    const existing = await fastify.prisma.heilmittelOption.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Heilmittel nicht gefunden');

    const label = parsed.data.label;
    const duplicate = await fastify.prisma.heilmittelOption.findFirst({
      where: {
        id: { not: id },
        OR: [{ key: label }, { label }],
      },
    });
    if (duplicate) return reply.conflict('Dieses Heilmittel existiert bereits');

    const option = await fastify.prisma.heilmittelOption.update({
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

  fastify.post('/heilmittel/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.heilmittelOption.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Heilmittel nicht gefunden');

    const option = await fastify.prisma.heilmittelOption.update({
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

  fastify.post('/heilmittel/:id/delete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.heilmittelOption.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Heilmittel nicht gefunden');

    await fastify.prisma.heilmittelOption.delete({ where: { id } });
    return { success: true };
  });

  const getSpecializationUsageCounts = async (labels: string[]) => {
    const therapists = await fastify.prisma.therapist.findMany({
      select: { specializations: true },
    });

    const counts = new Map(labels.map((label) => [label, 0]));
    for (const therapist of therapists) {
      for (const label of new Set(splitList(therapist.specializations))) {
        if (counts.has(label)) counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return counts;
  };

  const getSpecializationUsageCount = async (label: string) => {
    const counts = await getSpecializationUsageCounts([label]);
    return counts.get(label) ?? 0;
  };

  fastify.get('/specializations', async () => {
    let specializations: Array<{
      id: string;
      key: string;
      label: string;
      isActive: boolean;
      sortOrder: number;
    }>;

    try {
      await ensureDefaultSpecializationOptions(fastify.prisma);
      specializations = await fastify.prisma.specializationOption.findMany({
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      });
    } catch (error) {
      if (!isSpecializationOptionStorageError(error)) throw error;
      specializations = getDefaultSpecializationOptions().map((option) => ({
        ...option,
        id: `fallback-${option.key}`,
      }));
    }

    const usageCounts = await getSpecializationUsageCounts(
      specializations.map((option) => option.label),
    );

    return {
      specializations: specializations.map((option) => ({
        id: option.id,
        key: option.key,
        label: option.label,
        isActive: option.isActive,
        sortOrder: option.sortOrder,
        usageCount: usageCounts.get(option.label) ?? 0,
      })),
    };
  });

  fastify.post('/specializations', async (request, reply) => {
    await ensureDefaultSpecializationOptions(fastify.prisma);

    const parsed = specializationSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabedaten');

    const label = parsed.data.label;
    const key = createSpecializationKey(label);
    if (!key) return reply.badRequest('Ungültiger Schwerpunkt');

    const existing = await fastify.prisma.specializationOption.findFirst({
      where: { OR: [{ key }, { label }] },
    });
    if (existing) return reply.conflict('Dieser Schwerpunkt existiert bereits');

    const maxSortOrder = await fastify.prisma.specializationOption.aggregate({
      _max: { sortOrder: true },
    });
    const option = await fastify.prisma.specializationOption.create({
      data: {
        key,
        label,
        isActive: true,
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 10,
      },
    });

    return reply.status(201).send({ ...option, usageCount: 0 });
  });

  fastify.post('/specializations/:id/update', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = specializationSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültige Eingabedaten');

    const existing = await fastify.prisma.specializationOption.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Schwerpunkt nicht gefunden');

    const label = parsed.data.label;
    if (label !== existing.label && await getSpecializationUsageCount(existing.label) > 0) {
      return reply.conflict(
        'Verwendete Schwerpunkte können nicht umbenannt werden. Deaktiviere den Eintrag und lege einen neuen an.',
      );
    }

    const key = createSpecializationKey(label);
    const duplicate = await fastify.prisma.specializationOption.findFirst({
      where: { id: { not: id }, OR: [{ key }, { label }] },
    });
    if (duplicate) return reply.conflict('Dieser Schwerpunkt existiert bereits');

    const option = await fastify.prisma.specializationOption.update({
      where: { id },
      data: { key, label },
    });

    return { ...option, usageCount: 0 };
  });

  fastify.post('/specializations/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.specializationOption.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Schwerpunkt nicht gefunden');

    const option = await fastify.prisma.specializationOption.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return {
      ...option,
      usageCount: await getSpecializationUsageCount(option.label),
    };
  });

  fastify.post('/specializations/:id/delete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.specializationOption.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Schwerpunkt nicht gefunden');

    if (await getSpecializationUsageCount(existing.label) > 0) {
      return reply.conflict('Dieser Schwerpunkt wird verwendet und kann nur deaktiviert werden');
    }

    await fastify.prisma.specializationOption.delete({ where: { id } });
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
        let detail = `Missing fields: ${pubState.missingFields.join(', ') || 'none'}; isVisible=${t.isVisible}; isPublished=${t.isPublished}`;
        issues.push({ therapistId: t.id, therapistName: t.fullName, email: t.email, reason, detail, linkedPractices });
        continue;
      }

      if (t.isFreelancer) {
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

  const createTherapistSchema = z.object({
    email: z.string().email(),
    fullName: z.string().trim().min(1),
    city: z.string().trim().min(1),
    consentChannel: z.string().trim().min(1),
    consentNote: z.string().trim().optional(),
    // Vollständige Profildaten (optional) — Operator kann sie direkt beim
    // Anlegen mitgeben, statt sie später einzeln nachzupflegen.
    professionalTitle: z.string().trim().optional(),
    gender: z.enum(['female', 'male']).optional(),
    bio: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    street: z.string().trim().optional(),
    houseNumber: z.string().trim().optional(),
    homeVisit: z.boolean().optional(),
    serviceRadiusKm: z.number().min(1).max(200).nullable().optional(),
    specializations: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
    heilmittel: z.array(z.string()).optional(),
    kassenarten: z.array(z.string()).optional(),
  });

  // Directory-First-Refactor (R1): Operator legt ein Therapeuten-Profil an —
  // nur mit dokumentierter Zustimmung (Pflichtfelder), da das im Unterschied
  // zu Praxen personenbezogene Daten einer Einzelperson sind. userId bleibt
  // null (unbeansprucht) — claimbar über die normale Registrierung, siehe den
  // Platzhalter-Check in register.ts. Bewusst PENDING_REVIEW statt LISTED:
  // Zustimmung allein ersetzt keine berufliche Verifizierung.
  fastify.post('/therapists/create', async (request, reply) => {
    const parsed = createTherapistSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      return reply.badRequest(Object.entries(msg).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') || 'Ungültige Eingabe');
    }
    const data = parsed.data;
    const email = data.email.trim().toLowerCase();

    const existingTherapist = await fastify.prisma.therapist.findUnique({ where: { email } });
    if (existingTherapist) return reply.conflict('Diese E-Mail-Adresse ist bereits vergeben.');
    const existingUser = await fastify.prisma.user.findUnique({ where: { email } });
    if (existingUser) return reply.conflict('Diese E-Mail-Adresse ist bereits vergeben.');

    // Adresse geocoden (best-effort, blockiert das Anlegen nie) — wie bei der
    // Selbstregistrierung, damit die Karte den Therapeuten verorten kann.
    const streetPart = [data.street, data.houseNumber].filter(Boolean).join(' ');
    const cityPart = [data.postalCode, data.city].filter(Boolean).join(' ');
    const coords = (data.street && data.city)
      ? await geocodeAddress(streetPart, cityPart)
      : await geocodeAddress('', cityPart || data.city);

    const languages = data.languages && data.languages.length > 0 ? data.languages : ['de'];

    const created = await fastify.prisma.therapist.create({
      data: {
        email,
        fullName: data.fullName,
        professionalTitle: data.professionalTitle?.trim() || 'Physiotherapeut',
        city: data.city,
        gender: data.gender ?? null,
        bio: data.bio || null,
        phone: data.phone || null,
        postalCode: data.postalCode || null,
        street: data.street || null,
        houseNumber: data.houseNumber || null,
        ...(coords ? { homeLat: coords.lat, homeLng: coords.lng, latitude: coords.lat, longitude: coords.lng } : {}),
        homeVisit: data.homeVisit ?? false,
        serviceRadiusKm: data.serviceRadiusKm ?? null,
        specializations: (data.specializations ?? []).join(', '),
        languages: languages.join(', '),
        certifications: (data.certifications ?? []).join(', '),
        heilmittel: (data.heilmittel ?? []).join(', '),
        kassenart: serializeKassenarten(data.kassenarten),
        employmentStatus: 'SELF_EMPLOYED',
        isFreelancer: true,
        reviewStatus: 'PENDING_REVIEW',
        consentObtainedAt: new Date(),
        consentChannel: data.consentChannel,
        consentNote: data.consentNote || null,
      },
    });

    const therapist = await fastify.prisma.therapist.findUnique({
      where: { id: created.id },
      include: { links: { include: { practice: true } } },
    });

    resetSearchCache();
    return mapTherapist(therapist!);
  });

  const updateTherapistSchema = z.object({
    fullName: z.string().trim().min(1).optional(),
    professionalTitle: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    bio: z.string().trim().optional(),
  });

  // Directory-First-Refactor (Nacharbeit zu R1): Bearbeiten für einen
  // operator-angelegten Therapeuten — bisher gab es nur „Anlegen", kein
  // Bearbeiten. Nur solange userId null ist (unbeansprucht); analog zur
  // ownerId-Sperre bei Praxen.
  fastify.post('/therapists/:id/update', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateTherapistSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      return reply.badRequest(Object.entries(msg).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') || 'Ungültige Eingabe');
    }

    const existing = await fastify.prisma.therapist.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Therapist not found');
    if (existing.userId) {
      return reply.forbidden('Dieser Therapeut wurde bereits übernommen und ist nicht mehr über den Admin-Bereich bearbeitbar.');
    }

    const data = parsed.data;
    const therapist = await fastify.prisma.therapist.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.professionalTitle !== undefined && { professionalTitle: data.professionalTitle }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.bio !== undefined && { bio: data.bio }),
      },
      include: { links: { include: { practice: true } } },
    }).catch(() => null);
    if (!therapist) return reply.notFound('Therapist not found');

    resetSearchCache();
    return mapTherapist(therapist);
  });

  fastify.post('/therapists/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.therapist.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Therapist not found');
    // PREPARING profiles must never become publicly visible — block approval until
    // the therapist actively switches their employment status to self-employed.
    if ((existing as any).employmentStatus === 'PREPARING') {
      return reply.badRequest(
        'Dieses Profil ist als "in Vorbereitung" markiert und kann nicht freigegeben werden, bis der berufliche Status auf "selbstständig" geändert wird.',
      );
    }
    const t = await fastify.prisma.therapist.update({
      where: { id },
      // Approval is the publish moment — profiles register as a private DRAFT
      // (isVisible: false); approving a complete, self-employed profile makes it live.
      data: { reviewStatus: 'APPROVED', isVisible: true },
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

    // Therapist just became publicly visible — drop the cached search list so
    // they appear immediately instead of after the cache TTL.
    resetSearchCache();

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
    await notify(fastify.prisma, {
      therapistId: t.id,
      type: 'PROFILE_APPROVED',
      message: 'Dein Profil wurde freigegeben.',
      reviewStatus: 'APPROVED',
    });

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

    resetSearchCache();

    sendProfileRejectedEmail({ to: t.email, name: t.fullName }).catch((err) =>
      fastify.log.error({ err }, 'Failed to send profile rejected email'),
    );
    await notify(fastify.prisma, {
      therapistId: t.id,
      type: 'PROFILE_REJECTED',
      message: 'Dein Profil wurde aktuell nicht freigegeben.',
      reviewStatus: 'REJECTED',
    });

    return { message: 'Therapist rejected.' };
  });

  fastify.post('/therapists/:id/request-changes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const t = await fastify.prisma.therapist.update({ where: { id }, data: { reviewStatus: 'CHANGES_REQUESTED' } }).catch(() => null);
    if (!t) return reply.notFound('Therapist not found');

    resetSearchCache();

    sendProfileChangesRequestedEmail({ to: t.email, name: t.fullName }).catch((err) =>
      fastify.log.error({ err }, 'Failed to send profile changes-requested email'),
    );
    await notify(fastify.prisma, {
      therapistId: t.id,
      type: 'PROFILE_CHANGES_REQUESTED',
      message: 'Für dein Profil wurden Änderungen angefordert.',
      reviewStatus: 'CHANGES_REQUESTED',
    });

    return { message: 'Changes requested.' };
  });

  fastify.post('/therapists/:id/suspend', async (request, reply) => {
    const { id } = request.params as { id: string };
    const t = await fastify.prisma.therapist.update({ where: { id }, data: { reviewStatus: 'SUSPENDED' } }).catch(() => null);
    if (!t) return reply.notFound('Therapist not found');
    resetSearchCache();
    await notify(fastify.prisma, {
      therapistId: t.id,
      type: 'PROFILE_SUSPENDED',
      message: 'Dein Profil wurde vorübergehend pausiert.',
      reviewStatus: 'SUSPENDED',
    });

    return { message: 'Therapist suspended.' };
  });

  fastify.post('/therapists/:id/qualifikation-status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      status: z.enum(['UNGEPRÜFT', 'EINGEREICHT', 'VERIFIZIERT', 'ABGELAUFEN']),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest('Ungültiger Status');
    const now = new Date();
    const t = await fastify.prisma.therapist.update({
      where: { id },
      data: {
        qualifikationenStatus: parsed.data.status,
        qualifikationenVerifiziertAt: parsed.data.status === 'VERIFIZIERT' ? now : undefined,
      },
    }).catch(() => null);
    if (!t) return reply.notFound('Therapist not found');
    return { qualifikationenStatus: (t as any).qualifikationenStatus, qualifikationenVerifiziertAt: (t as any).qualifikationenVerifiziertAt?.toISOString() ?? null };
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

  const createPracticeSchema = z.object({
    name: z.string().trim().min(1),
    city: z.string().trim().min(1),
    address: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    hours: z.string().trim().optional(),
    description: z.string().trim().optional(),
    homeVisit: z.boolean().optional(),
  });

  // Directory-First-Refactor (P2): Operator legt eine Praxis manuell an.
  // ownerId bleibt null (unbeansprucht) bis zum ersten Claim; läuft durch die
  // bestehende PENDING_REVIEW-Warteschlange wie eine selbstregistrierte Praxis.
  fastify.post('/practices/create', async (request, reply) => {
    const parsed = createPracticeSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      return reply.badRequest(Object.entries(msg).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') || 'Ungültige Eingabe');
    }
    const data = parsed.data;
    const coords = await geocodeAddress(data.address ?? '', data.city);

    const practice = await fastify.prisma.practice.create({
      data: {
        name: data.name,
        city: data.city,
        address: data.address || null,
        phone: data.phone || null,
        hours: data.hours || null,
        description: data.description || null,
        homeVisit: data.homeVisit ?? false,
        lat: coords?.lat ?? 0,
        lng: coords?.lng ?? 0,
        // Directory-First-Refactor (P2): sofort öffentlich sichtbar als LISTED —
        // kein zusätzlicher Freigabeschritt, du bist bereits der vertrauenswürdige
        // Akteur. Unterscheidet sich bewusst von der Selbstregistrierung
        // (PENDING_REVIEW), die weiterhin manuelle Prüfung durchläuft.
        reviewStatus: 'LISTED',
      },
    });

    resetSearchCache();
    return mapPractice(practice);
  });

  const importPracticesSchema = z.object({
    practices: z.array(z.object({
      name: z.string().trim().min(1),
      city: z.string().trim().min(1),
      address: z.string().trim().optional(),
      phone: z.string().trim().optional(),
      hours: z.string().trim().optional(),
      description: z.string().trim().optional(),
      homeVisit: z.boolean().optional(),
    })).min(1).max(500),
  });

  // Directory-First-Refactor (R7): Massen-Import öffentlicher Praxisdaten für
  // eine Startregion. Läuft wie /practices/create einzeln (LISTED, ownerId
  // null), aber in einer Schleife mit Nominatim-Rate-Limit (1 req/sec, siehe
  // /practices/geocode-all) und Dubletten-Erkennung (Name+Stadt), damit ein
  // erneuter Lauf mit derselben Liste keine Duplikate anlegt.
  fastify.post('/practices/import', async (request, reply) => {
    const parsed = importPracticesSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      return reply.badRequest(Object.entries(msg).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') || 'Ungültige Eingabe');
    }

    // "mode: insensitive" ist Postgres-spezifisch und existiert auf dem
    // SQLite-Client nicht (siehe schema.prisma vs. schema.production.prisma) —
    // deshalb einmalig alle Namen/Städte laden und in JS case-insensitiv
    // vergleichen, statt einer provider-abhängigen Prisma-Funktion.
    const existingPractices = await fastify.prisma.practice.findMany({
      select: { name: true, city: true },
    });
    const existingKeys = new Set(
      existingPractices.map((p) => `${p.name.toLowerCase()}::${p.city.toLowerCase()}`),
    );

    let created = 0;
    const skipped: Array<{ name: string; city: string; reason: string }> = [];

    for (const entry of parsed.data.practices) {
      const key = `${entry.name.toLowerCase()}::${entry.city.toLowerCase()}`;
      if (existingKeys.has(key)) {
        skipped.push({ name: entry.name, city: entry.city, reason: 'Existiert bereits (Name + Stadt)' });
        continue;
      }
      existingKeys.add(key); // Dubletten innerhalb derselben Import-Liste auch fangen

      // Nominatim rate limit: 1 req/sec
      if (created + skipped.length > 0) await new Promise((r) => setTimeout(r, 1100));
      const coords = await geocodeAddress(entry.address ?? '', entry.city);

      await fastify.prisma.practice.create({
        data: {
          name: entry.name,
          city: entry.city,
          address: entry.address || null,
          phone: entry.phone || null,
          hours: entry.hours || null,
          description: entry.description || null,
          homeVisit: entry.homeVisit ?? false,
          lat: coords?.lat ?? 0,
          lng: coords?.lng ?? 0,
          reviewStatus: 'LISTED',
        },
      });
      created++;
    }

    resetSearchCache();
    return { created, skipped };
  });

  const updatePracticeSchema = z.object({
    name: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    address: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    hours: z.string().trim().optional(),
    description: z.string().trim().optional(),
    homeVisit: z.boolean().optional(),
  });

  // Directory-First-Refactor (P2): Bearbeiten nur solange ownerId null ist
  // (unbeansprucht). Sobald ein Claim stattfand, endet der Operator-Zugriff.
  fastify.post('/practices/:id/update', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updatePracticeSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      return reply.badRequest(Object.entries(msg).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') || 'Ungültige Eingabe');
    }

    const existing = await fastify.prisma.practice.findUnique({ where: { id } });
    if (!existing) return reply.notFound('Practice not found');
    if ((existing as { ownerId?: string | null }).ownerId) {
      return reply.forbidden('Diese Praxis wurde bereits übernommen und ist nicht mehr über den Admin-Bereich bearbeitbar.');
    }

    const data = parsed.data;
    const needsGeocode = data.address !== undefined || data.city !== undefined;
    const coords = needsGeocode
      ? await geocodeAddress(data.address ?? existing.address ?? '', data.city ?? existing.city)
      : null;

    const practice = await fastify.prisma.practice.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.hours !== undefined && { hours: data.hours }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.homeVisit !== undefined && { homeVisit: data.homeVisit }),
        ...(coords && { lat: coords.lat, lng: coords.lng }),
      },
    }).catch(() => null);
    if (!practice) return reply.notFound('Practice not found');

    resetSearchCache();
    return mapPractice(practice);
  });

  fastify.post('/practices/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const p = await fastify.prisma.practice.update({ where: { id }, data: { reviewStatus: 'APPROVED' } }).catch(() => null);
    if (!p) return reply.notFound('Practice not found');
    resetSearchCache();
    return { message: 'Practice approved.' };
  });

  fastify.post('/practices/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const p = await fastify.prisma.practice.update({ where: { id }, data: { reviewStatus: 'REJECTED' } }).catch(() => null);
    if (!p) return reply.notFound('Practice not found');
    resetSearchCache();
    return { message: 'Practice rejected.' };
  });

  fastify.post('/practices/:id/suspend', async (request, reply) => {
    const { id } = request.params as { id: string };
    const p = await fastify.prisma.practice.update({ where: { id }, data: { reviewStatus: 'SUSPENDED' } }).catch(() => null);
    if (!p) return reply.notFound('Practice not found');
    resetSearchCache();
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

  const createLinkSchema = z.object({
    therapistId: z.string().trim().min(1),
    practiceId: z.string().trim().min(1),
  });

  // Directory-First-Refactor (R2): Admin verknüpft eine bestehende Praxis mit
  // einem bestehenden Therapeuten manuell. Existierte bisher nicht — Admin
  // konnte nur bereits bestehende Links bestätigen/ablehnen/anfechten, keinen
  // neuen anlegen.
  fastify.post('/links', async (request, reply) => {
    const parsed = createLinkSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      return reply.badRequest(Object.entries(msg).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') || 'Ungültige Eingabe');
    }
    const { therapistId, practiceId } = parsed.data;

    const therapist = await fastify.prisma.therapist.findUnique({ where: { id: therapistId } });
    if (!therapist) return reply.notFound('Therapeut nicht gefunden.');
    const practice = await fastify.prisma.practice.findUnique({ where: { id: practiceId } });
    if (!practice) return reply.notFound('Praxis nicht gefunden.');

    const existing = await fastify.prisma.therapistPracticeLink.findUnique({
      where: { therapistId_practiceId: { therapistId, practiceId } },
    });
    if (existing) return reply.conflict('Diese Verknüpfung existiert bereits.');

    const link = await fastify.prisma.therapistPracticeLink.create({
      data: { therapistId, practiceId, status: 'CONFIRMED', initiatedBy: 'ADMIN' },
      include: {
        therapist: { select: { id: true, fullName: true, professionalTitle: true } },
        practice: { select: { id: true, name: true, city: true } },
      },
    });

    resetSearchCache();
    return {
      id: link.id, therapistId: link.therapistId, practiceId: link.practiceId,
      status: link.status, createdAt: link.createdAt.toISOString(),
      therapist: link.therapist, practice: link.practice,
    };
  });

  fastify.post('/links/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const l = await fastify.prisma.therapistPracticeLink.update({ where: { id }, data: { status: 'CONFIRMED' } }).catch(() => null);
    if (!l) return reply.notFound('Link not found');
    resetSearchCache();
    return { message: 'Link confirmed.' };
  });

  fastify.post('/links/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const l = await fastify.prisma.therapistPracticeLink.update({ where: { id }, data: { status: 'REJECTED' } }).catch(() => null);
    if (!l) return reply.notFound('Link not found');
    resetSearchCache();
    return { message: 'Link rejected.' };
  });

  fastify.post('/links/:id/dispute', async (request, reply) => {
    const { id } = request.params as { id: string };
    const l = await fastify.prisma.therapistPracticeLink.update({ where: { id }, data: { status: 'DISPUTED' } }).catch(() => null);
    if (!l) return reply.notFound('Link not found');
    resetSearchCache();
    return { message: 'Link disputed.' };
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

  // POST /admin/therapists/geocode-all — geocode all therapists without homeLat/homeLng.
  // Mirrors the profile-update geocoding in auth.ts: exact address first, city-only as
  // fallback. homeLat/homeLng are the publicly visible coordinates (map pins).
  fastify.post('/therapists/geocode-all', async (_request, reply) => {
    const therapists = await fastify.prisma.therapist.findMany({
      where: { homeLat: 0, homeLng: 0 },
    });

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const t of therapists) {
      const streetPart = [t.street, t.houseNumber].filter(Boolean).join(' ');
      const cityPart = [t.postalCode, t.city].filter(Boolean).join(' ');
      if (!cityPart && !t.city) { skipped++; continue; }

      // Nominatim rate limit: 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));
      const exactCoords = streetPart && t.city ? await geocodeAddress(streetPart, cityPart) : null;
      let coords = exactCoords;
      if (!coords) {
        if (streetPart && t.city) await new Promise((r) => setTimeout(r, 1100));
        coords = await geocodeAddress('', cityPart || t.city);
      }

      if (coords) {
        await fastify.prisma.therapist.update({
          where: { id: t.id },
          data: {
            homeLat: coords.lat,
            homeLng: coords.lng,
            ...(exactCoords ? { latitude: exactCoords.lat, longitude: exactCoords.lng } : {}),
          },
        });
        updated++;
      } else {
        failed++;
      }
    }

    if (updated > 0) resetSearchCache();
    return { total: therapists.length, updated, failed, skipped };
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

    const filepath = join(THERAPIST_VERIFICATIONS_DIR, filename);
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

  fastify.delete('/users/:email', async (request, reply) => {
    await fastify.verifyAdmin(request, reply);
    const { email } = request.params as { email: string };
    const user = await fastify.prisma.user.findUnique({ where: { email } });
    if (!user) return reply.notFound('User nicht gefunden');
    await fastify.prisma.user.delete({ where: { email } });
    return { deleted: true, email };
  });

  fastify.post('/create-demo-user', async (request, reply) => {
    await fastify.verifyAdmin(request, reply);
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(['patient', 'therapist']),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { email, password, role, firstName, lastName } = parsed.data;

    const existing = await fastify.prisma.user.findUnique({ where: { email } });
    if (existing) {
      const ph = await hashPassword(password);
      await fastify.prisma.user.update({ where: { email }, data: { passwordHash: ph } });
      return { updated: true, email };
    }

    const passwordHash = await hashPassword(password);
    const user = await fastify.prisma.user.create({
      data: { email, passwordHash, role, firstName, lastName, emailVerifiedAt: new Date() },
    });

    if (role === 'therapist') {
      const existingTherapist = await fastify.prisma.therapist.findUnique({ where: { email } });
      if (!existingTherapist) {
        await fastify.prisma.therapist.create({
          data: {
            email,
            userId: user.id,
            fullName: `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Demo Physio',
            professionalTitle: 'Physiotherapeut',
            city: 'Köln',
            bio: 'Demo-Konto für den Therapeuten-Login in der Mobile-App.',
            homeVisit: true,
            specializations: 'Rückenschmerzen,Sportphysiotherapie',
            languages: 'Deutsch',
            certifications: '',
            kassenart: 'Alle',
            reviewStatus: 'APPROVED',
            isVisible: true,
            bookingMode: 'FIRST_APPOINTMENT_REQUEST',
          },
        });
      }
    }

    return { created: true, email, role };
  });

};
