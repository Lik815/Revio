import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';

process.env.DATABASE_URL ??= 'file:./prisma/test.db';
process.env.REVIO_ADMIN_TOKEN ??= 'test-token';

const AUTH = { authorization: 'Bearer test-token' };

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

// Clean DB between test suites
afterEach(async () => {
  await prisma.practiceManager.deleteMany();
  await prisma.user.deleteMany();
  await prisma.bookingRequest.deleteMany();
  await prisma.therapistPracticeLink.deleteMany();
  await prisma.therapist.deleteMany();
  await prisma.practice.deleteMany();
});

// ─── Health ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

// ─── Search ───────────────────────────────────────────────────────────────────

describe('POST /search', () => {
  it('returns 400 on missing body', async () => {
    const res = await app.inject({ method: 'POST', url: '/search', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 on empty query', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: '', city: 'Köln' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns empty results for empty DB', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'rücken', city: 'Köln' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapists).toHaveLength(0);
    expect(body.practices).toHaveLength(0);
  });

  it('returns only APPROVED therapists with CONFIRMED links', async () => {
    const practice = await prisma.practice.create({
      data: { name: 'Test Praxis', city: 'Köln', reviewStatus: 'APPROVED' },
    });
    // APPROVED therapist with CONFIRMED link → should appear
    const approved = await prisma.therapist.create({
      data: {
        email: 'approved@test.com',
        fullName: 'Max Approved',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'back pain',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: practice.id, status: 'CONFIRMED' } },
      },
    });
    // PENDING therapist → should NOT appear
    await prisma.therapist.create({
      data: {
        email: 'pending@test.com',
        fullName: 'Lisa Pending',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'back pain',
        languages: 'de',
        certifications: '',
        reviewStatus: 'PENDING_REVIEW',
        links: { create: { practiceId: practice.id, status: 'PROPOSED' } },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'back pain', city: 'Köln' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapists).toHaveLength(1);
    expect(body.therapists[0].id).toBe(approved.id);
    expect(body.therapists[0].fullName).toBe('Max Approved');
  });

  it('filters by homeVisit', async () => {
    const practice = await prisma.practice.create({
      data: { name: 'Test Praxis', city: 'Köln', reviewStatus: 'APPROVED' },
    });
    await prisma.therapist.create({
      data: {
        email: 'home@test.com',
        fullName: 'Home Visitor',
        professionalTitle: 'PT',
        city: 'Köln',
        homeVisit: true,
        specializations: 'rücken',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: practice.id, status: 'CONFIRMED' } },
      },
    });
    await prisma.therapist.create({
      data: {
        email: 'nohome@test.com',
        fullName: 'No Home Visit',
        professionalTitle: 'PT',
        city: 'Köln',
        homeVisit: false,
        specializations: 'rücken',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: practice.id, status: 'CONFIRMED' } },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'rücken', city: 'Köln', homeVisit: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapists).toHaveLength(1);
    expect(body.therapists[0].fullName).toBe('Home Visitor');
  });

  it('finds standalone mobile therapists for "mobile physio"', async () => {
    const practice = await prisma.practice.create({
      data: { name: 'Test Praxis', city: 'Köln', reviewStatus: 'APPROVED' },
    });

    await prisma.therapist.create({
      data: {
        email: 'standalone-mobile@test.com',
        fullName: 'Mobile Köln',
        professionalTitle: 'PT',
        city: 'Köln',
        homeVisit: true,
        serviceRadiusKm: 15,
        kassenart: 'ALLE',
        specializations: 'orthopädie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
      },
    });

    await prisma.therapist.create({
      data: {
        email: 'linked-mobile@test.com',
        fullName: 'Praxis Mobil',
        professionalTitle: 'PT',
        city: 'Köln',
        homeVisit: true,
        specializations: 'orthopädie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: practice.id, status: 'CONFIRMED' } },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'mobile physio', city: 'Köln' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapists).toHaveLength(2);
    expect(body.therapists[0].fullName).toBe('Mobile Köln');
    expect(body.therapists[0].homeVisit).toBe(true);
  });

  it('returns requestable fields for a directly requestable therapist', async () => {
    await prisma.therapist.create({
      data: {
        email: 'requestable@test.com',
        fullName: 'Requestable Therapist',
        professionalTitle: 'PT',
        city: 'Köln',
        homeVisit: true,
        serviceRadiusKm: 15,
        kassenart: 'ALLE',
        specializations: 'orthopädie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        bookingMode: 'FIRST_APPOINTMENT_REQUEST',
        nextFreeSlotAt: new Date('2026-04-02T09:00:00.000Z'),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'mobile physio', city: 'Köln', requestable: true },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapists).toHaveLength(1);
    expect(body.therapists[0].requestable).toBe(true);
    expect(body.therapists[0].bookingMode).toBe('FIRST_APPOINTMENT_REQUEST');
    expect(body.therapists[0].nextFreeSlotAt).toBe('2026-04-02T09:00:00.000Z');
  });

  it('finds therapists by reversed and partial name queries', async () => {
    const practice = await prisma.practice.create({
      data: { name: 'Name Praxis', city: 'Köln', reviewStatus: 'APPROVED' },
    });

    await prisma.therapist.create({
      data: {
        email: 'anna-becker@test.com',
        fullName: 'Anna Becker',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'rücken',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: practice.id, status: 'CONFIRMED' } },
      },
    });

    await prisma.therapist.create({
      data: {
        email: 'maria-schmitz@test.com',
        fullName: 'Maria Schmitz',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'rücken',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: practice.id, status: 'CONFIRMED' } },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'becker an', city: 'Köln' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapists.length).toBeGreaterThan(0);
    expect(body.therapists[0].fullName).toBe('Anna Becker');
  });

  it('supports nearby search with origin and radius', async () => {
    const nearPractice = await prisma.practice.create({
      data: {
        name: 'Near Praxis',
        city: 'Berlin',
        address: 'Mitte 1',
        lat: 52.5200,
        lng: 13.4050,
        reviewStatus: 'APPROVED',
      },
    });
    const farPractice = await prisma.practice.create({
      data: {
        name: 'Far Praxis',
        city: 'Hamburg',
        address: 'Elbe 1',
        lat: 53.5753,
        lng: 10.0153,
        reviewStatus: 'APPROVED',
      },
    });

    await prisma.therapist.create({
      data: {
        email: 'nearby@test.com',
        fullName: 'Nearby Therapist',
        professionalTitle: 'PT',
        city: 'Berlin',
        specializations: 'physiotherapie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: nearPractice.id, status: 'CONFIRMED' } },
      },
    });
    await prisma.therapist.create({
      data: {
        email: 'faraway@test.com',
        fullName: 'Far Away Therapist',
        professionalTitle: 'PT',
        city: 'Hamburg',
        specializations: 'physiotherapie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: farPractice.id, status: 'CONFIRMED' } },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: {
        query: 'physiotherapie',
        origin: { lat: 52.5200, lng: 13.4050 },
        radiusKm: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapists).toHaveLength(1);
    expect(body.therapists[0].fullName).toBe('Nearby Therapist');
    expect(body.therapists[0].practices).toHaveLength(1);
    expect(body.therapists[0].practices[0].id).toBe(nearPractice.id);
    expect(body.therapists[0].distKm).toBeLessThan(0.1);
    expect(body.practices).toHaveLength(1);
    expect(body.practices[0].id).toBe(nearPractice.id);
  });

  it('keeps only nearby practices for therapists with multiple linked practices', async () => {
    const nearPractice = await prisma.practice.create({
      data: {
        name: 'Near Praxis',
        city: 'Berlin',
        address: 'Mitte 1',
        lat: 52.5200,
        lng: 13.4050,
        reviewStatus: 'APPROVED',
      },
    });
    const farPractice = await prisma.practice.create({
      data: {
        name: 'Far Praxis',
        city: 'Leipzig',
        address: 'Ring 1',
        lat: 51.3397,
        lng: 12.3731,
        reviewStatus: 'APPROVED',
      },
    });

    await prisma.therapist.create({
      data: {
        email: 'multi@test.com',
        fullName: 'Multi Practice Therapist',
        professionalTitle: 'PT',
        city: 'Berlin',
        specializations: 'physiotherapie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: {
          create: [
            { practiceId: nearPractice.id, status: 'CONFIRMED' },
            { practiceId: farPractice.id, status: 'CONFIRMED' },
          ],
        },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: {
        query: 'physiotherapie',
        city: 'Berlin',
        origin: { lat: 52.5200, lng: 13.4050 },
        radiusKm: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapists).toHaveLength(1);
    expect(body.therapists[0].practices).toHaveLength(1);
    expect(body.therapists[0].practices[0].id).toBe(nearPractice.id);
    expect(body.practices).toHaveLength(1);
    expect(body.practices[0].id).toBe(nearPractice.id);
  });

  it('combines nearby search with existing filters', async () => {
    const nearPractice = await prisma.practice.create({
      data: {
        name: 'Near Praxis',
        city: 'Berlin',
        address: 'Mitte 1',
        lat: 52.5200,
        lng: 13.4050,
        reviewStatus: 'APPROVED',
      },
    });

    await prisma.therapist.create({
      data: {
        email: 'home-near@test.com',
        fullName: 'Home Visit Nearby',
        professionalTitle: 'PT',
        city: 'Berlin',
        homeVisit: true,
        specializations: 'physiotherapie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: nearPractice.id, status: 'CONFIRMED' } },
      },
    });
    await prisma.therapist.create({
      data: {
        email: 'nohome-near@test.com',
        fullName: 'No Home Visit Nearby',
        professionalTitle: 'PT',
        city: 'Berlin',
        homeVisit: false,
        specializations: 'physiotherapie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: nearPractice.id, status: 'CONFIRMED' } },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: {
        query: 'physiotherapie',
        origin: { lat: 52.5200, lng: 13.4050 },
        radiusKm: 5,
        homeVisit: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapists).toHaveLength(1);
    expect(body.therapists[0].fullName).toBe('Home Visit Nearby');
  });

  it('relevance: matching specialization scores higher', async () => {
    const practice = await prisma.practice.create({
      data: { name: 'Test Praxis', city: 'Köln', reviewStatus: 'APPROVED' },
    });
    await prisma.therapist.create({
      data: {
        email: 'no-match@test.com',
        fullName: 'No Match',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'knie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: practice.id, status: 'CONFIRMED' } },
      },
    });
    await prisma.therapist.create({
      data: {
        email: 'match@test.com',
        fullName: 'Relevant Match',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'back pain',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        links: { create: { practiceId: practice.id, status: 'CONFIRMED' } },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'back pain', city: 'Köln' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Non-matching therapists are now filtered out; only the matching one is returned
    expect(body.therapists).toHaveLength(1);
    expect(body.therapists[0].fullName).toBe('Relevant Match');
    expect(body.therapists[0].relevance).toBeGreaterThan(0);
  });
});

describe('GET /practice-detail/:id', () => {
  it('returns public therapists for an approved practice detail page', async () => {
    const practice = await prisma.practice.create({
      data: {
        name: 'Praxis Detail',
        city: 'Köln',
        reviewStatus: 'APPROVED',
      },
    });

    const visibleTherapist = await prisma.therapist.create({
      data: {
        email: 'practice-detail-visible@test.com',
        fullName: 'Visible Therapist',
        professionalTitle: 'Physiotherapeutin',
        city: 'Köln',
        bio: 'Vollständiges Profil für die Praxisdetailseite.',
        specializations: 'Manuelle Therapie, Lymphdrainage',
        languages: 'de, en',
        certifications: '',
        reviewStatus: 'APPROVED',
        isVisible: true,
        isPublished: true,
        onboardingStatus: 'claimed',
        links: {
          create: {
            practiceId: practice.id,
            status: 'CONFIRMED',
          },
        },
      },
    });

    await prisma.therapist.create({
      data: {
        email: 'practice-detail-hidden@test.com',
        fullName: 'Hidden Therapist',
        professionalTitle: 'Physiotherapeut',
        city: 'Köln',
        bio: 'Sollte nicht auf der Praxisdetailseite erscheinen.',
        specializations: 'Bobath-Therapie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        isVisible: true,
        isPublished: false,
        onboardingStatus: 'claimed',
        links: {
          create: {
            practiceId: practice.id,
            status: 'CONFIRMED',
          },
        },
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/practice-detail/${practice.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.practice.id).toBe(practice.id);
    expect(body.therapists).toHaveLength(1);
    expect(body.therapists[0].id).toBe(visibleTherapist.id);
    expect(body.therapists[0].fullName).toBe('Visible Therapist');
    expect(body.therapists[0].specializations).toEqual(['Manuelle Therapie', 'Lymphdrainage']);
  });
});

// ─── Booking Requests ─────────────────────────────────────────────────────────

describe('Booking Requests', () => {
  it('creates and lists a guest booking request for a requestable therapist', async () => {
    const therapist = await prisma.therapist.create({
      data: {
        email: 'bookable@test.com',
        fullName: 'Bookable Therapist',
        professionalTitle: 'PT',
        city: 'Köln',
        homeVisit: true,
        serviceRadiusKm: 15,
        kassenart: 'ALLE',
        specializations: 'orthopädie',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        bookingMode: 'FIRST_APPOINTMENT_REQUEST',
        sessionToken: 'therapist-booking-token',
      },
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/booking-requests',
      payload: {
        therapistId: therapist.id,
        patientName: 'Max Mustermann',
        patientEmail: 'max@example.com',
        preferredDays: ['Montag', 'Dienstag'],
        preferredTimeWindows: ['Vormittag'],
        message: 'Bitte um einen Ersttermin',
        consentAccepted: true,
      },
    });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().status).toBe('PENDING');

    const listRes = await app.inject({
      method: 'GET',
      url: '/auth/booking-requests',
      headers: { authorization: 'Bearer therapist-booking-token' },
    });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().requests).toHaveLength(1);
    expect(listRes.json().requests[0].patientName).toBe('Max Mustermann');
    expect(listRes.json().requests[0].status).toBe('PENDING');
  });
});

// ─── Registration ─────────────────────────────────────────────────────────────

describe('POST /register/therapist', () => {
  const validPayload = {
    email: 'new@test.com',
    fullName: 'New Therapist',
    professionalTitle: 'Physiotherapeut',
    city: 'Köln',
    homeVisit: false,
    specializations: ['back pain'],
    languages: ['de'],
    certifications: ['MT'],
    practice: { name: 'Neue Praxis', city: 'Köln' },
  };

  it('returns 400 on missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: { email: 'only@email.com' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 on invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: { ...validPayload, email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates therapist and practice with PENDING_REVIEW status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.therapistId).toBeTruthy();

    const therapist = await prisma.therapist.findUnique({ where: { id: body.therapistId } });
    // In dev/test mode register auto-approves; in production it stays PENDING_REVIEW
    const expectedStatus = process.env.NODE_ENV !== 'production' ? 'APPROVED' : 'PENDING_REVIEW';
    expect(therapist?.reviewStatus).toBe(expectedStatus);
    expect(therapist?.email).toBe(validPayload.email);
  });

  it('returns 409 on duplicate email', async () => {
    await app.inject({ method: 'POST', url: '/register/therapist', payload: validPayload });
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: { ...validPayload, email: validPayload.email },
    });
    expect(res.statusCode).toBe(409);
  });

  it('creates a practice and PROPOSED link', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: validPayload,
    });
    const body = res.json();
    const link = await prisma.therapistPracticeLink.findFirst({
      where: { therapistId: body.therapistId },
    });
    // In dev/test mode auto-approve confirms the link immediately
    const expectedLinkStatus = process.env.NODE_ENV !== 'production' ? 'CONFIRMED' : 'PROPOSED';
    expect(link?.status).toBe(expectedLinkStatus);
  });
});

// ─── Admin Auth ───────────────────────────────────────────────────────────────

describe('Admin authentication', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/therapists' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with wrong token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/therapists',
      headers: { authorization: 'Bearer wrong-token' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Admin Stats ──────────────────────────────────────────────────────────────

describe('GET /admin/stats', () => {
  it('returns all status counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/stats', headers: AUTH });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapists).toHaveProperty('pending_review');
    expect(body.therapists).toHaveProperty('approved');
    expect(body.practices).toHaveProperty('pending_review');
    expect(body.links).toHaveProperty('proposed');
  });

  it('reflects actual DB counts', async () => {
    await prisma.therapist.create({
      data: {
        email: 'stat@test.com',
        fullName: 'Stat Test',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'test',
        languages: 'de',
        certifications: '',
        reviewStatus: 'PENDING_REVIEW',
      },
    });

    const res = await app.inject({ method: 'GET', url: '/admin/stats', headers: AUTH });
    const body = res.json();
    expect(body.therapists.pending_review).toBe(1);
    expect(body.therapists.approved).toBe(0);
  });
});

// ─── Admin Therapists ─────────────────────────────────────────────────────────

describe('Admin therapist routes', () => {
  let therapistId: string;

  beforeEach(async () => {
    const t = await prisma.therapist.create({
      data: {
        email: 'admin-t@test.com',
        fullName: 'Admin Test Therapist',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'rücken',
        languages: 'de',
        certifications: '',
        reviewStatus: 'PENDING_REVIEW',
      },
    });
    therapistId = t.id;
  });

  it('GET /admin/therapists returns array', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/therapists', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    expect(res.json()).toHaveLength(1);
  });

  it('GET /admin/therapists/:id returns therapist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/admin/therapists/${therapistId}`,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().fullName).toBe('Admin Test Therapist');
    expect(Array.isArray(res.json().specializations)).toBe(true);
  });

  it('GET /admin/therapists/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/therapists/nonexistent-id',
      headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /admin/therapists/:id/approve sets APPROVED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/therapists/${therapistId}/approve`,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const t = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect(t?.reviewStatus).toBe('APPROVED');
  });

  it('POST /admin/therapists/:id/reject sets REJECTED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/therapists/${therapistId}/reject`,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const t = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect(t?.reviewStatus).toBe('REJECTED');
  });

  it('POST /admin/therapists/:id/request-changes sets CHANGES_REQUESTED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/therapists/${therapistId}/request-changes`,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const t = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect(t?.reviewStatus).toBe('CHANGES_REQUESTED');
  });

  it('POST /admin/therapists/:id/suspend sets SUSPENDED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/therapists/${therapistId}/suspend`,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const t = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect(t?.reviewStatus).toBe('SUSPENDED');
  });
});

