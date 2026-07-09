import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { CourseRunStatus, CourseEnrollmentStatus } from '@prisma/client';
import {
  sendCourseEnrollmentConfirmEmail,
  sendCourseEnrollmentSuccessEmail,
  sendCourseEnrollmentCancelledEmail,
  sendCourseRunCancelledBulkEmail,
} from '../utils/mailer.js';
import { getToken } from './auth-utils.js';

const CONFIRM_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

function cancelTokenExpiry(sessions: Array<{ startsAt: Date }>): Date | null {
  if (!sessions.length) return null;
  const last = sessions.reduce((max, s) => (s.startsAt > max.startsAt ? s : max), sessions[0]);
  const exp = new Date(last.startsAt);
  exp.setDate(exp.getDate() + 7);
  return exp;
}

function buildConfirmLink(baseUrl: string, token: string) {
  return `${baseUrl}/courses/confirm?token=${token}`;
}

function buildCancelLink(baseUrl: string, token: string) {
  return `${baseUrl}/courses/cancel?token=${token}`;
}

function getBaseUrl(request: any): string {
  const proto = request.headers['x-forwarded-proto'] ?? 'https';
  const host = request.headers['host'] ?? 'my-revio.de';
  return `${proto}://${host}`;
}

const enrollSchema = z.object({
  patientName: z.string().min(2).max(120),
  patientEmail: z.string().email(),
  patientPhone: z.string().max(30).optional(),
  message: z.string().max(500).optional(),
  consentAccepted: z.literal(true, { errorMap: () => ({ message: 'Einwilligung ist erforderlich.' }) }),
});

