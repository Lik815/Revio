import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword, getToken } from './auth-utils.js';
import { geocodeAddress } from '../utils/geocode.js';
import { normalizeText } from '../utils/search-utils.js';

const splitList = (value: string | null | undefined) =>
  (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// Public/owner-facing shape for a practice. specialties/services are stored as
// CSV (like Therapist), photos as a JSON string.
function serializePractice(p: any) {
  let photos: string[] | undefined;
  if (p.photos) { try { photos = JSON.parse(p.photos); } catch {} }
  return {
    id: p.id,
    name: p.name,
    city: p.city,
    postalCode: p.postalCode ?? null,
    address: p.address ?? null,
    phone: p.phone ?? null,
    email: p.email ?? null,
    website: p.website ?? null,
    description: p.description ?? null,
    specialties: splitList(p.specialties),
    services: splitList(p.services),
    openingHours: p.openingHours ?? null,
    hours: p.hours ?? null,
    logo: p.logo ?? null,
    photos,
    lat: p.lat,
    lng: p.lng,
    homeVisit: p.homeVisit ?? false,
    isVisible: p.isVisible ?? true,
    reviewStatus: p.reviewStatus,
    ownerUserId: p.ownerUserId ?? null,
    createdAt: p.createdAt,
  };
}

const practiceCoreSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(1),
  postalCode: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional(),
  website: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  specialties: z.array(z.string()).optional(),
  services: z.array(z.string()).optional(),
  openingHours: z.string().max(4000).optional(),
});

const registerPracticeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  // Set after the user has acknowledged a possible duplicate (see 409 below).
  forceCreate: z.boolean().optional(),
  practice: practiceCoreSchema,
});