// ─── Admin Practices ──────────────────────────────────────────────────────────

describe('Admin practice routes', () => {
  let practiceId: string;

  beforeEach(async () => {
    const p = await prisma.practice.create({
      data: { name: 'Test Praxis', city: 'Köln', reviewStatus: 'PENDING_REVIEW' },
    });
    practiceId = p.id;
  });

  it('GET /admin/practices returns array', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/practices', headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('POST /admin/practices/:id/approve sets APPROVED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/practices/${practiceId}/approve`,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const p = await prisma.practice.findUnique({ where: { id: practiceId } });
    expect(p?.reviewStatus).toBe('APPROVED');
  });

  it('POST /admin/practices/:id/reject sets REJECTED', async () => {
    await app.inject({ method: 'POST', url: `/admin/practices/${practiceId}/reject`, headers: AUTH });
    const p = await prisma.practice.findUnique({ where: { id: practiceId } });
    expect(p?.reviewStatus).toBe('REJECTED');
  });

  it('GET /admin/practices/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/practices/nonexistent-id',
      headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
  });
});

// ─── Admin Links ──────────────────────────────────────────────────────────────

describe('Admin link routes', () => {
  let linkId: string;

  beforeEach(async () => {
    const practice = await prisma.practice.create({
      data: { name: 'Link Praxis', city: 'Köln' },
    });
    const therapist = await prisma.therapist.create({
      data: {
        email: 'link-t@test.com',
        fullName: 'Link Therapist',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'test',
        languages: 'de',
        certifications: '',
      },
    });
    const link = await prisma.therapistPracticeLink.create({
      data: { therapistId: therapist.id, practiceId: practice.id, status: 'PROPOSED' },
    });
    linkId = link.id;
  });

  it('GET /admin/links returns array with therapist and practice', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/links', headers: AUTH });
    expect(res.statusCode).toBe(200);
    const links = res.json();
    expect(links).toHaveLength(1);
    expect(links[0].therapist.fullName).toBe('Link Therapist');
    expect(links[0].practice.name).toBe('Link Praxis');
  });

  it('POST /admin/links/:id/confirm sets CONFIRMED', async () => {
    await app.inject({ method: 'POST', url: `/admin/links/${linkId}/confirm`, headers: AUTH });
    const l = await prisma.therapistPracticeLink.findUnique({ where: { id: linkId } });
    expect(l?.status).toBe('CONFIRMED');
  });

  it('POST /admin/links/:id/reject sets REJECTED', async () => {
    await app.inject({ method: 'POST', url: `/admin/links/${linkId}/reject`, headers: AUTH });
    const l = await prisma.therapistPracticeLink.findUnique({ where: { id: linkId } });
    expect(l?.status).toBe('REJECTED');
  });

  it('POST /admin/links/:id/dispute sets DISPUTED', async () => {
    await app.inject({ method: 'POST', url: `/admin/links/${linkId}/dispute`, headers: AUTH });
    const l = await prisma.therapistPracticeLink.findUnique({ where: { id: linkId } });
    expect(l?.status).toBe('DISPUTED');
  });

  it('returns 404 for unknown link id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/links/nonexistent/confirm',
      headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
  });
});

// ─── End-to-End Flow ──────────────────────────────────────────────────────────

describe('End-to-End: Register → Admin Approve → Visible in Search', () => {
  it('full flow works correctly', async () => {
    // 1. Therapeut registriert sich
    const regRes = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: {
        email: 'e2e@test.com',
        fullName: 'E2E Therapeut',
        professionalTitle: 'Physiotherapeut',
        city: 'Köln',
        homeVisit: true,
        specializations: ['back pain', 'sports'],
        languages: ['de'],
        certifications: ['MT'],
        practice: { name: 'E2E Praxis', city: 'Köln', phone: '+49 221 999' },
      },
    });
    expect(regRes.statusCode).toBe(201);
    const { therapistId } = regRes.json();

    const isDev = process.env.NODE_ENV !== 'production';

    if (!isDev) {
      // 2. Vor Freigabe: nicht in Suche sichtbar (nur in Production)
      const searchBefore = await app.inject({
        method: 'POST',
        url: '/search',
        payload: { query: 'back pain', city: 'Köln' },
      });
      expect(searchBefore.json().therapists).toHaveLength(0);

      // 3. Admin: Therapeut-Status abrufen
      const adminList = await app.inject({ method: 'GET', url: '/admin/therapists', headers: AUTH });
      const pending = adminList.json().find((t: { id: string }) => t.id === therapistId);
      expect(pending.reviewStatus).toBe('PENDING_REVIEW');

      // 4. Admin: Therapeut freigeben
      const approveRes = await app.inject({
        method: 'POST',
        url: `/admin/therapists/${therapistId}/approve`,
        headers: AUTH,
      });
      expect(approveRes.statusCode).toBe(200);

      // 5. Admin: Praxis freigeben + Link bestätigen
      const links = await app.inject({ method: 'GET', url: '/admin/links', headers: AUTH });
      const link = links.json().find((l: { therapistId: string }) => l.therapistId === therapistId);
      const practiceId = link.practiceId;
      await app.inject({ method: 'POST', url: `/admin/practices/${practiceId}/approve`, headers: AUTH });
      await app.inject({ method: 'POST', url: `/admin/links/${link.id}/confirm`, headers: AUTH });
    }

    // In dev mode the therapist is auto-approved and visible immediately.
    // In production the above admin steps are required first.
    const searchAfter = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'back pain', city: 'Köln' },
    });
    const results = searchAfter.json().therapists;
    expect(results).toHaveLength(1);
    expect(results[0].fullName).toBe('E2E Therapeut');
    expect(results[0].homeVisit).toBe(true);
    expect(results[0].practices[0].name).toBe('E2E Praxis');
  });
});

// ─── Invite Flow ──────────────────────────────────────────────────────────────

describe('Invite Flow: practice manager creates therapist profile', () => {
  let practiceId: string;
  let practiceAdminToken: string; // adminSessionToken for practice-auth routes

  beforeEach(async () => {
    const practice = await prisma.practice.create({
      data: { name: 'Einlade-Praxis', city: 'München', reviewStatus: 'APPROVED' },
    });
    practiceId = practice.id;
    await prisma.practiceManager.create({
      data: { email: 'praxis@test.de', passwordHash: 'hash', sessionToken: 'practice-session-token', practiceId: practice.id },
    });
    practiceAdminToken = 'practice-session-token';
  });

  const PRACTICE_AUTH = { authorization: `Bearer practice-session-token` };

  it('creates therapist with invited status, not published', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/invite/therapist',
      headers: PRACTICE_AUTH,
      payload: {
        fullName: 'Invited Therapeut',
        professionalTitle: 'Physiotherapeut',
        email: 'invited@test.de',
        specializations: ['rücken'],
        languages: ['de'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.therapistId).toBeTruthy();
    expect(body.inviteToken).toBeTruthy();

    const therapist = await prisma.therapist.findUnique({ where: { id: body.therapistId } });
    expect(therapist?.onboardingStatus).toBe('invited');
    expect(therapist?.isPublished).toBe(false);
    expect(therapist?.invitedByPracticeId).toBe(practiceId);
  });

  it('invited therapist is NOT visible in search before claiming', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/invite/therapist',
      headers: PRACTICE_AUTH,
      payload: {
        fullName: 'Hidden Therapeut',
        professionalTitle: 'PT',
        email: 'hidden@test.de',
        specializations: ['rücken'],
        languages: ['de'],
      },
    });
    expect(createRes.statusCode).toBe(201);

    const searchRes = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'rücken', city: 'München' },
    });
    expect(searchRes.statusCode).toBe(200);
    expect(searchRes.json().therapists).toHaveLength(0);
  });

  it('validate invite token returns therapist and practice info', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/invite/therapist',
      headers: PRACTICE_AUTH,
      payload: {
        fullName: 'Validate Test',
        professionalTitle: 'PT',
        email: 'validate@test.de',
        specializations: [],
        languages: [],
      },
    });
    const { inviteToken } = createRes.json();

    const res = await app.inject({
      method: 'GET',
      url: `/invite/validate?token=${inviteToken}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(true);
    expect(body.therapist.fullName).toBe('Validate Test');
    expect(body.practice.name).toBe('Einlade-Praxis');
  });

  it('claim sets password and returns session token; profile still NOT published', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/invite/therapist',
      headers: PRACTICE_AUTH,
      payload: {
        fullName: 'Claimer',
        professionalTitle: 'PT',
        email: 'claimer@test.de',
        specializations: ['rücken'],
        languages: ['de'],
      },
    });
    const { therapistId, inviteToken } = createRes.json();

    const claimRes = await app.inject({
      method: 'POST',
      url: '/invite/claim',
      payload: { token: inviteToken, password: 'password123' },
    });
    expect(claimRes.statusCode).toBe(200);
    const claimBody = claimRes.json();
    expect(claimBody.token).toBeTruthy();
    expect(claimBody.therapistId).toBe(therapistId);

    // Profile still not published after claim alone
    const therapist = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect(therapist?.onboardingStatus).toBe('claimed');
    expect(therapist?.isPublished).toBe(false);

    // Still not in search
    const searchRes = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'rücken', city: 'München' },
    });
    expect(searchRes.json().therapists).toHaveLength(0);
  });

  it('incomplete profile cannot be published: PATCH /invite/visibility returns isPublished: false', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/invite/therapist',
      headers: PRACTICE_AUTH,
      payload: {
        fullName: 'Incomplete',
        professionalTitle: 'PT',
        email: 'incomplete@test.de',
        specializations: [],   // missing — required for profile completion
        languages: [],         // missing
      },
    });
    const { inviteToken } = createRes.json();

    const claimRes = await app.inject({
      method: 'POST',
      url: '/invite/claim',
      payload: { token: inviteToken, password: 'password123' },
    });
    const { token: sessionToken } = claimRes.json();

    // Try to set visible — should stay unpublished due to missing fields
    const visRes = await app.inject({
      method: 'PATCH',
      url: '/invite/visibility',
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { visibilityPreference: 'visible' },
    });
    expect(visRes.statusCode).toBe(200);
    const visBody = visRes.json();
    expect(visBody.isPublished).toBe(false);
    expect(visBody.profileComplete).toBe(false);
    expect(visBody.missingFields.length).toBeGreaterThan(0);
  });

  it('full invite flow: create → claim → complete profile → confirm → visible in search', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/invite/therapist',
      headers: PRACTICE_AUTH,
      payload: {
        fullName: 'Full Flow',
        professionalTitle: 'Physiotherapeutin',
        email: 'fullflow@test.de',
        specializations: ['rücken'],
        languages: ['de'],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { therapistId, inviteToken } = createRes.json();

    // Claim
    const claimRes = await app.inject({
      method: 'POST',
      url: '/invite/claim',
      payload: { token: inviteToken, password: 'secret123' },
    });
    const { token: sessionToken } = claimRes.json();
    const SESSION = { authorization: `Bearer ${sessionToken}` };

    // Complete profile (bio is required)
    await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: SESSION,
      payload: { bio: 'Erfahrene Physiotherapeutin.' },
    });

    // Confirm visibility
    const visRes = await app.inject({
      method: 'PATCH',
      url: '/invite/visibility',
      headers: SESSION,
      payload: { visibilityPreference: 'visible' },
    });
    expect(visRes.statusCode).toBe(200);
    expect(visRes.json().isPublished).toBe(true);

    // Now visible in search
    const searchRes = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'rücken', city: 'München' },
    });
    expect(searchRes.statusCode).toBe(200);
    const therapists = searchRes.json().therapists;
    expect(therapists).toHaveLength(1);
    expect(therapists[0].fullName).toBe('Full Flow');
  });

  it('resend invite invalidates old token and creates new one', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/invite/therapist',
      headers: PRACTICE_AUTH,
      payload: {
        fullName: 'Resend Test',
        professionalTitle: 'PT',
        email: 'resend@test.de',
        specializations: [],
        languages: [],
      },
    });
    const { therapistId, inviteToken: oldToken } = createRes.json();

    const resendRes = await app.inject({
      method: 'POST',
      url: '/invite/resend',
      headers: PRACTICE_AUTH,
      payload: { therapistId },
    });
    expect(resendRes.statusCode).toBe(200);
    const { inviteToken: newToken } = resendRes.json();
    expect(newToken).not.toBe(oldToken);

    // Old token is now invalid
    const oldValidate = await app.inject({ method: 'GET', url: `/invite/validate?token=${oldToken}` });
    expect(oldValidate.statusCode).toBe(400);

    // New token is valid
    const newValidate = await app.inject({ method: 'GET', url: `/invite/validate?token=${newToken}` });
    expect(newValidate.statusCode).toBe(200);
  });

  it('duplicate email returns 409', async () => {
    await app.inject({
      method: 'POST',
      url: '/invite/therapist',
      headers: PRACTICE_AUTH,
      payload: { fullName: 'First', professionalTitle: 'PT', email: 'dup@test.de', specializations: [], languages: [] },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/invite/therapist',
      headers: PRACTICE_AUTH,
      payload: { fullName: 'Second', professionalTitle: 'PT', email: 'dup@test.de', specializations: [], languages: [] },
    });
    expect(res.statusCode).toBe(409);
  });

  it('expired token cannot be claimed', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/invite/therapist',
      headers: PRACTICE_AUTH,
      payload: { fullName: 'Expired', professionalTitle: 'PT', email: 'expired@test.de', specializations: [], languages: [] },
    });
    const { therapistId, inviteToken } = createRes.json();

    // Manually expire the invitation
    await prisma.invitation.updateMany({
      where: { therapistId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const claimRes = await app.inject({
      method: 'POST',
      url: '/invite/claim',
      payload: { token: inviteToken, password: 'pass123' },
    });
    expect(claimRes.statusCode).toBe(400);
  });
});