export async function courseEnrollmentRoutes(fastify: FastifyInstance) {

  // ── POST /courses/runs/:runId/enroll — Anmeldung (Gast, Double-Opt-In) ────

  fastify.post('/courses/runs/:runId/enroll', async (request, reply) => {
    const { runId } = request.params as { runId: string };

    const run = await fastify.prisma.courseRun.findFirst({
      where: { id: runId, status: CourseRunStatus.PUBLISHED },
      include: {
        course: { select: { id: true, title: true, reviewStatus: true } },
        sessions: { orderBy: { startsAt: 'asc' } },
        _count: { select: { enrollments: { where: { status: { in: ['PENDING', 'CONFIRMED'] } } } } },
      },
    });

    if (!run) return reply.status(404).send({ error: 'Kursdurchlauf nicht gefunden oder nicht buchbar.' });

    const deadline = run.bookingDeadline ? new Date(run.bookingDeadline) : null;
    if (deadline && new Date() > deadline) {
      return reply.status(409).send({ error: 'Anmeldeschluss ist überschritten.' });
    }

    const parsed = enrollSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const { patientName, patientEmail, patientPhone, message } = parsed.data;

    const activeCount = run._count.enrollments;
    const isFull = activeCount >= run.maxParticipants;

    if (isFull && !run.waitlistEnabled) {
      return reply.status(409).send({ error: 'Kurs ist ausgebucht.' });
    }
    if (isFull && run.waitlistEnabled && run.waitlistMax != null) {
      const waitlistCount = await fastify.prisma.courseEnrollment.count({
        where: { courseRunId: runId, status: CourseEnrollmentStatus.WAITLISTED },
      });
      if (waitlistCount >= run.waitlistMax) {
        return reply.status(409).send({ error: 'Warteliste ist ebenfalls voll.' });
      }
    }

    // Upsert: existierende CANCELLED/DECLINED Anmeldung reaktivieren
    const existing = await fastify.prisma.courseEnrollment.findFirst({
      where: {
        courseRunId: runId,
        patientEmail,
        status: { in: [CourseEnrollmentStatus.CANCELLED, CourseEnrollmentStatus.DECLINED] },
      },
    });

    const confirmToken = randomBytes(32).toString('hex');
    const cancelToken = randomBytes(32).toString('hex');
    const cancelTokenExpiresAt = cancelTokenExpiry(run.sessions);
    const targetStatus = isFull ? CourseEnrollmentStatus.WAITLISTED : CourseEnrollmentStatus.EMAIL_UNCONFIRMED;

    let enrollment;
    if (existing) {
      enrollment = await fastify.prisma.courseEnrollment.update({
        where: { id: existing.id },
        data: {
          patientName,
          patientEmail,
          patientPhone: patientPhone ?? null,
          message: message ?? null,
          status: targetStatus,
          confirmToken,
          cancelToken,
          cancelTokenExpiresAt,
          declineReason: null,
          cancelledBy: null,
          cancelledAt: null,
          confirmedEmailAt: null,
          consentAcceptedAt: new Date(),
        },
      });
    } else {
      enrollment = await fastify.prisma.courseEnrollment.create({
        data: {
          courseRunId: runId,
          patientName,
          patientEmail,
          patientPhone: patientPhone ?? null,
          message: message ?? null,
          status: targetStatus,
          confirmToken,
          cancelToken,
          cancelTokenExpiresAt,
          consentAcceptedAt: new Date(),
        },
      });
    }

    if (targetStatus !== CourseEnrollmentStatus.WAITLISTED) {
      const confirmLink = buildConfirmLink(getBaseUrl(request), confirmToken);
      await sendCourseEnrollmentConfirmEmail({
        to: patientEmail,
        participantName: patientName,
        courseTitle: run.course.title,
        runLabel: run.label,
        confirmLink,
      });
    }

    return reply.status(201).send({
      id: enrollment.id,
      status: enrollment.status,
      message: targetStatus === CourseEnrollmentStatus.WAITLISTED
        ? 'Du wurdest auf die Warteliste gesetzt.'
        : 'Bitte bestätige deine E-Mail-Adresse.',
    });
  });

  // ── GET /courses/confirm — E-Mail-Bestätigung (Double-Opt-In) ─────────────
  // GET renders landing page (or redirect) — no side effects

  fastify.get('/courses/confirm', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.status(400).send({ error: 'Token fehlt.' });

    const enrollment = await fastify.prisma.courseEnrollment.findFirst({
      where: { confirmToken: token, status: CourseEnrollmentStatus.EMAIL_UNCONFIRMED },
    });

    if (!enrollment) {
      return reply.status(410).send({ error: 'Link ungültig oder bereits verwendet.' });
    }

    // Token-Ablauf prüfen (48h ab Erstellung)
    const age = Date.now() - enrollment.createdAt.getTime();
    if (age > CONFIRM_TOKEN_TTL_MS) {
      return reply.status(410).send({ error: 'Bestätigungslink ist abgelaufen. Bitte neu anmelden.' });
    }

    return reply.send({ valid: true, enrollmentId: enrollment.id, patientName: enrollment.patientName });
  });

  // ── POST /courses/confirm — E-Mail-Bestätigung (Aktion) ───────────────────

  fastify.post('/courses/confirm', async (request, reply) => {
    const { token } = request.body as { token?: string };
    if (!token) return reply.status(400).send({ error: 'Token fehlt.' });

    const enrollment = await fastify.prisma.courseEnrollment.findFirst({
      where: { confirmToken: token, status: CourseEnrollmentStatus.EMAIL_UNCONFIRMED },
      include: {
        courseRun: {
          include: {
            course: { select: { title: true } },
            sessions: { orderBy: { startsAt: 'asc' } },
          },
        },
      },
    });

    if (!enrollment) {
      return reply.status(410).send({ error: 'Link ungültig oder bereits verwendet.' });
    }

    const age = Date.now() - enrollment.createdAt.getTime();
    if (age > CONFIRM_TOKEN_TTL_MS) {
      return reply.status(410).send({ error: 'Bestätigungslink ist abgelaufen. Bitte neu anmelden.' });
    }

    const updated = await fastify.prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: CourseEnrollmentStatus.PENDING,
        confirmToken: null,
        confirmedEmailAt: new Date(),
      },
    });

    const cancelLink = buildCancelLink(getBaseUrl(request), enrollment.cancelToken);
    if (enrollment.patientEmail) {
      await sendCourseEnrollmentSuccessEmail({
        to: enrollment.patientEmail,
        participantName: enrollment.patientName,
        courseTitle: enrollment.courseRun.course.title,
        runLabel: enrollment.courseRun.label,
        cancelLink,
        sessions: enrollment.courseRun.sessions,
      });
    }

    return reply.send({ status: updated.status });
  });

  // ── GET /courses/cancel — Stornierung Landing (keine Aktion) ──────────────

  fastify.get('/courses/cancel', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.status(400).send({ error: 'Token fehlt.' });

    const enrollment = await fastify.prisma.courseEnrollment.findFirst({
      where: { cancelToken: token },
      include: { courseRun: { include: { course: { select: { title: true } } } } },
    });

    if (!enrollment) return reply.status(404).send({ error: 'Ungültiger Stornierungslink.' });

    const terminal: CourseEnrollmentStatus[] = [CourseEnrollmentStatus.CANCELLED, CourseEnrollmentStatus.DECLINED];
    if (terminal.includes(enrollment.status)) {
      return reply.status(410).send({ error: 'Anmeldung wurde bereits storniert.' });
    }

    if (enrollment.cancelTokenExpiresAt && new Date() > enrollment.cancelTokenExpiresAt) {
      return reply.status(410).send({ error: 'Stornierungslink ist abgelaufen.' });
    }

    return reply.send({
      valid: true,
      enrollmentId: enrollment.id,
      patientName: enrollment.patientName,
      courseTitle: enrollment.courseRun.course.title,
      runLabel: enrollment.courseRun.label,
    });
  });

  // ── POST /courses/cancel — Stornierung (Teilnehmer) ───────────────────────

  fastify.post('/courses/cancel', async (request, reply) => {
    const { token } = request.body as { token?: string };
    if (!token) return reply.status(400).send({ error: 'Token fehlt.' });

    const enrollment = await fastify.prisma.courseEnrollment.findFirst({
      where: { cancelToken: token },
      include: { courseRun: { include: { course: { select: { title: true } } } } },
    });

    if (!enrollment) return reply.status(404).send({ error: 'Ungültiger Stornierungslink.' });

    const terminal: CourseEnrollmentStatus[] = [CourseEnrollmentStatus.CANCELLED, CourseEnrollmentStatus.DECLINED];
    if (terminal.includes(enrollment.status)) {
      return reply.status(409).send({ error: 'Anmeldung wurde bereits storniert.' });
    }

    if (enrollment.cancelTokenExpiresAt && new Date() > enrollment.cancelTokenExpiresAt) {
      return reply.status(410).send({ error: 'Stornierungslink ist abgelaufen.' });
    }

    await fastify.prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: CourseEnrollmentStatus.CANCELLED,
        cancelledBy: 'PARTICIPANT',
        cancelledAt: new Date(),
      },
    });

    if (enrollment.patientEmail) {
      await sendCourseEnrollmentCancelledEmail({
        to: enrollment.patientEmail,
        participantName: enrollment.patientName,
        courseTitle: enrollment.courseRun.course.title,
        runLabel: enrollment.courseRun.label,
        cancelledBy: 'PARTICIPANT',
      });
    }

    return reply.send({ cancelled: true });
  });

  // ── Provider: Anmeldung bestätigen / ablehnen ──────────────────────────────

  fastify.patch('/courses/my/:courseId/runs/:runId/enrollments/:enrollmentId', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const therapist = await fastify.prisma.therapist.findFirst({ where: { sessionToken: token } });
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { courseId, runId, enrollmentId } = request.params as { courseId: string; runId: string; enrollmentId: string };

    const enrollment = await fastify.prisma.courseEnrollment.findFirst({
      where: {
        id: enrollmentId,
        courseRunId: runId,
        courseRun: { courseId, course: { therapistId: therapist.id } },
      },
      include: { courseRun: { include: { course: { select: { title: true } } } } },
    });
    if (!enrollment) return reply.status(404).send({ error: 'Anmeldung nicht gefunden.' });

    const actionSchema = z.object({
      action: z.enum(['CONFIRM', 'DECLINE']),
      declineReason: z.string().max(500).optional(),
    });
    const parsed = actionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const { action, declineReason } = parsed.data;

    const actionableStatuses: CourseEnrollmentStatus[] = [CourseEnrollmentStatus.PENDING, CourseEnrollmentStatus.WAITLISTED];
    if (!actionableStatuses.includes(enrollment.status)) {
      return reply.status(409).send({ error: `Anmeldung hat Status ${enrollment.status} und kann nicht geändert werden.` });
    }

    if (action === 'CONFIRM') {
      await fastify.prisma.courseEnrollment.update({
        where: { id: enrollmentId },
        data: { status: CourseEnrollmentStatus.CONFIRMED },
      });
    } else {
      if (!declineReason) return reply.status(400).send({ error: 'declineReason ist bei Ablehnung erforderlich.' });
      await fastify.prisma.courseEnrollment.update({
        where: { id: enrollmentId },
        data: { status: CourseEnrollmentStatus.DECLINED, declineReason, cancelledBy: 'PROVIDER', cancelledAt: new Date() },
      });
      if (enrollment.patientEmail) {
        await sendCourseEnrollmentCancelledEmail({
          to: enrollment.patientEmail,
          participantName: enrollment.patientName,
          courseTitle: enrollment.courseRun.course.title,
          runLabel: enrollment.courseRun.label,
          cancelledBy: 'PROVIDER',
        });
      }
    }

    return reply.send({ ok: true });
  });

  // ── Provider: Kursabsage → Bulk-Mail ─────────────────────────────────────
  // Wird nach PATCH /runs/:runId/status {status: CANCELLED} aufgerufen

  fastify.post('/courses/my/:courseId/runs/:runId/cancel-notify', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const therapist = await fastify.prisma.therapist.findFirst({ where: { sessionToken: token } });
    if (!therapist) return reply.status(401).send({ error: 'Unauthorized' });

    const { courseId, runId } = request.params as { courseId: string; runId: string };

    const run = await fastify.prisma.courseRun.findFirst({
      where: { id: runId, courseId, course: { therapistId: therapist.id }, status: CourseRunStatus.CANCELLED },
      include: { course: { select: { title: true } } },
    });
    if (!run) return reply.status(404).send({ error: 'Abgesagter Durchlauf nicht gefunden.' });

    if (!run.cancelReason) return reply.status(400).send({ error: 'cancelReason fehlt auf dem Durchlauf.' });

    const enrollments = await fastify.prisma.courseEnrollment.findMany({
      where: {
        courseRunId: runId,
        status: { in: [CourseEnrollmentStatus.PENDING, CourseEnrollmentStatus.CONFIRMED, CourseEnrollmentStatus.WAITLISTED] },
        patientEmail: { not: null },
      },
    });

    // Bulk-Cancel in DB
    await fastify.prisma.courseEnrollment.updateMany({
      where: {
        courseRunId: runId,
        status: { in: [CourseEnrollmentStatus.PENDING, CourseEnrollmentStatus.CONFIRMED, CourseEnrollmentStatus.WAITLISTED] },
      },
      data: { status: CourseEnrollmentStatus.CANCELLED, cancelledBy: 'PROVIDER', cancelledAt: new Date() },
    });

    // Mails sequenziell (max ~10/s via Resend free tier)
    let sent = 0;
    for (const e of enrollments) {
      if (!e.patientEmail) continue;
      await sendCourseRunCancelledBulkEmail({
        to: e.patientEmail,
        participantName: e.patientName,
        courseTitle: run.course.title,
        runLabel: run.label,
        cancelReason: run.cancelReason,
      });
      sent++;
      // Throttle: 100ms between mails to stay within Resend rate limits
      if (sent % 10 === 0) await new Promise(r => setTimeout(r, 1000));
    }

    return reply.send({ notified: sent });
  });
}