export const practiceRoutes: FastifyPluginAsync = async (fastify) => {
  // Resolve the practice owned by the session-token holder (role practice_admin).
  async function resolveOwnerPractice(token: string) {
    const user = await fastify.prisma.user.findUnique({ where: { sessionToken: token } });
    if (!user || user.role !== 'practice_admin') return { user: null, practice: null };
    if (user.sessionTokenExpiresAt && user.sessionTokenExpiresAt < new Date()) {
      return { user: null, practice: null, expired: true } as const;
    }
    const practice = await fastify.prisma.practice.findFirst({
      where: { ownerUserId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    return { user, practice };
  }

  // ── POST /register/practice ────────────────────────────────────────────────
  fastify.post('/register/practice', async (request, reply) => {
    const parsed = registerPracticeSchema.safeParse(request.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const fieldMsgs = Object.entries(flat.fieldErrors)
        .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
        .join('; ');
      return reply.badRequest(fieldMsgs || flat.formErrors.join('; ') || 'Ungültige Eingabe');
    }

    const data = parsed.data;
    const email = data.email.trim().toLowerCase();

    const existingUser = await fastify.prisma.user.findUnique({ where: { email } });
    if (existingUser) return reply.conflict('Diese E-Mail-Adresse ist bereits registriert.');
    const existingTherapist = await fastify.prisma.therapist.findUnique({ where: { email } });
    if (existingTherapist) return reply.conflict('Diese E-Mail-Adresse ist bereits registriert.');

    // Require a confirmed OTP — same 2-hour window as therapist registration.
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const confirmedOtp = await fastify.prisma.emailOtp.findFirst({
      where: { email, verifiedAt: { not: null, gte: twoHoursAgo } },
      orderBy: { verifiedAt: 'desc' },
    });
    if (!confirmedOtp) {
      const expiredOtp = await fastify.prisma.emailOtp.findFirst({
        where: { email, verifiedAt: { not: null } },
      });
      return reply.badRequest(
        expiredOtp
          ? 'Der Bestätigungscode ist abgelaufen. Bitte starte die Registrierung erneut.'
          : 'E-Mail-Adresse nicht bestätigt. Bitte starte die Registrierung erneut.',
      );
    }

    // ── Duplicate guard (refinement #1) ──────────────────────────────────────
    // Do not silently create a second profile for an ownerless practice with the
    // same name + city. Surface the candidate so the client can warn / offer a
    // claim flow (claim itself is Phase 2). Bypassed with forceCreate: true.
    if (!data.forceCreate) {
      const targetName = normalizeText(data.practice.name);
      const targetCity = normalizeText(data.practice.city);
      const ownerless = await fastify.prisma.practice.findMany({
        where: { ownerUserId: null },
        select: { id: true, name: true, city: true, address: true },
        take: 200,
      });
      const match = ownerless.find(
        (p) => normalizeText(p.name) === targetName && normalizeText(p.city) === targetCity,
      );
      if (match) {
        return reply.status(409).send({
          code: 'practice_exists',
          message: 'Eine Praxis mit diesem Namen und Ort existiert bereits. Möchtest du sie beanspruchen?',
          practice: { id: match.id, name: match.name, city: match.city, address: match.address },
        });
      }
    }

    const passwordHash = await hashPassword(data.password);
    const sessionToken = randomBytes(32).toString('hex');

    const coords = await geocodeAddress(data.practice.address ?? '', [data.practice.postalCode, data.practice.city].filter(Boolean).join(' '));

    const { practice, user } = await (fastify.prisma as any).$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: 'practice_admin',
          firstName: data.firstName?.trim() || null,
          lastName: data.lastName?.trim() || null,
          emailVerifiedAt: confirmedOtp.verifiedAt,
          requiresEmailVerification: false,
          sessionToken,
          sessionTokenExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const practice = await tx.practice.create({
        data: {
          name: data.practice.name.trim(),
          city: data.practice.city.trim(),
          postalCode: data.practice.postalCode ?? null,
          address: data.practice.address ?? null,
          phone: data.practice.phone ?? null,
          email: data.practice.email ?? null,
          website: data.practice.website ?? null,
          description: data.practice.description ?? null,
          specialties: (data.practice.specialties ?? []).join(', '),
          services: (data.practice.services ?? []).join(', '),
          openingHours: data.practice.openingHours ?? null,
          ownerUserId: user.id,
          lat: coords?.lat ?? 0,
          lng: coords?.lng ?? 0,
          // New practices start private + pending review — not searchable until approved.
          reviewStatus: 'PENDING_REVIEW',
          isVisible: true,
        },
      });

      await tx.emailOtp.delete({ where: { id: confirmedOtp.id } });
      return { practice, user };
    });

    return reply.status(201).send({
      token: sessionToken,
      userId: user.id,
      accountType: 'practice_admin',
      practiceId: practice.id,
      reviewStatus: practice.reviewStatus,
      message: 'Praxisprofil erstellt. Es wird geprüft und erscheint danach in der Suche.',
    });
  });

  // ── GET /practice/me ───────────────────────────────────────────────────────
  fastify.get('/practice/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const { user, practice, expired } = await resolveOwnerPractice(token) as any;
    if (expired) return reply.unauthorized('Sitzung abgelaufen. Bitte erneut anmelden.');
    if (!user) return reply.unauthorized('Ungültiger Token');
    if (!practice) return reply.notFound('Kein Praxisprofil gefunden.');

    // Confirmed, approved, self-employed team members (for the dashboard team list).
    const links = await fastify.prisma.therapistPracticeLink.findMany({
      where: {
        practiceId: practice.id,
        status: 'CONFIRMED',
        therapist: { reviewStatus: 'APPROVED', isVisible: true, employmentStatus: 'SELF_EMPLOYED' },
      },
      include: {
        therapist: {
          select: { id: true, fullName: true, professionalTitle: true, photo: true, specializations: true, city: true },
        },
      },
    });

    // Pending join requests from therapists who picked this practice during
    // registration (Flow C) — practice_admin confirms/rejects these themselves,
    // no admin dashboard needed for this step.
    const pendingLinks = await fastify.prisma.therapistPracticeLink.findMany({
      where: { practiceId: practice.id, status: 'PROPOSED' },
      include: {
        therapist: {
          select: { id: true, fullName: true, professionalTitle: true, photo: true, email: true, city: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      practice: serializePractice(practice),
      team: links.map((l) => ({
        id: l.therapist.id,
        fullName: l.therapist.fullName,
        professionalTitle: l.therapist.professionalTitle,
        photo: l.therapist.photo ?? undefined,
        specializations: splitList(l.therapist.specializations),
        city: l.therapist.city,
      })),
      linkRequests: pendingLinks.map((l) => ({
        linkId: l.id,
        therapistId: l.therapist.id,
        fullName: l.therapist.fullName,
        professionalTitle: l.therapist.professionalTitle,
        photo: l.therapist.photo ?? undefined,
        email: l.therapist.email,
        city: l.therapist.city,
        createdAt: l.createdAt,
      })),
    };
  });

  // ── POST /practice/me/link-requests/:linkId/confirm ────────────────────────
  fastify.post('/practice/me/link-requests/:linkId/confirm', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const { user, practice, expired } = await resolveOwnerPractice(token) as any;
    if (expired) return reply.unauthorized('Sitzung abgelaufen. Bitte erneut anmelden.');
    if (!user) return reply.unauthorized('Ungültiger Token');
    if (!practice) return reply.notFound('Kein Praxisprofil gefunden.');

    const { linkId } = request.params as { linkId: string };
    // Scoped to the owner's own practice — a practice_admin can never confirm a
    // link targeting a different practice.
    const link = await fastify.prisma.therapistPracticeLink.findFirst({
      where: { id: linkId, practiceId: practice.id, status: 'PROPOSED' },
    });
    if (!link) return reply.notFound('Anfrage nicht gefunden.');

    await fastify.prisma.therapistPracticeLink.update({
      where: { id: linkId },
      data: { status: 'CONFIRMED' },
    });

    return { ok: true };
  });

  // ── POST /practice/me/link-requests/:linkId/reject ─────────────────────────
  fastify.post('/practice/me/link-requests/:linkId/reject', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const { user, practice, expired } = await resolveOwnerPractice(token) as any;
    if (expired) return reply.unauthorized('Sitzung abgelaufen. Bitte erneut anmelden.');
    if (!user) return reply.unauthorized('Ungültiger Token');
    if (!practice) return reply.notFound('Kein Praxisprofil gefunden.');

    const { linkId } = request.params as { linkId: string };
    const link = await fastify.prisma.therapistPracticeLink.findFirst({
      where: { id: linkId, practiceId: practice.id, status: 'PROPOSED' },
    });
    if (!link) return reply.notFound('Anfrage nicht gefunden.');

    await fastify.prisma.therapistPracticeLink.update({
      where: { id: linkId },
      data: { status: 'REJECTED' },
    });

    return { ok: true };
  });

  // ── PATCH /practice/me ─────────────────────────────────────────────────────
  fastify.patch('/practice/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const { user, practice, expired } = await resolveOwnerPractice(token) as any;
    if (expired) return reply.unauthorized('Sitzung abgelaufen. Bitte erneut anmelden.');
    if (!user) return reply.unauthorized('Ungültiger Token');
    if (!practice) return reply.notFound('Kein Praxisprofil gefunden.');

    const patchSchema = practiceCoreSchema.partial().extend({
      logo: z.string().nullable().optional(),
      photos: z.array(z.string()).optional(),
      hours: z.string().max(2000).nullable().optional(),
      isVisible: z.boolean().optional(),
    });
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());
    const d = parsed.data;

    const updateData: Record<string, any> = {};
    if (d.name !== undefined) updateData.name = d.name.trim();
    if (d.city !== undefined) updateData.city = d.city.trim();
    if (d.postalCode !== undefined) updateData.postalCode = d.postalCode;
    if (d.address !== undefined) updateData.address = d.address;
    if (d.phone !== undefined) updateData.phone = d.phone;
    if (d.email !== undefined) updateData.email = d.email;
    if (d.website !== undefined) updateData.website = d.website;
    if (d.description !== undefined) updateData.description = d.description;
    if (d.specialties !== undefined) updateData.specialties = d.specialties.join(', ');
    if (d.services !== undefined) updateData.services = d.services.join(', ');
    if (d.openingHours !== undefined) updateData.openingHours = d.openingHours;
    if (d.hours !== undefined) updateData.hours = d.hours;
    if (d.logo !== undefined) updateData.logo = d.logo;
    if (d.photos !== undefined) updateData.photos = JSON.stringify(d.photos);
    if (d.isVisible !== undefined) updateData.isVisible = d.isVisible;

    // Re-geocode when any address-relevant field changes.
    const addressChanged = d.address !== undefined || d.city !== undefined || d.postalCode !== undefined;
    if (addressChanged) {
      const effCity = d.city ?? practice.city ?? '';
      const effPostal = d.postalCode ?? practice.postalCode ?? '';
      const effAddress = d.address ?? practice.address ?? '';
      const coords = await geocodeAddress(effAddress, [effPostal, effCity].filter(Boolean).join(' '));
      if (coords) { updateData.lat = coords.lat; updateData.lng = coords.lng; }
    }

    const updated = await fastify.prisma.practice.update({
      where: { id: practice.id },
      data: updateData,
    });

    return { practice: serializePractice(updated) };
  });
};
