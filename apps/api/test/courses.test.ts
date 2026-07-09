import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';
import * as mailer from '../src/utils/mailer.js';

process.env.DATABASE_URL ??= 'file:./prisma/test.db';
process.env.REVIO_ADMIN_TOKEN ??= 'test-token';

const ADMIN_AUTH = { authorization: 'Bearer test-token' };
const THERAPIST_TOKEN = 'course-therapist-token';
const THERAPIST_AUTH = { authorization: `Bearer ${THERAPIST_TOKEN}` };

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

beforeAll(async () => {
  // Mailer-Funktionen mocken damit keine echten E-Mails gesendet werden
  vi.spyOn(mailer, 'sendCourseEnrollmentConfirmEmail').mockResolvedValue(undefined);
  vi.spyOn(mailer, 'sendCourseEnrollmentSuccessEmail').mockResolvedValue(undefined);
  vi.spyOn(mailer, 'sendCourseEnrollmentCancelledEmail').mockResolvedValue(undefined);
  vi.spyOn(mailer, 'sendCourseRunCancelledBulkEmail').mockResolvedValue(undefined);
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

afterEach(async () => {
  await prisma.courseEnrollment.deleteMany();
  await prisma.courseSession.deleteMany();
  await prisma.courseRun.deleteMany();
  await prisma.course.deleteMany();
  await prisma.courseCategory.deleteMany();
  await prisma.therapist.deleteMany();
});

async function seedCategory(key = 'bewegung', label = 'Bewegungsgesundheit') {
  return prisma.courseCategory.upsert({
    where: { key },
    update: {},
    create: { key, label, sortOrder: 1 },
  });
}

async function seedTherapist(token = THERAPIST_TOKEN, reviewStatus = 'APPROVED') {
  return prisma.therapist.create({
    data: {
      email: `${token}@test.de`,
      fullName: 'Kurs Therapeut',
      professionalTitle: 'PT',
      city: 'Berlin',
      specializations: 'Bewegung',
      languages: 'de',
      sessionToken: token,
      reviewStatus: reviewStatus as any,
    },
  });
}

const COURSE_PAYLOAD = {
  categoryKey: 'bewegung',
  title: 'Rückenfit Kurs',
  description: 'Ein Kurs für einen gesunden Rücken.',
  instructorName: 'Dr. Rücken',
  locationType: 'ONSITE',
};

// ── GET /courses/categories ────────────────────────────────────────────────

describe('GET /courses/categories', () => {
  it('gibt aktive Kategorien zurück', async () => {
    await seedCategory();
    const res = await app.inject({ method: 'GET', url: '/courses/categories' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body[0]).toMatchObject({ key: 'bewegung', label: 'Bewegungsgesundheit' });
  });
});

// ── POST /courses/my ───────────────────────────────────────────────────────

describe('POST /courses/my', () => {
  it('erstellt einen neuen Kurs', async () => {
    await seedCategory();
    await seedTherapist();

    const res = await app.inject({
      method: 'POST',
      url: '/courses/my',
      headers: THERAPIST_AUTH,
      payload: COURSE_PAYLOAD,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe('Rückenfit Kurs');
    expect(body.reviewStatus).toBe('DRAFT');
  });

  it('gibt 401 zurück ohne Token', async () => {
    const res = await app.inject({ method: 'POST', url: '/courses/my', payload: COURSE_PAYLOAD });
    expect(res.statusCode).toBe(401);
  });

  it('gibt 400 zurück bei unbekannter Kategorie', async () => {
    await seedTherapist();
    const res = await app.inject({
      method: 'POST',
      url: '/courses/my',
      headers: THERAPIST_AUTH,
      payload: { ...COURSE_PAYLOAD, categoryKey: 'unbekannt' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── GET /courses/my + PUT + DELETE ────────────────────────────────────────

describe('Course CRUD', () => {
  it('DRAFT-Kurs kann bearbeitet und gelöscht werden', async () => {
    await seedCategory();
    const therapist = await seedTherapist();

    const create = await app.inject({
      method: 'POST',
      url: '/courses/my',
      headers: THERAPIST_AUTH,
      payload: COURSE_PAYLOAD,
    });
    expect(create.statusCode).toBe(201);
    const courseId = create.json().id;

    const list = await app.inject({ method: 'GET', url: '/courses/my', headers: THERAPIST_AUTH });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);

    const update = await app.inject({
      method: 'PUT',
      url: `/courses/my/${courseId}`,
      headers: THERAPIST_AUTH,
      payload: { title: 'Geänderter Titel' },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().title).toBe('Geänderter Titel');

    const del = await app.inject({ method: 'DELETE', url: `/courses/my/${courseId}`, headers: THERAPIST_AUTH });
    expect(del.statusCode).toBe(204);
  });
});

// ── POST /courses/my/:id/submit ────────────────────────────────────────────

describe('POST /courses/my/:id/submit', () => {
  it('setzt Status auf PENDING_REVIEW', async () => {
    await seedCategory();
    await seedTherapist();

    const create = await app.inject({
      method: 'POST',
      url: '/courses/my',
      headers: THERAPIST_AUTH,
      payload: COURSE_PAYLOAD,
    });
    const courseId = create.json().id;

    const submit = await app.inject({
      method: 'POST',
      url: `/courses/my/${courseId}/submit`,
      headers: THERAPIST_AUTH,
    });
    expect(submit.statusCode).toBe(200);
    expect(submit.json().reviewStatus).toBe('PENDING_REVIEW');
  });
});

// ── Admin Review ───────────────────────────────────────────────────────────

describe('Admin Course Review', () => {
  it('gibt Kurs-Liste zurück und kann Kurs freigeben', async () => {
    await seedCategory();
    await seedTherapist();

    const create = await app.inject({
      method: 'POST',
      url: '/courses/my',
      headers: THERAPIST_AUTH,
      payload: COURSE_PAYLOAD,
    });
    const courseId = create.json().id;

    const list = await app.inject({ method: 'GET', url: '/admin/courses', headers: ADMIN_AUTH });
    expect(list.statusCode).toBe(200);
    expect(list.json().total).toBe(1);

    const review = await app.inject({
      method: 'PATCH',
      url: `/admin/courses/${courseId}/review`,
      headers: ADMIN_AUTH,
      payload: { status: 'APPROVED', adminNote: 'Alles in Ordnung.' },
    });
    expect(review.statusCode).toBe(200);
    expect(review.json().reviewStatus).toBe('APPROVED');
  });

  it('setzt Eligibility-Flags', async () => {
    await seedCategory();
    await seedTherapist();

    const create = await app.inject({
      method: 'POST',
      url: '/courses/my',
      headers: THERAPIST_AUTH,
      payload: COURSE_PAYLOAD,
    });
    const courseId = create.json().id;

    const eligibility = await app.inject({
      method: 'PATCH',
      url: `/admin/courses/${courseId}/eligibility`,
      headers: ADMIN_AUTH,
      payload: { healthInsuranceEligible: true, zppVerified: true },
    });
    expect(eligibility.statusCode).toBe(200);
    expect(eligibility.json().zppVerified).toBe(true);
  });

  it('lehnt inkonsistente Eligibility ab (zppVerified ohne healthInsuranceEligible)', async () => {
    await seedCategory();
    await seedTherapist();

    const create = await app.inject({
      method: 'POST',
      url: '/courses/my',
      headers: THERAPIST_AUTH,
      payload: COURSE_PAYLOAD,
    });
    const courseId = create.json().id;

    const eligibility = await app.inject({
      method: 'PATCH',
      url: `/admin/courses/${courseId}/eligibility`,
      headers: ADMIN_AUTH,
      payload: { healthInsuranceEligible: false, zppVerified: true },
    });
    expect(eligibility.statusCode).toBe(500); // assertEligibleConsistency throws
  });
});

// ── CourseRun CRUD ─────────────────────────────────────────────────────────

async function setupApprovedCourse() {
  await seedCategory();
  const therapist = await seedTherapist();

  const createRes = await app.inject({
    method: 'POST',
    url: '/courses/my',
    headers: THERAPIST_AUTH,
    payload: COURSE_PAYLOAD,
  });
  const courseId = createRes.json().id;

  await app.inject({
    method: 'PATCH',
    url: `/admin/courses/${courseId}/review`,
    headers: ADMIN_AUTH,
    payload: { status: 'APPROVED' },
  });

  return { therapist, courseId };
}

describe('CourseRun CRUD', () => {
  it('erstellt und veröffentlicht einen Durchlauf mit Terminen', async () => {
    const { courseId } = await setupApprovedCourse();

    const createRun = await app.inject({
      method: 'POST',
      url: `/courses/my/${courseId}/runs`,
      headers: THERAPIST_AUTH,
      payload: { maxParticipants: 10, city: 'Berlin' },
    });
    expect(createRun.statusCode).toBe(201);
    const runId = createRun.json().id;

    // Termine hinzufügen
    const now = new Date();
    const sessions = [
      { startsAt: new Date(now.getTime() + 7 * 86400000).toISOString(), endsAt: new Date(now.getTime() + 7 * 86400000 + 5400000).toISOString() },
      { startsAt: new Date(now.getTime() + 14 * 86400000).toISOString(), endsAt: new Date(now.getTime() + 14 * 86400000 + 5400000).toISOString() },
    ];

    const createSessions = await app.inject({
      method: 'POST',
      url: `/courses/my/${courseId}/runs/${runId}/sessions`,
      headers: THERAPIST_AUTH,
      payload: sessions,
    });
    expect(createSessions.statusCode).toBe(201);
    expect(createSessions.json()).toHaveLength(2);

    // Veröffentlichen
    const publish = await app.inject({
      method: 'PATCH',
      url: `/courses/my/${courseId}/runs/${runId}/status`,
      headers: THERAPIST_AUTH,
      payload: { status: 'PUBLISHED' },
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().status).toBe('PUBLISHED');
  });

  it('blockiert Veröffentlichung ohne Termine', async () => {
    const { courseId } = await setupApprovedCourse();

    const createRun = await app.inject({
      method: 'POST',
      url: `/courses/my/${courseId}/runs`,
      headers: THERAPIST_AUTH,
      payload: { maxParticipants: 5 },
    });
    const runId = createRun.json().id;

    const publish = await app.inject({
      method: 'PATCH',
      url: `/courses/my/${courseId}/runs/${runId}/status`,
      headers: THERAPIST_AUTH,
      payload: { status: 'PUBLISHED' },
    });
    expect(publish.statusCode).toBe(500); // assertRunPublishable throws
  });

  it('blockiert Änderungen an abgesagtem Durchlauf', async () => {
    const { courseId } = await setupApprovedCourse();

    const createRun = await app.inject({
      method: 'POST',
      url: `/courses/my/${courseId}/runs`,
      headers: THERAPIST_AUTH,
      payload: { maxParticipants: 5 },
    });
    expect(createRun.statusCode).toBe(201);
    const runId = createRun.json().id;

    const cancel = await app.inject({
      method: 'PATCH',
      url: `/courses/my/${courseId}/runs/${runId}/status`,
      headers: THERAPIST_AUTH,
      payload: { status: 'CANCELLED', cancelReason: 'Test-Absage' },
    });
    expect(cancel.statusCode).toBe(200);

    const update = await app.inject({
      method: 'PUT',
      url: `/courses/my/${courseId}/runs/${runId}`,
      headers: THERAPIST_AUTH,
      payload: { maxParticipants: 20 },
    });
    expect(update.statusCode).toBe(500); // assertRunNotTerminal throws
  });
});

// ── Enrollment Flow ───────────────────────────────────────────────────────

async function setupPublishedRun() {
  const { courseId } = await setupApprovedCourse();

  const createRun = await app.inject({
    method: 'POST',
    url: `/courses/my/${courseId}/runs`,
    headers: THERAPIST_AUTH,
    payload: { maxParticipants: 2, waitlistEnabled: true, waitlistMax: 1, city: 'Berlin' },
  });
  const runId = createRun.json().id;

  const now = new Date();
  await app.inject({
    method: 'POST',
    url: `/courses/my/${courseId}/runs/${runId}/sessions`,
    headers: THERAPIST_AUTH,
    payload: [
      { startsAt: new Date(now.getTime() + 7 * 86400000).toISOString(), endsAt: new Date(now.getTime() + 7 * 86400000 + 5400000).toISOString() },
    ],
  });

  await app.inject({
    method: 'PATCH',
    url: `/courses/my/${courseId}/runs/${runId}/status`,
    headers: THERAPIST_AUTH,
    payload: { status: 'PUBLISHED' },
  });

  return { courseId, runId };
}

const ENROLL_PAYLOAD = {
  patientName: 'Max Mustermann',
  patientEmail: 'max@example.de',
  consentAccepted: true,
};

describe('Enrollment Flow', () => {
  it('Anmeldung → EMAIL_UNCONFIRMED', async () => {
    const { runId } = await setupPublishedRun();

    const res = await app.inject({
      method: 'POST',
      url: `/courses/runs/${runId}/enroll`,
      payload: ENROLL_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('EMAIL_UNCONFIRMED');
  });

  it('Double-Opt-In: Confirm-Token setzt Status auf PENDING', async () => {
    const { runId } = await setupPublishedRun();

    await app.inject({
      method: 'POST',
      url: `/courses/runs/${runId}/enroll`,
      payload: ENROLL_PAYLOAD,
    });

    const enrollment = await prisma.courseEnrollment.findFirst({ where: { courseRunId: runId } });
    expect(enrollment).not.toBeNull();
    const token = enrollment!.confirmToken!;

    // GET erst validieren
    const getRes = await app.inject({ method: 'GET', url: `/courses/confirm?token=${token}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().valid).toBe(true);

    // POST bestätigt
    const postRes = await app.inject({
      method: 'POST',
      url: '/courses/confirm',
      payload: { token },
    });
    expect(postRes.statusCode).toBe(200);
    expect(postRes.json().status).toBe('PENDING');
  });

  it('Stornierung durch Teilnehmer', async () => {
    const { runId } = await setupPublishedRun();

    await app.inject({
      method: 'POST',
      url: `/courses/runs/${runId}/enroll`,
      payload: ENROLL_PAYLOAD,
    });

    const enrollment = await prisma.courseEnrollment.findFirst({ where: { courseRunId: runId } });
    const cancelToken = enrollment!.cancelToken;

    // GET erst
    const getRes = await app.inject({ method: 'GET', url: `/courses/cancel?token=${cancelToken}` });
    expect(getRes.statusCode).toBe(200);

    // POST storniert
    const postRes = await app.inject({
      method: 'POST',
      url: '/courses/cancel',
      payload: { token: cancelToken },
    });
    expect(postRes.statusCode).toBe(200);
    expect(postRes.json().cancelled).toBe(true);

    const updated = await prisma.courseEnrollment.findFirst({ where: { courseRunId: runId } });
    expect(updated!.status).toBe('CANCELLED');
    expect(updated!.cancelledBy).toBe('PARTICIPANT');
  });

  it('Warteliste wenn ausgebucht', async () => {
    const { runId } = await setupPublishedRun();

    // 2 Anmeldungen füllen den Kurs (maxParticipants=2, aber erst nach Bestätigung PENDING/CONFIRMED)
    // EMAIL_UNCONFIRMED zählen nicht als active → Warteliste erst nach PENDING/CONFIRMED
    // Daher: direkt PENDING-Status in DB setzen um Kapazität zu simulieren
    await prisma.courseEnrollment.create({
      data: { courseRunId: runId, patientName: 'A', patientEmail: 'a@test.de', status: 'PENDING' as any, cancelToken: 'tok-wl-1', consentAcceptedAt: new Date() },
    });
    await prisma.courseEnrollment.create({
      data: { courseRunId: runId, patientName: 'B', patientEmail: 'b@test.de', status: 'PENDING' as any, cancelToken: 'tok-wl-2', consentAcceptedAt: new Date() },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/courses/runs/${runId}/enroll`,
      payload: { ...ENROLL_PAYLOAD, patientEmail: 'c@test.de' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('WAITLISTED');
  });

  it('Upsert: stornierte Anmeldung wird reaktiviert', async () => {
    const { runId } = await setupPublishedRun();

    // Erst anmelden
    await app.inject({
      method: 'POST',
      url: `/courses/runs/${runId}/enroll`,
      payload: ENROLL_PAYLOAD,
    });

    // Stornieren
    const enrollment = await prisma.courseEnrollment.findFirst({ where: { courseRunId: runId } });
    await prisma.courseEnrollment.update({
      where: { id: enrollment!.id },
      data: { status: 'CANCELLED' },
    });

    // Neu anmelden → Upsert
    const res = await app.inject({
      method: 'POST',
      url: `/courses/runs/${runId}/enroll`,
      payload: ENROLL_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);

    const count = await prisma.courseEnrollment.count({ where: { courseRunId: runId } });
    expect(count).toBe(1); // kein Duplikat
  });

  it('Kursabsage benachrichtigt alle Teilnehmer', async () => {
    const { courseId, runId } = await setupPublishedRun();

    await prisma.courseEnrollment.create({
      data: { courseRunId: runId, patientName: 'A', patientEmail: 'a@test.de', status: 'CONFIRMED' as any, cancelToken: 'tok-cancel-1', consentAcceptedAt: new Date() },
    });

    // Kurs absagen
    await app.inject({
      method: 'PATCH',
      url: `/courses/my/${courseId}/runs/${runId}/status`,
      headers: THERAPIST_AUTH,
      payload: { status: 'CANCELLED', cancelReason: 'Zu wenig Anmeldungen.' },
    });

    const notify = await app.inject({
      method: 'POST',
      url: `/courses/my/${courseId}/runs/${runId}/cancel-notify`,
      headers: THERAPIST_AUTH,
    });
    expect(notify.statusCode).toBe(200);
    expect(notify.json().notified).toBe(1);

    const remaining = await prisma.courseEnrollment.findMany({ where: { courseRunId: runId, status: 'CONFIRMED' } });
    expect(remaining).toHaveLength(0);
  });
});

// ── Öffentliche Kurssuche ──────────────────────────────────────────────────

describe('GET /courses (public)', () => {
  it('gibt freigegebene Kurse mit veröffentlichten Runs zurück', async () => {
    const { courseId } = await setupApprovedCourse();

    const createRun = await app.inject({
      method: 'POST',
      url: `/courses/my/${courseId}/runs`,
      headers: THERAPIST_AUTH,
      payload: { maxParticipants: 10, city: 'Berlin' },
    });
    const runId = createRun.json().id;

    const now = new Date();
    await app.inject({
      method: 'POST',
      url: `/courses/my/${courseId}/runs/${runId}/sessions`,
      headers: THERAPIST_AUTH,
      payload: [
        { startsAt: new Date(now.getTime() + 7 * 86400000).toISOString(), endsAt: new Date(now.getTime() + 7 * 86400000 + 3600000).toISOString() },
      ],
    });

    await app.inject({
      method: 'PATCH',
      url: `/courses/my/${courseId}/runs/${runId}/status`,
      headers: THERAPIST_AUTH,
      payload: { status: 'PUBLISHED' },
    });

    const res = await app.inject({ method: 'GET', url: '/courses' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.courses[0].title).toBe('Rückenfit Kurs');
  });

  it('gibt Kursdetail zurück', async () => {
    const { courseId } = await setupApprovedCourse();
    const res = await app.inject({ method: 'GET', url: `/courses/${courseId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(courseId);
  });

  it('gibt 404 für DRAFT-Kurse zurück', async () => {
    await seedCategory();
    await seedTherapist();

    const create = await app.inject({
      method: 'POST',
      url: '/courses/my',
      headers: THERAPIST_AUTH,
      payload: COURSE_PAYLOAD,
    });
    const courseId = create.json().id;

    const res = await app.inject({ method: 'GET', url: `/courses/${courseId}` });
    expect(res.statusCode).toBe(404);
  });
});
