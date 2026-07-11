import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ReviewStatus, CourseRunStatus, CourseLocationType } from '@prisma/client';
import { getToken } from './auth-utils.js';
import {
  assertExactlyOneOwner,
  assertRunPublishable,
  assertEligibleConsistency,
  assertRunNotTerminal,
} from '../utils/course-assertions.js';

// ── Auth helper ──────────────────────────────────────────────────────────────

async function resolveTherapist(fastify: FastifyInstance, request: any) {
  const token = getToken(request);
  if (!token) return null;
  return fastify.prisma.therapist.findFirst({ where: { sessionToken: token } });
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

const courseCreateSchema = z.object({
  categoryKey: z.string().min(1),
  title: z.string().min(2).max(120),
  description: z.string().min(10),
  targetAudience: z.string().optional(),
  prerequisites: z.string().optional(),
  instructorName: z.string().min(2),
  instructorBio: z.string().optional(),
  contactInfo: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  locationType: z.nativeEnum(CourseLocationType),
  zppDocUrl: z.string().url().optional(),
});

const courseUpdateSchema = courseCreateSchema.partial();

const runCreateSchema = z.object({
  label: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  onlineUrl: z.string().url().optional(),
  maxParticipants: z.number().int().min(1),
  minParticipants: z.number().int().min(1).optional(),
  waitlistEnabled: z.boolean().optional(),
  waitlistMax: z.number().int().min(1).optional(),
  bookingDeadline: z.string().datetime().optional(),
  priceAmount: z.number().int().min(0).optional(),
  priceCurrency: z.string().length(3).optional(),
});

const runUpdateSchema = runCreateSchema.partial();

const sessionSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string().optional(),
});

const sessionBulkSchema = z.array(sessionSchema).min(1).max(100);

const runStatusSchema = z.object({
  status: z.nativeEnum(CourseRunStatus),
  cancelReason: z.string().optional(),
});

// ── Route registration ───────────────────────────────────────────────────────