// ─── Manager Auth ─────────────────────────────────────────────────────────────

describe('POST /manager/register', () => {
  it('creates manager-only account (isTherapist=false)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/manager/register',
      payload: {
        email: 'mgr@test.de',
        password: 'sicher123',
        practiceName: 'Test Praxis',
        practiceCity: 'Berlin',
        isTherapist: false,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.isTherapist).toBe(false);
    expect(body.therapistId).toBeNull();

    // No therapist record should exist for this email
    const therapist = await prisma.therapist.findUnique({ where: { email: 'mgr@test.de' } });
    expect(therapist).toBeNull();

    // Manager and practice should exist
    const manager = await prisma.practiceManager.findUnique({ where: { email: 'mgr@test.de' } });
    expect(manager).not.toBeNull();
    expect(manager?.practiceId).toBe(body.practiceId);
  });

  it('creates manager + therapist profile (isTherapist=true)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/manager/register',
      payload: {
        email: 'mgr2@test.de',
        password: 'sicher123',
        practiceName: 'Test Praxis 2',
        practiceCity: 'München',
        isTherapist: true,
        fullName: 'Dr. Eva Muster',
        professionalTitle: 'Physiotherapeutin',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.isTherapist).toBe(true);
    expect(body.therapistId).toBeTruthy();

    // Therapist profile exists but is unpublished and hidden
    const therapist = await prisma.therapist.findUnique({ where: { id: body.therapistId } });
    expect(therapist).not.toBeNull();
    expect(therapist?.isPublished).toBe(false);
    expect(therapist?.isVisible).toBe(false);

    // Manager is linked to therapist
    const manager = await prisma.practiceManager.findUnique({ where: { email: 'mgr2@test.de' } });
    expect(manager?.therapistId).toBe(body.therapistId);
  });

  it('returns 400 when isTherapist=true but fullName missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/manager/register',
      payload: {
        email: 'mgr3@test.de',
        password: 'sicher123',
        practiceName: 'Test Praxis 3',
        practiceCity: 'Hamburg',
        isTherapist: true,
        // fullName and professionalTitle missing
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 on duplicate email', async () => {
    const payload = {
      email: 'dup@test.de',
      password: 'sicher123',
      practiceName: 'Praxis A',
      practiceCity: 'Berlin',
      isTherapist: false,
    };
    await app.inject({ method: 'POST', url: '/manager/register', payload });
    const res = await app.inject({ method: 'POST', url: '/manager/register', payload: { ...payload, practiceName: 'Praxis B' } });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /manager/login + GET /manager/me', () => {
  it('logs in and returns practice data', async () => {
    // Register first
    const regRes = await app.inject({
      method: 'POST',
      url: '/manager/register',
      payload: {
        email: 'login@test.de',
        password: 'sicher123',
        practiceName: 'Login Praxis',
        practiceCity: 'Köln',
        isTherapist: false,
      },
    });
    expect(regRes.statusCode).toBe(201);

    // Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/manager/login',
      payload: { email: 'login@test.de', password: 'sicher123' },
    });
    expect(loginRes.statusCode).toBe(200);
    const { token } = loginRes.json();
    expect(token).toBeTruthy();

    // GET /manager/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/manager/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meRes.statusCode).toBe(200);
    const me = meRes.json();
    expect(me.email).toBe('login@test.de');
    expect(me.isTherapist).toBe(false);
    expect(me.practice.name).toBe('Login Praxis');
  });

  it('returns 401 on wrong password', async () => {
    await app.inject({
      method: 'POST',
      url: '/manager/register',
      payload: { email: 'wrong@test.de', password: 'sicher123', practiceName: 'P', practiceCity: 'Berlin', isTherapist: false },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/manager/login',
      payload: { email: 'wrong@test.de', password: 'falsch' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Manager visibility in search', () => {
  it('manager-only account does not appear in therapist search', async () => {
    await app.inject({
      method: 'POST',
      url: '/manager/register',
      payload: {
        email: 'invisible@test.de',
        password: 'sicher123',
        practiceName: 'Unsichtbare Praxis',
        practiceCity: 'Berlin',
        isTherapist: false,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'Berlin', city: 'Berlin' },
    });
    expect(res.statusCode).toBe(200);
    const { therapists } = res.json();
    const found = therapists.find((t: any) => t.email === 'invisible@test.de');
    expect(found).toBeUndefined();
  });

  it('manager+therapist does not appear in search while isPublished=false', async () => {
    await app.inject({
      method: 'POST',
      url: '/manager/register',
      payload: {
        email: 'hidden-therapist@test.de',
        password: 'sicher123',
        practiceName: 'Versteckte Praxis',
        practiceCity: 'München',
        isTherapist: true,
        fullName: 'Dr. Hidden',
        professionalTitle: 'Physiotherapeut',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'Hidden', city: 'München' },
    });
    expect(res.statusCode).toBe(200);
    const { therapists } = res.json();
    const found = therapists.find((t: any) => t.fullName === 'Dr. Hidden');
    expect(found).toBeUndefined();
  });

  it('manager+therapist stays hidden until explicit publication even if profile is completed and isVisible=true', async () => {
    const registerRes = await app.inject({
      method: 'POST',
      url: '/manager/register',
      payload: {
        email: 'manager-visible@test.de',
        password: 'sicher123',
        practiceName: 'Manager Sichtbarkeit',
        practiceCity: 'Berlin',
        isTherapist: true,
        fullName: 'Dr. Private',
        professionalTitle: 'Physiotherapeut',
      },
    });
    expect(registerRes.statusCode).toBe(201);

    const { token } = registerRes.json();
    const SESSION = { authorization: `Bearer ${token}` };

    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: SESSION,
      payload: {
        bio: 'Vollstaendiges Profil',
        specializations: ['Ruecken'],
        languages: ['de'],
        isVisible: true,
      },
    });
    expect(updateRes.statusCode).toBe(200);

    const searchBeforePublish = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'Private', city: 'Berlin' },
    });
    expect(searchBeforePublish.statusCode).toBe(200);
    expect(searchBeforePublish.json().therapists.find((t: any) => t.fullName === 'Dr. Private')).toBeUndefined();

    const publishRes = await app.inject({
      method: 'PATCH',
      url: '/invite/visibility',
      headers: SESSION,
      payload: { visibilityPreference: 'visible' },
    });
    expect(publishRes.statusCode).toBe(200);
    expect(publishRes.json().isPublished).toBe(true);

    const searchAfterPublish = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'Private', city: 'Berlin' },
    });
    expect(searchAfterPublish.statusCode).toBe(200);
    expect(searchAfterPublish.json().therapists.find((t: any) => t.fullName === 'Dr. Private')).toBeTruthy();
  });

  it('unpublished manager therapist profile is not reachable via public detail endpoint', async () => {
    const registerRes = await app.inject({
      method: 'POST',
      url: '/manager/register',
      payload: {
        email: 'detail-hidden@test.de',
        password: 'sicher123',
        practiceName: 'Detail Praxis',
        practiceCity: 'Hamburg',
        isTherapist: true,
        fullName: 'Detail Hidden',
        professionalTitle: 'Physiotherapeut',
      },
    });
    expect(registerRes.statusCode).toBe(201);

    const { therapistId } = registerRes.json();
    const detailRes = await app.inject({
      method: 'GET',
      url: `/therapist/${therapistId}`,
    });
    expect(detailRes.statusCode).toBe(404);
  });

  it('published profile becomes unpublished again when required fields are removed', async () => {
    const registerRes = await app.inject({
      method: 'POST',
      url: '/manager/register',
      payload: {
        email: 'unpublish@test.de',
        password: 'sicher123',
        practiceName: 'Unpublish Praxis',
        practiceCity: 'Berlin',
        isTherapist: true,
        fullName: 'Dr. Mutable',
        professionalTitle: 'Physiotherapeut',
      },
    });
    expect(registerRes.statusCode).toBe(201);

    const { token, therapistId } = registerRes.json();
    const SESSION = { authorization: `Bearer ${token}` };

    await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: SESSION,
      payload: {
        bio: 'Komplettes Profil',
        specializations: ['Ruecken'],
        languages: ['de'],
        isVisible: true,
      },
    });

    const publishRes = await app.inject({
      method: 'PATCH',
      url: '/invite/visibility',
      headers: SESSION,
      payload: { visibilityPreference: 'visible' },
    });
    expect(publishRes.statusCode).toBe(200);
    expect(publishRes.json().isPublished).toBe(true);

    const breakProfileRes = await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: SESSION,
      payload: {
        bio: '',
      },
    });
    expect(breakProfileRes.statusCode).toBe(200);
    expect(breakProfileRes.json().isPublished).toBe(false);
    expect(breakProfileRes.json().complete).toBe(false);
    expect(breakProfileRes.json().missingFields).toContain('bio');

    const managerMeRes = await app.inject({
      method: 'GET',
      url: '/manager/me',
      headers: SESSION,
    });
    expect(managerMeRes.statusCode).toBe(200);
    expect(managerMeRes.json().therapistProfile.isPublished).toBe(false);
    expect(managerMeRes.json().therapistProfile.complete).toBe(false);
    expect(managerMeRes.json().therapistProfile.missingFields).toContain('bio');

    const searchRes = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'Mutable', city: 'Berlin' },
    });
    expect(searchRes.statusCode).toBe(200);
    expect(searchRes.json().therapists.find((t: any) => t.id === therapistId)).toBeUndefined();
  });
});