export async function courseRoutes(fastify: FastifyInstance) {

  // ── Category list (public) ─────────────────────────────────────────────────

  fastify.get('/courses/categories', async (_request, reply) => {
    const cats = await fastify.prisma.courseCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { key: true, label: true, sortOrder: true },
    });
    return reply.send(cats);
  });

  // ── Course CRUD (provider) ─────────────────────────────────────────────────

  fastify.post('/courses/my', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = courseCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const cat = await fastify.prisma.courseCategory.findUnique({ where: { key: parsed.data.categoryKey } });
    if (!cat) return reply.status(400).send({ error: 'Unbekannte Kategorie' });

    assertExactlyOneOwner({ therapistId: therapist.id, practiceId: null });

    const course = await fastify.prisma.course.create({
      data: {
        ...parsed.data,
        therapistId: therapist.id,
      },
    });
    return reply.status(201).send(course);
  });

  fastify.get('/courses/my', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const courses = await fastify.prisma.course.findMany({
      where: { therapistId: therapist.id },
      include: {
        category: { select: { key: true, label: true } },
        runs: {
          select: { id: true, label: true, status: true, maxParticipants: true, bookingDeadline: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(courses);
  });

  fastify.get('/courses/my/:id', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const course = await fastify.prisma.course.findFirst({
      where: { id, therapistId: therapist.id },
      include: {
        category: true,
        runs: {
          include: {
            sessions: { orderBy: { startsAt: 'asc' } },
            _count: { select: { enrollments: { where: { status: 'CONFIRMED' } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!course) return reply.status(404).send({ error: 'Kurs nicht gefunden' });
    return reply.send(course);
  });

  fastify.put('/courses/my/:id', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.course.findFirst({ where: { id, therapistId: therapist.id } });
    if (!existing) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    if (existing.reviewStatus === ReviewStatus.APPROVED) {
      return reply.status(409).send({ error: 'Freigegebene Kurse können nicht direkt bearbeitet werden. Kurs zurückziehen und neu einreichen.' });
    }

    const parsed = courseUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    if (parsed.data.categoryKey) {
      const cat = await fastify.prisma.courseCategory.findUnique({ where: { key: parsed.data.categoryKey } });
      if (!cat) return reply.status(400).send({ error: 'Unbekannte Kategorie' });
    }

    const updated = await fastify.prisma.course.update({ where: { id }, data: parsed.data });
    return reply.send(updated);
  });

  fastify.delete('/courses/my/:id', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.course.findFirst({ where: { id, therapistId: therapist.id } });
    if (!existing) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    if (existing.reviewStatus === ReviewStatus.APPROVED) {
      return reply.status(409).send({ error: 'Freigegebene Kurse können nicht gelöscht werden.' });
    }

    await fastify.prisma.course.delete({ where: { id } });
    return reply.status(204).send();
  });

  fastify.post('/courses/my/:id/submit', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const course = await fastify.prisma.course.findFirst({ where: { id, therapistId: therapist.id } });
    if (!course) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    const submittableStatuses: ReviewStatus[] = [ReviewStatus.DRAFT, ReviewStatus.CHANGES_REQUESTED];
    if (!submittableStatuses.includes(course.reviewStatus)) {
      return reply.status(409).send({ error: `Kurs hat Status ${course.reviewStatus} und kann nicht eingereicht werden.` });
    }

    const updated = await fastify.prisma.course.update({
      where: { id },
      data: { reviewStatus: ReviewStatus.PENDING_REVIEW },
    });
    return reply.send(updated);
  });

  // ── CourseRun CRUD ─────────────────────────────────────────────────────────

  fastify.post('/courses/my/:courseId/runs', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { courseId } = request.params as { courseId: string };
    const course = await fastify.prisma.course.findFirst({ where: { id: courseId, therapistId: therapist.id } });
    if (!course) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    // Durchläufe/Termine dürfen bereits für unfreigegebene Kurse angelegt werden
    // (Therapeut baut das komplette Kurspaket vor der Einreichung auf). Die
    // eigentliche Freigabe-Schranke sitzt am Veröffentlichungszeitpunkt in
    // assertRunPublishable – vor Freigabe bleibt der Run im Status DRAFT und
    // taucht dadurch nirgends öffentlich auf.

    const parsed = runCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const run = await fastify.prisma.courseRun.create({
      data: { ...parsed.data, courseId },
    });
    return reply.status(201).send(run);
  });

  fastify.get('/courses/my/:courseId/runs', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { courseId } = request.params as { courseId: string };
    const course = await fastify.prisma.course.findFirst({ where: { id: courseId, therapistId: therapist.id } });
    if (!course) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    const runs = await fastify.prisma.courseRun.findMany({
      where: { courseId },
      include: {
        sessions: { orderBy: { startsAt: 'asc' } },
        _count: { select: { enrollments: { where: { status: 'CONFIRMED' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(runs);
  });

  fastify.put('/courses/my/:courseId/runs/:runId', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { courseId, runId } = request.params as { courseId: string; runId: string };
    const run = await fastify.prisma.courseRun.findFirst({
      where: { id: runId, courseId, course: { therapistId: therapist.id } },
    });
    if (!run) return reply.status(404).send({ error: 'Durchlauf nicht gefunden' });
    assertRunNotTerminal(run.status);

    const parsed = runUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const updated = await fastify.prisma.courseRun.update({ where: { id: runId }, data: parsed.data });
    return reply.send(updated);
  });

  fastify.delete('/courses/my/:courseId/runs/:runId', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { courseId, runId } = request.params as { courseId: string; runId: string };
    const run = await fastify.prisma.courseRun.findFirst({
      where: { id: runId, courseId, course: { therapistId: therapist.id } },
      include: { _count: { select: { enrollments: { where: { status: { in: ['PENDING', 'CONFIRMED'] } } } } } },
    });
    if (!run) return reply.status(404).send({ error: 'Durchlauf nicht gefunden' });
    assertRunNotTerminal(run.status);

    if (run._count.enrollments > 0) {
      return reply.status(409).send({ error: 'Durchlauf hat aktive Anmeldungen und kann nicht gelöscht werden. Stattdessen absagen.' });
    }

    await fastify.prisma.courseRun.delete({ where: { id: runId } });
    return reply.status(204).send();
  });

  fastify.patch('/courses/my/:courseId/runs/:runId/status', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { courseId, runId } = request.params as { courseId: string; runId: string };
    const run = await fastify.prisma.courseRun.findFirst({
      where: { id: runId, courseId, course: { therapistId: therapist.id } },
      include: {
        course: { select: { reviewStatus: true } },
        _count: { select: { sessions: true } },
      },
    });
    if (!run) return reply.status(404).send({ error: 'Durchlauf nicht gefunden' });
    assertRunNotTerminal(run.status);

    const parsed = runStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const { status, cancelReason } = parsed.data;

    if (status === CourseRunStatus.PUBLISHED) {
      assertRunPublishable({
        courseReviewStatus: run.course.reviewStatus,
        sessionCount: run._count.sessions,
        maxParticipants: run.maxParticipants,
      });
    }

    if (status === CourseRunStatus.CANCELLED && !cancelReason) {
      return reply.status(400).send({ error: 'cancelReason ist bei Absage erforderlich.' });
    }

    const updated = await fastify.prisma.courseRun.update({
      where: { id: runId },
      data: {
        status,
        ...(status === CourseRunStatus.CANCELLED ? { cancelledAt: new Date(), cancelReason } : {}),
      },
    });
    return reply.send(updated);
  });

  // ── CourseSession bulk + patch + delete ────────────────────────────────────

  fastify.post('/courses/my/:courseId/runs/:runId/sessions', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { courseId, runId } = request.params as { courseId: string; runId: string };
    const run = await fastify.prisma.courseRun.findFirst({
      where: { id: runId, courseId, course: { therapistId: therapist.id } },
      include: { course: { select: { reviewStatus: true } } },
    });
    if (!run) return reply.status(404).send({ error: 'Durchlauf nicht gefunden' });
    assertRunNotTerminal(run.status);

    const parsed = sessionBulkSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    for (const s of parsed.data) {
      if (new Date(s.startsAt) >= new Date(s.endsAt)) {
        return reply.status(400).send({ error: `Termin ${s.startsAt}: startsAt muss vor endsAt liegen.` });
      }
    }

    const sessions = await fastify.prisma.$transaction(
      parsed.data.map(s =>
        fastify.prisma.courseSession.create({
          data: { courseRunId: runId, startsAt: new Date(s.startsAt), endsAt: new Date(s.endsAt), location: s.location },
        }),
      ),
    );

    // Auto-Publish: Durchlauf zu einem bereits freigegebenen Kurs hinzugefügt
    // (z. B. über "Durchlauf hinzufügen" im Wizard). Das Auto-Publish bei der
    // Kurs-Freigabe selbst greift hier nicht, weil der Kurs schon APPROVED
    // war, bevor dieser Durchlauf/die Termine existierten – ohne diesen
    // zweiten Auto-Publish-Pfad bliebe der Durchlauf für immer im DRAFT-Limbo.
    if (run.status === CourseRunStatus.DRAFT && run.course.reviewStatus === ReviewStatus.APPROVED) {
      try {
        assertRunPublishable({
          courseReviewStatus: run.course.reviewStatus,
          sessionCount: sessions.length,
          maxParticipants: run.maxParticipants,
        });
        await fastify.prisma.courseRun.update({
          where: { id: runId },
          data: { status: CourseRunStatus.PUBLISHED },
        });
      } catch {
        // Voraussetzungen (noch) nicht erfüllt – bleibt DRAFT, Therapeut kann
        // später weitere Termine ergänzen.
      }
    }

    return reply.status(201).send(sessions);
  });

  fastify.put('/courses/my/:courseId/runs/:runId/sessions/:sessionId', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { courseId, runId, sessionId } = request.params as { courseId: string; runId: string; sessionId: string };
    const session = await fastify.prisma.courseSession.findFirst({
      where: { id: sessionId, courseRunId: runId, courseRun: { courseId, course: { therapistId: therapist.id } } },
      include: { courseRun: true },
    });
    if (!session) return reply.status(404).send({ error: 'Termin nicht gefunden' });
    assertRunNotTerminal(session.courseRun.status);

    const parsed = sessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    if (new Date(parsed.data.startsAt) >= new Date(parsed.data.endsAt)) {
      return reply.status(400).send({ error: 'startsAt muss vor endsAt liegen.' });
    }

    const updated = await fastify.prisma.courseSession.update({
      where: { id: sessionId },
      data: { startsAt: new Date(parsed.data.startsAt), endsAt: new Date(parsed.data.endsAt), location: parsed.data.location },
    });
    return reply.send(updated);
  });

  fastify.delete('/courses/my/:courseId/runs/:runId/sessions/:sessionId', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { courseId, runId, sessionId } = request.params as { courseId: string; runId: string; sessionId: string };
    const session = await fastify.prisma.courseSession.findFirst({
      where: { id: sessionId, courseRunId: runId, courseRun: { courseId, course: { therapistId: therapist.id } } },
      include: { courseRun: true },
    });
    if (!session) return reply.status(404).send({ error: 'Termin nicht gefunden' });
    assertRunNotTerminal(session.courseRun.status);

    await fastify.prisma.courseSession.delete({ where: { id: sessionId } });
    return reply.status(204).send();
  });

  // ── Kalender-Sessions des Therapeuten ────────────────────────────────────────
  // GET /courses/my/sessions?from=ISO&to=ISO
  // Gibt alle CourseSession-Einträge der eigenen Kurse in einem Zeitraum zurück,
  // damit sie im Therapeuten-Kalender wie Terminslots angezeigt werden können.

  fastify.get('/courses/my/sessions', async (request, reply) => {
    const therapist = await resolveTherapist(fastify, request);
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const q = request.query as Record<string, string | undefined>;
    const from = q.from ? new Date(q.from) : new Date();
    const to = q.to ? new Date(q.to) : new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);

    const sessions = await fastify.prisma.courseSession.findMany({
      where: {
        startsAt: { gte: from, lte: to },
        courseRun: {
          status: { notIn: [CourseRunStatus.CANCELLED] },
          course: { therapistId: therapist.id },
        },
      },
      include: {
        courseRun: {
          select: {
            id: true,
            label: true,
            status: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    return reply.send({
      sessions: sessions.map(s => ({
        id: s.id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        location: s.location,
        courseId: s.courseRun.course.id,
        courseTitle: s.courseRun.course.title,
        runId: s.courseRun.id,
        runLabel: s.courseRun.label,
        runStatus: s.courseRun.status,
      })),
    });
  });
}
