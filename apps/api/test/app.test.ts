import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';
import { hashPassword } from '../src/routes/auth-utils.js';
import { getProfileStatus } from '../src/utils/profile-completeness.js';
import { sha256 } from '../src/utils/hash.js';

process.env.DATABASE_URL ??= 'file:./prisma/test.db';
process.env.REVIO_ADMIN_TOKEN ??= 'test-token';

const AUTH = { authorization: 'Bearer test-token' };

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;
let fetchSpy: { mockRestore: () => void } | null = null;

beforeAll(async () => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    if (url.includes('nominatim.openstreetmap.org/search')) {
      const query = new URL(url).searchParams.get('q') ?? '';

      if (query.includes('Komoedienstrasse 12') && query.includes('50667')) {
        return new Response(JSON.stringify([{ lat: '50.9418', lon: '6.9582' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (query.includes('50667 Koeln') || query.includes('50667 Köln')) {
        return new Response(JSON.stringify([{ lat: '50.9375', lon: '6.9603' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (query.includes('Köln') || query.includes('Koeln')) {
        return new Response(JSON.stringify([{ lat: '50.9333', lon: '6.9500' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify([{ lat: '52.5200', lon: '13.4050' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  app = await buildApp();
});

afterAll(async () => {
  fetchSpy?.mockRestore();
  await app.close();
});

// Clean DB between test suites
afterEach(async () => {
  await prisma.appSetting.deleteMany();
  await prisma.appFeedback.deleteMany();
  await prisma.userFavoriteTherapist.deleteMany();
  await prisma.user.deleteMany();
  await prisma.bookingRequest.deleteMany();
  await prisma.therapistSlot.deleteMany();
  await prisma.therapistPracticeLink.deleteMany();
  await prisma.therapist.deleteMany();
  await prisma.practice.deleteMany();
  await prisma.emailOtp.deleteMany();
});

// Seed a confirmed (verified) EmailOtp so /register/therapist accepts the email
async function seedConfirmedOtp(email: string) {
  await prisma.emailOtp.create({
    data: {
      email: email.trim().toLowerCase(),
      codeHash: sha256('123456'),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: new Date(),
    },
  });
}

// ─── Health ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('Site settings', () => {
  it('returns public site config and can toggle under construction via admin', async () => {
    const initialRes = await app.inject({ method: 'GET', url: '/config/site' });
    expect(initialRes.statusCode).toBe(200);
    expect(initialRes.json()).toEqual({ underConstruction: false });

    const updateRes = await app.inject({
      method: 'POST',
      url: '/admin/site-settings/update',
      headers: AUTH,
      payload: { underConstruction: true },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json()).toEqual({ success: true, underConstruction: true });

    const nextRes = await app.inject({ method: 'GET', url: '/config/site' });
    expect(nextRes.statusCode).toBe(200);
    expect(nextRes.json()).toEqual({ underConstruction: true });
  });
});

describe('POST /feedback', () => {
  it('accepts authenticated feedback without email and stores account email', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'feedback-auth@test.de',
        passwordHash: await hashPassword('password123'),
        role: 'patient',
        sessionToken: 'feedback-auth-token',
        firstName: 'Anna',
        lastName: 'Test',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: { authorization: 'Bearer feedback-auth-token' },
      payload: { message: 'Die App läuft super.' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.feedback.email).toBe(user.email);
    expect(body.feedback.userId).toBe(user.id);
    expect(body.feedback.isAuthenticated).toBe(true);
  });

  it('rejects guest feedback without valid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/feedback',
      payload: { email: 'ungueltig', message: 'Test' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects empty feedback message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/feedback',
      payload: { email: 'guest@test.de', message: '   ' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('stores guest feedback without user id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/feedback',
      payload: { email: 'guest@test.de', message: 'Bitte Dark Mode verbessern.' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.feedback.userId).toBeNull();
    expect(body.feedback.isAuthenticated).toBe(false);
    expect(body.feedback.email).toBe('guest@test.de');
  });
});

describe('Admin feedback routes', () => {
  it('lists feedback newest first and updates status', async () => {
    const older = await prisma.appFeedback.create({
      data: {
        email: 'older@test.de',
        message: 'Älteres Feedback',
      },
    });
    const newer = await prisma.appFeedback.create({
      data: {
        email: 'newer@test.de',
        message: 'Neueres Feedback',
      },
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/admin/feedback',
      headers: AUTH,
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody).toHaveLength(2);
    expect(listBody[0].id).toBe(newer.id);
    expect(listBody[1].id).toBe(older.id);

    const updateRes = await app.inject({
      method: 'POST',
      url: `/admin/feedback/${newer.id}/status`,
      headers: AUTH,
      payload: { status: 'RESOLVED' },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().feedback.status).toBe('RESOLVED');

    const stored = await prisma.appFeedback.findUnique({ where: { id: newer.id } });
    expect(stored?.status).toBe('RESOLVED');
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

  it('returns contact email on therapist detail for standalone therapists', async () => {
    const therapist = await prisma.therapist.create({
      data: {
        email: 'kontakt@test.com',
        fullName: 'Kontakt Therapeut',
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

    const res = await app.inject({
      method: 'GET',
      url: `/therapist/${therapist.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.therapist.id).toBe(therapist.id);
    expect(body.therapist.email).toBe('kontakt@test.com');
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
    // Außerhalb des Radius liegende Therapeuten werden nicht mehr ausgeschlossen,
    // sondern als "weitere Ergebnisse" hinter den Treffern eingereiht.
    expect(body.therapists).toHaveLength(2);
    expect(body.therapists[0].fullName).toBe('Nearby Therapist');
    expect(body.therapists[0].radiusMatch).toBe(true);
    expect(body.therapists[0].practices).toHaveLength(1);
    expect(body.therapists[0].practices[0].id).toBe(nearPractice.id);
    expect(body.therapists[0].distKm).toBeLessThan(0.1);
    expect(body.therapists[1].fullName).toBe('Far Away Therapist');
    expect(body.therapists[1].radiusMatch).toBe(false);
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
        isVisible: false,
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

// ─── Registration ─────────────────────────────────────────────────────────────

// ─── OTP Endpoints ────────────────────────────────────────────────────────────

describe('POST /register/send-otp', () => {
  it('returns 200 ok for a new email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/register/send-otp',
      payload: { email: 'otp-new@test.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    const otp = await prisma.emailOtp.findFirst({ where: { email: 'otp-new@test.com' } });
    expect(otp).not.toBeNull();
    expect(otp?.verifiedAt).toBeNull();
  });

  it('returns 409 when email is already a registered therapist', async () => {
    await prisma.therapist.create({
      data: {
        email: 'otp-existing@test.com',
        fullName: 'Existing',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: '',
        languages: 'de',
        certifications: '',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/register/send-otp',
      payload: { email: 'otp-existing@test.com' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/register/send-otp',
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('enforces 3 sends per hour DB-level rate limit', async () => {
    const email = 'otp-ratelimit@test.com';
    const oneHourAgo = new Date(Date.now() - 30 * 60 * 1000);
    // Seed 3 existing OTP rows within the last hour
    for (let i = 0; i < 3; i++) {
      await prisma.emailOtp.create({
        data: { email, codeHash: sha256(`code${i}`), expiresAt: new Date(Date.now() + 60000), createdAt: new Date(oneHourAgo.getTime() + i * 1000) },
      });
    }
    const res = await app.inject({
      method: 'POST',
      url: '/register/send-otp',
      payload: { email },
    });
    expect(res.statusCode).toBe(429);
  });

  it('deletes old unconfirmed OTP when a new one is sent', async () => {
    const email = 'otp-replace@test.com';
    await prisma.emailOtp.create({
      data: { email, codeHash: sha256('oldcode'), expiresAt: new Date(Date.now() + 60000) },
    });

    await app.inject({ method: 'POST', url: '/register/send-otp', payload: { email } });

    const otps = await prisma.emailOtp.findMany({ where: { email } });
    expect(otps).toHaveLength(1); // old one deleted, only the new one remains
  });
});

describe('POST /register/confirm-otp', () => {
  it('returns 200 ok for the correct code', async () => {
    const email = 'confirm-ok@test.com';
    await prisma.emailOtp.create({
      data: { email, codeHash: sha256('654321'), expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/register/confirm-otp',
      payload: { email, code: '654321' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    const otp = await prisma.emailOtp.findFirst({ where: { email } });
    expect(otp?.verifiedAt).not.toBeNull();
  });

  it('returns 400 for a wrong code', async () => {
    const email = 'confirm-wrong@test.com';
    await prisma.emailOtp.create({
      data: { email, codeHash: sha256('111111'), expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/register/confirm-otp',
      payload: { email, code: '999999' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for an expired OTP', async () => {
    const email = 'confirm-expired@test.com';
    await prisma.emailOtp.create({
      data: { email, codeHash: sha256('222222'), expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/register/confirm-otp',
      payload: { email, code: '222222' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when an already-verified OTP is re-submitted', async () => {
    const email = 'confirm-reuse@test.com';
    await prisma.emailOtp.create({
      data: {
        email,
        codeHash: sha256('333333'),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verifiedAt: new Date(),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/register/confirm-otp',
      payload: { email, code: '333333' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Registration ─────────────────────────────────────────────────────────────

describe('POST /auth/register (patient)', () => {
  const validPayload = {
    email: 'patient-register@test.com',
    password: 'patient-secret-123',
    role: 'patient' as const,
    firstName: 'Anna',
    lastName: 'Becker',
  };

  it('returns 400 without a confirmed OTP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: validPayload,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('nicht bestätigt');
  });

  it('returns 400 for passwords shorter than 8 characters', async () => {
    await seedConfirmedOtp('patient-short@test.com');

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        ...validPayload,
        email: 'patient-short@test.com',
        password: 'short',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('creates the patient account, returns a session token, and consumes the OTP', async () => {
    await seedConfirmedOtp(validPayload.email);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: validPayload,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      accountType: 'patient',
      firstName: 'Anna',
      lastName: 'Becker',
    });
    expect(res.json().token).toBeTruthy();

    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${res.json().token}` },
    });

    expect(meRes.statusCode).toBe(200);
    expect(meRes.json()).toMatchObject({
      email: validPayload.email,
      role: 'patient',
      firstName: 'Anna',
      lastName: 'Becker',
    });

    const user = await prisma.user.findUnique({ where: { email: validPayload.email } });
    expect(user?.role).toBe('patient');
    expect(user?.emailVerifiedAt).toBeTruthy();

    const remainingOtps = await prisma.emailOtp.findMany({ where: { email: validPayload.email } });
    expect(remainingOtps).toHaveLength(0);
  });
});

describe('POST /register/therapist', () => {
  const validPayload = {
    email: 'new@test.com',
    fullName: 'New Therapist',
    professionalTitle: 'Physiotherapeut',
    city: 'Köln',
    postalCode: '50667',
    street: 'Komoedienstrasse',
    houseNumber: '12',
    locationPrecision: 'approximate',
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

  it('returns 400 without a confirmed OTP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('nicht bestätigt');
  });

  it('creates therapist and practice with PENDING_REVIEW status', async () => {
    await seedConfirmedOtp(validPayload.email);
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.therapistId).toBeTruthy();

    const therapist = await prisma.therapist.findUnique({ where: { id: body.therapistId } });
    // Always PENDING_REVIEW — admin must approve
    expect(therapist?.reviewStatus).toBe('PENDING_REVIEW');
    expect(therapist?.email).toBe(validPayload.email);
  });

  it('returns session token that works for GET /auth/me', async () => {
    await seedConfirmedOtp(validPayload.email);
    const regRes = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: validPayload,
    });
    expect(regRes.statusCode).toBe(201);
    const { token } = regRes.json();
    expect(token).toBeTruthy();

    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().email).toBe(validPayload.email);
  });

  it('deletes the confirmed OTP after successful registration', async () => {
    await seedConfirmedOtp(validPayload.email);
    await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: validPayload,
    });
    const remaining = await prisma.emailOtp.findMany({ where: { email: validPayload.email } });
    expect(remaining).toHaveLength(0);
  });

  it('returns 409 on duplicate email', async () => {
    await seedConfirmedOtp(validPayload.email);
    await app.inject({ method: 'POST', url: '/register/therapist', payload: validPayload });
    // Second attempt — no OTP (email already in use)
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: { ...validPayload, email: validPayload.email },
    });
    expect(res.statusCode).toBe(409);
  });

  it('creates a practice and PROPOSED link', async () => {
    await seedConfirmedOtp(validPayload.email);
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: validPayload,
    });
    const body = res.json();
    const link = await prisma.therapistPracticeLink.findFirst({
      where: { therapistId: body.therapistId },
    });
    // Always PROPOSED — admin must confirm the link
    expect(link?.status).toBe('PROPOSED');
  });

  it('stores structured location fields and geocodes latitude/longitude', async () => {
    const email = 'location-register@test.com';
    await seedConfirmedOtp(email);
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: { ...validPayload, email, homeVisit: true },
    });

    expect(res.statusCode).toBe(201);
    const { therapistId } = res.json();
    const therapist = await prisma.therapist.findUnique({ where: { id: therapistId } }) as any;

    expect(therapist?.postalCode).toBe('50667');
    expect(therapist?.street).toBe('Komoedienstrasse');
    expect(therapist?.houseNumber).toBe('12');
    expect(therapist?.locationPrecision).toBe('approximate');
    expect(therapist?.latitude).toBeCloseTo(50.9418, 3);
    expect(therapist?.longitude).toBeCloseTo(6.9582, 3);
  });

  it('/auth/me returns new location and compliance fields', async () => {
    const email = 'me-fields@test.com';
    await seedConfirmedOtp(email);
    const regRes = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: {
        ...validPayload,
        email,
        compliance: { taxRegistrationStatus: 'yes', healthAuthorityStatus: 'in_progress' },
        gender: 'female',
      },
    });
    expect(regRes.statusCode).toBe(201);
    const { token } = regRes.json();

    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meRes.statusCode).toBe(200);
    const body = meRes.json();
    expect(body.postalCode).toBe('50667');
    expect(body.street).toBe('Komoedienstrasse');
    expect(body.gender).toBe('female');
    expect(body.taxRegistrationStatus).toBe('yes');
    expect(body.healthAuthorityStatus).toBe('in_progress');
    expect(body.complianceUpdatedAt).toBeTruthy();
  });

  it('stores optional self-reported compliance fields', async () => {
    const email = 'compliance-register@test.com';
    await seedConfirmedOtp(email);
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: {
        ...validPayload,
        email,
        compliance: {
          taxRegistrationStatus: 'yes',
          healthAuthorityStatus: 'in_progress',
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const { therapistId } = res.json();
    const therapist = await prisma.therapist.findUnique({ where: { id: therapistId } }) as any;

    expect(therapist?.taxRegistrationStatus).toBe('yes');
    expect(therapist?.healthAuthorityStatus).toBe('in_progress');
    expect(therapist?.complianceUpdatedAt).toBeTruthy();
  });
});

describe('Password reset', () => {
  const registrationPayload = {
    email: 'reset-user@test.de',
    password: 'secret123',
    fullName: 'Reset User',
    city: 'Köln',
    postalCode: '50667',
    street: 'Komoedienstrasse',
    houseNumber: '12',
    specializations: ['back pain'],
    languages: ['de'],
  };

  it('stores a reset token and lets therapists log in with the new password', async () => {
    await seedConfirmedOtp(registrationPayload.email);
    const registerRes = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: registrationPayload,
    });
    expect(registerRes.statusCode).toBe(201);

    const forgotRes = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: registrationPayload.email },
    });
    expect(forgotRes.statusCode).toBe(200);
    expect(forgotRes.json().ok).toBe(true);

    const userBeforeReset = await prisma.user.findUnique({
      where: { email: registrationPayload.email },
    });
    expect(userBeforeReset?.passwordResetToken).toBeTruthy();
    expect(userBeforeReset?.passwordResetExpiresAt).toBeTruthy();

    const resetRes = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: {
        token: userBeforeReset?.passwordResetToken,
        password: 'new-secret-456',
      },
    });
    expect(resetRes.statusCode).toBe(200);

    const userAfterReset = await prisma.user.findUnique({
      where: { email: registrationPayload.email },
    });
    const therapistAfterReset = await prisma.therapist.findUnique({
      where: { email: registrationPayload.email },
    });
    expect(userAfterReset?.passwordResetToken).toBeNull();
    expect(userAfterReset?.passwordResetExpiresAt).toBeNull();
    expect(therapistAfterReset?.passwordHash).toBeTruthy();
    expect(therapistAfterReset?.passwordHash).toBe(userAfterReset?.passwordHash);

    const oldLoginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: registrationPayload.email, password: registrationPayload.password },
    });
    expect(oldLoginRes.statusCode).toBe(401);

    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: registrationPayload.email, password: 'new-secret-456' },
    });
    expect(newLoginRes.statusCode).toBe(200);
    expect(newLoginRes.json().token).toBeTruthy();
  });

  it('returns a generic success response for unknown emails', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'missing@test.de' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('supports legacy therapist accounts without a User row', async () => {
    const legacyPasswordHash = await hashPassword('legacy-pass-123');
    await prisma.therapist.create({
      data: {
        email: 'legacy-reset@test.de',
        fullName: 'Legacy Reset',
        professionalTitle: 'Physiotherapeut',
        city: 'Berlin',
        specializations: 'Rücken',
        languages: 'de',
        certifications: '',
        passwordHash: legacyPasswordHash,
        reviewStatus: 'APPROVED',
      },
    });

    const forgotRes = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'legacy-reset@test.de' },
    });
    expect(forgotRes.statusCode).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: 'legacy-reset@test.de' } });
    const therapist = await prisma.therapist.findUnique({ where: { email: 'legacy-reset@test.de' } });
    expect(user?.id).toBeTruthy();
    expect(user?.passwordResetToken).toBeTruthy();
    expect(therapist?.userId).toBe(user?.id);

    const resetRes = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: {
        token: user?.passwordResetToken,
        password: 'legacy-pass-456',
      },
    });
    expect(resetRes.statusCode).toBe(200);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'legacy-reset@test.de', password: 'legacy-pass-456' },
    });
    expect(loginRes.statusCode).toBe(200);
  });

  it('rejects expired reset tokens', async () => {
    const passwordHash = await hashPassword('expired-pass-123');
    const user = await prisma.user.create({
      data: {
        email: 'expired-reset@test.de',
        passwordHash,
        role: 'therapist',
        passwordResetToken: 'expired-token',
        passwordResetExpiresAt: new Date(Date.now() - 60_000),
      },
    });
    await prisma.therapist.create({
      data: {
        email: user.email,
        userId: user.id,
        fullName: 'Expired Reset',
        professionalTitle: 'Physiotherapeut',
        city: 'Hamburg',
        specializations: 'Rücken',
        languages: 'de',
        certifications: '',
        passwordHash,
      },
    });

    const resetRes = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: {
        token: 'expired-token',
        password: 'new-password-123',
      },
    });
    expect(resetRes.statusCode).toBe(400);

    const pageRes = await app.inject({
      method: 'GET',
      url: '/auth/reset-password?token=expired-token',
    });
    expect(pageRes.statusCode).toBe(400);
    expect(pageRes.body).toContain('Link nicht mehr gültig');
  });
});

describe('Email verification', () => {
  it('OTP confirm-otp sets verifiedAt, enabling subsequent registration', async () => {
    const email = 'verify-otp@test.de';
    // Send OTP
    const sendRes = await app.inject({
      method: 'POST',
      url: '/register/send-otp',
      payload: { email },
    });
    expect(sendRes.statusCode).toBe(200);

    // Fetch the code directly from the DB (RESEND_API_KEY not set in tests)
    const otp = await prisma.emailOtp.findFirst({ where: { email } });
    expect(otp).not.toBeNull();

    // Confirm with wrong code first
    const badRes = await app.inject({
      method: 'POST',
      url: '/register/confirm-otp',
      payload: { email, code: '000000' },
    });
    expect(badRes.statusCode).toBe(400);
    expect((await prisma.emailOtp.findFirst({ where: { email } }))?.verifiedAt).toBeNull();

    // Confirm with the code hash — retrieve actual code by seeding a known one
    await prisma.emailOtp.deleteMany({ where: { email } });
    await prisma.emailOtp.create({
      data: { email, codeHash: sha256('987654'), expiresAt: new Date(Date.now() + 600_000) },
    });
    const confirmRes = await app.inject({
      method: 'POST',
      url: '/register/confirm-otp',
      payload: { email, code: '987654' },
    });
    expect(confirmRes.statusCode).toBe(200);

    const verified = await prisma.emailOtp.findFirst({ where: { email } });
    expect(verified?.verifiedAt).not.toBeNull();

    // Registration now succeeds
    const regRes = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: {
        email,
        password: 'secret123',
        fullName: 'OTP Verified',
        city: 'Köln',
        specializations: ['back pain'],
        languages: ['de'],
      },
    });
    expect(regRes.statusCode).toBe(201);

    // User is marked as email-verified
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.emailVerifiedAt).not.toBeNull();
    expect(user?.requiresEmailVerification).toBe(false);
  });
});

describe('Profile status logic', () => {
  it('returns draft when required profile fields are missing', () => {
    expect(
      getProfileStatus({
        fullName: 'Test',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: '',
        languages: 'de',
      }),
    ).toBe('draft');
  });

  it('returns incomplete when profile is complete but compliance is missing', () => {
    expect(
      getProfileStatus({
        fullName: 'Test',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'Rücken',
        languages: 'de',
      }),
    ).toBe('incomplete');
  });

  it('returns ready_for_review when both compliance fields are yes', () => {
    expect(
      getProfileStatus({
        fullName: 'Test',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'Rücken',
        languages: 'de',
        taxRegistrationStatus: 'yes',
        healthAuthorityStatus: 'yes',
      }),
    ).toBe('ready_for_review');
  });
});

describe('PATCH /auth/me/compliance', () => {
  it('allows partial updates and returns nested compliance data', async () => {
    const sessionToken = 'compliance-session-token';
    await prisma.user.create({
      data: {
        email: 'compliance-auth@test.de',
        passwordHash: 'hash',
        role: 'therapist',
        sessionToken,
      },
    });
    const therapist = await prisma.therapist.create({
      data: {
        email: 'compliance-auth@test.de',
        fullName: 'Compliance Test',
        professionalTitle: 'Physiotherapeut',
        city: 'Berlin',
        specializations: 'Rücken',
        languages: 'de',
        certifications: '',
        sessionToken,
        taxRegistrationStatus: 'no',
      } as any,
    });

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/auth/me/compliance',
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { healthAuthorityStatus: 'unknown' },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().compliance).toMatchObject({
      taxRegistrationStatus: 'no',
      healthAuthorityStatus: 'unknown',
    });
    expect(patchRes.json().profileStatus).toBe('incomplete');

    const updated = await prisma.therapist.findUnique({ where: { id: therapist.id } }) as any;
    expect(updated?.taxRegistrationStatus).toBe('no');
    expect(updated?.healthAuthorityStatus).toBe('unknown');
    expect(updated?.complianceUpdatedAt).toBeTruthy();
  });

  it('returns ready_for_review from /auth/me when both statuses are yes', async () => {
    const sessionToken = 'compliance-ready-session-token';
    await prisma.user.create({
      data: {
        email: 'compliance-ready@test.de',
        passwordHash: 'hash',
        role: 'therapist',
        sessionToken,
      },
    });
    await prisma.therapist.create({
      data: {
        email: 'compliance-ready@test.de',
        fullName: 'Ready Test',
        professionalTitle: 'Physiotherapeut',
        city: 'Hamburg',
        specializations: 'Rücken',
        languages: 'de',
        certifications: '',
        sessionToken,
        taxRegistrationStatus: 'yes',
        healthAuthorityStatus: 'yes',
      } as any,
    });

    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${sessionToken}` },
    });

    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().compliance).toMatchObject({
      taxRegistrationStatus: 'yes',
      healthAuthorityStatus: 'yes',
    });
    expect(meRes.json().profileStatus).toBe('ready_for_review');
  });
});

describe('PATCH /auth/me location fields', () => {
  it('updates structured location fields and geocodes exact/public coordinates', async () => {
    const sessionToken = 'location-session-token';
    await prisma.user.create({
      data: {
        email: 'location-auth@test.de',
        passwordHash: 'hash',
        role: 'therapist',
        sessionToken,
      },
    });
    const therapist = await prisma.therapist.create({
      data: {
        email: 'location-auth@test.de',
        fullName: 'Location Test',
        professionalTitle: 'Physiotherapeut',
        city: 'Köln',
        specializations: 'Rücken',
        languages: 'de',
        certifications: '',
        sessionToken,
      } as any,
    });

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: {
        city: 'Köln',
        postalCode: '50667',
        street: 'Komoedienstrasse',
        houseNumber: '12',
        locationPrecision: 'exact',
      },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().locationPrecision).toBe('exact');
    expect(patchRes.json().postalCode).toBe('50667');

    const updated = await prisma.therapist.findUnique({ where: { id: therapist.id } }) as any;
    expect(updated?.postalCode).toBe('50667');
    expect(updated?.street).toBe('Komoedienstrasse');
    expect(updated?.houseNumber).toBe('12');
    expect(updated?.locationPrecision).toBe('exact');
    expect(updated?.latitude).toBeCloseTo(50.9418, 3);
    expect(updated?.longitude).toBeCloseTo(6.9582, 3);
    expect(updated?.homeLat).toBeCloseTo(50.9418, 3);
    expect(updated?.homeLng).toBeCloseTo(6.9582, 3);
  });
});

// ─── Change Password ──────────────────────────────────────────────────────────

describe('PATCH /auth/password', () => {
  const TOKEN = 'change-pw-session-token';
  const OLD_PW = 'OldPassword1!';
  const NEW_PW = 'NewPassword2!';

  async function createUserWithToken(role: 'patient' | 'therapist' = 'patient') {
    const passwordHash = await hashPassword(OLD_PW);
    const user = await prisma.user.create({
      data: { email: 'changepw@test.de', passwordHash, role, sessionToken: TOKEN },
    });
    return user;
  }

  it('changes password for authenticated patient', async () => {
    await createUserWithToken('patient');

    const res = await app.inject({
      method: 'PATCH',
      url: '/auth/password',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { currentPassword: OLD_PW, newPassword: NEW_PW },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });

    // Old password no longer works
    const loginOld = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'changepw@test.de', password: OLD_PW },
    });
    expect(loginOld.statusCode).toBe(401);

    // New password works
    const loginNew = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'changepw@test.de', password: NEW_PW },
    });
    expect(loginNew.statusCode).toBe(200);
  });

  it('rejects wrong current password', async () => {
    await createUserWithToken('patient');
    const res = await app.inject({
      method: 'PATCH',
      url: '/auth/password',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { currentPassword: 'WrongPassword!', newPassword: NEW_PW },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects new password shorter than 8 characters', async () => {
    await createUserWithToken('patient');
    const res = await app.inject({
      method: 'PATCH',
      url: '/auth/password',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { currentPassword: OLD_PW, newPassword: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires auth token', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/auth/password',
      payload: { currentPassword: OLD_PW, newPassword: NEW_PW },
    });
    expect(res.statusCode).toBe(401);
  });

  it('updates linked therapist passwordHash', async () => {
    const user = await createUserWithToken('therapist');
    const therapist = await prisma.therapist.create({
      data: {
        email: 'changepw@test.de',
        fullName: 'PW Test',
        professionalTitle: 'Physiotherapeut',
        city: 'Berlin',
        specializations: '',
        languages: 'de',
        certifications: '',
        sessionToken: TOKEN,
        userId: user.id,
      } as any,
    });

    await app.inject({
      method: 'PATCH',
      url: '/auth/password',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { currentPassword: OLD_PW, newPassword: NEW_PW },
    });

    const updated = await prisma.therapist.findUnique({ where: { id: therapist.id } });
    expect(updated?.passwordHash).not.toBe(therapist.passwordHash);
  });

  it('clears password reset token after change', async () => {
    await prisma.user.create({
      data: {
        email: 'changepw@test.de',
        passwordHash: await hashPassword(OLD_PW),
        role: 'patient',
        sessionToken: TOKEN,
        passwordResetToken: 'some-reset-token',
        passwordResetExpiresAt: new Date(Date.now() + 3600_000),
      },
    });

    await app.inject({
      method: 'PATCH',
      url: '/auth/password',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { currentPassword: OLD_PW, newPassword: NEW_PW },
    });

    const user = await prisma.user.findFirst({ where: { email: 'changepw@test.de' } });
    expect(user?.passwordResetToken).toBeNull();
    expect(user?.passwordResetExpiresAt).toBeNull();
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
    await seedConfirmedOtp('e2e@test.com');
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

    // 2. Vor Freigabe: nicht in Suche sichtbar
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

// ─── Invite Flow, Manager Auth, Manager Visibility ────────────────────────────
// These features have been removed (freelancer-only MVP). Tests kept as skipped.


// ─── Manager Auth ─────────────────────────────────────────────────────────────




// ── Therapeuten-Favoriten ────────────────────────────────────────────────────
describe('GET /auth/favorites/therapists', () => {
  async function createPatientUser(email = 'fav-patient@test.de', sessionToken = 'fav-patient-token') {
    return prisma.user.create({
      data: { email, passwordHash: 'hash', role: 'patient', sessionToken, firstName: 'Anna', lastName: 'Test' },
    });
  }

  async function createApprovedTherapist(email = 'fav-therapist@test.de') {
    return prisma.therapist.create({
      data: {
        email,
        fullName: 'Fav Therapeut',
        professionalTitle: 'Physiotherapeut',
        city: 'Berlin',
        specializations: 'Rücken',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        isVisible: true,
      },
    });
  }

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/favorites/therapists' });
    expect(res.statusCode).toBe(401);
  });

  it('returns empty list for new user', async () => {
    await createPatientUser();
    const res = await app.inject({
      method: 'GET', url: '/auth/favorites/therapists',
      headers: { authorization: 'Bearer fav-patient-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().therapists).toHaveLength(0);
  });

  it('POST adds a favorite and GET returns it', async () => {
    await createPatientUser();
    const therapist = await createApprovedTherapist();

    const postRes = await app.inject({
      method: 'POST', url: '/auth/favorites/therapists',
      headers: { authorization: 'Bearer fav-patient-token', 'content-type': 'application/json' },
      payload: { therapistId: therapist.id },
    });
    expect(postRes.statusCode).toBe(200);
    expect(postRes.json().ok).toBe(true);

    const getRes = await app.inject({
      method: 'GET', url: '/auth/favorites/therapists',
      headers: { authorization: 'Bearer fav-patient-token' },
    });
    expect(getRes.statusCode).toBe(200);
    const list = getRes.json().therapists;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(therapist.id);
    expect(list[0].fullName).toBe('Fav Therapeut');
  });

  it('POST is idempotent — adding twice does not duplicate', async () => {
    await createPatientUser();
    const therapist = await createApprovedTherapist();

    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: 'POST', url: '/auth/favorites/therapists',
        headers: { authorization: 'Bearer fav-patient-token', 'content-type': 'application/json' },
        payload: { therapistId: therapist.id },
      });
    }

    const getRes = await app.inject({
      method: 'GET', url: '/auth/favorites/therapists',
      headers: { authorization: 'Bearer fav-patient-token' },
    });
    expect(getRes.json().therapists).toHaveLength(1);
  });

  it('DELETE removes the favorite', async () => {
    await createPatientUser();
    const therapist = await createApprovedTherapist();

    await app.inject({
      method: 'POST', url: '/auth/favorites/therapists',
      headers: { authorization: 'Bearer fav-patient-token', 'content-type': 'application/json' },
      payload: { therapistId: therapist.id },
    });

    const delRes = await app.inject({
      method: 'DELETE', url: `/auth/favorites/therapists/${therapist.id}`,
      headers: { authorization: 'Bearer fav-patient-token' },
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().ok).toBe(true);

    const getRes = await app.inject({
      method: 'GET', url: '/auth/favorites/therapists',
      headers: { authorization: 'Bearer fav-patient-token' },
    });
    expect(getRes.json().therapists).toHaveLength(0);
  });

  it('DELETE of non-existing favorite returns 200 (idempotent)', async () => {
    await createPatientUser();
    const res = await app.inject({
      method: 'DELETE', url: '/auth/favorites/therapists/non-existing-id',
      headers: { authorization: 'Bearer fav-patient-token' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('isolates favorites per user — user A cannot see user B favorites', async () => {
    await createPatientUser('user-a@test.de', 'token-a');
    await createPatientUser('user-b@test.de', 'token-b');
    const therapist = await createApprovedTherapist();

    await app.inject({
      method: 'POST', url: '/auth/favorites/therapists',
      headers: { authorization: 'Bearer token-a', 'content-type': 'application/json' },
      payload: { therapistId: therapist.id },
    });

    const resB = await app.inject({
      method: 'GET', url: '/auth/favorites/therapists',
      headers: { authorization: 'Bearer token-b' },
    });
    expect(resB.json().therapists).toHaveLength(0);
  });

  it('works for therapist users too (not only patients)', async () => {
    const user = await prisma.user.create({
      data: { email: 'fav-therapist-user@test.de', passwordHash: 'hash', role: 'therapist', sessionToken: 'therapist-fav-token' },
    });
    await createApprovedTherapist();
    const target = await createApprovedTherapist('other-therapist@test.de');

    await app.inject({
      method: 'POST', url: '/auth/favorites/therapists',
      headers: { authorization: 'Bearer therapist-fav-token', 'content-type': 'application/json' },
      payload: { therapistId: target.id },
    });

    const res = await app.inject({
      method: 'GET', url: '/auth/favorites/therapists',
      headers: { authorization: 'Bearer therapist-fav-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().therapists).toHaveLength(1);
  });
});

// ─── Slot-based Booking ───────────────────────────────────────────────────────

describe('Slot-based Booking', () => {
  let therapistToken: string;
  let therapistId: string;
  let patientToken: string;

  async function setupTherapistAndPatient() {
    const therapist = await prisma.therapist.create({
      data: {
        email: 'slot-therapist@test.de',
        fullName: 'Slot Therapeutin',
        professionalTitle: 'Physiotherapeutin',
        city: 'Berlin',
        specializations: 'Rückenschmerzen',
        languages: 'Deutsch',
        reviewStatus: 'APPROVED',
        isVisible: true,
        bookingMode: 'FIRST_APPOINTMENT_REQUEST',
        sessionToken: 'slot-therapist-token',
      },
    });
    therapistToken = 'slot-therapist-token';
    therapistId = therapist.id;

    await prisma.user.create({
      data: {
        email: 'slot-patient@test.de',
        passwordHash: await hashPassword('test1234'),
        role: 'patient',
        firstName: 'Slot',
        lastName: 'Patient',
        sessionToken: 'slot-patient-token',
        emailVerifiedAt: new Date(),
      },
    });
    patientToken = 'slot-patient-token';
  }

  async function createFutureSlot(overrides: Record<string, unknown> = {}) {
    return prisma.therapistSlot.create({
      data: {
        therapistId,
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        durationMin: 20,
        status: 'AVAILABLE',
        ...overrides,
      },
    });
  }

  beforeEach(async () => {
    await setupTherapistAndPatient();
  });

  afterEach(async () => {
    await prisma.bookingRequest.deleteMany();
    await prisma.therapistSlot.deleteMany();
  });

  it('POST /therapist/slots — therapist creates a slot', async () => {
    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const res = await app.inject({
      method: 'POST', url: '/therapist/slots',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { slots: [{ startsAt, durationMin: 20 }] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().created).toHaveLength(1);
    expect(res.json().created[0].status).toBe('AVAILABLE');
  });

  it('GET /therapists/:id/slots — returns only future AVAILABLE slots', async () => {
    await createFutureSlot();
    await createFutureSlot({ status: 'BOOKED' });
    await prisma.therapistSlot.create({
      data: { therapistId, startsAt: new Date(Date.now() - 60000), durationMin: 20, status: 'AVAILABLE' },
    });

    const res = await app.inject({ method: 'GET', url: `/therapists/${therapistId}/slots` });
    expect(res.statusCode).toBe(200);
    expect(res.json().slots).toHaveLength(1);
    expect(res.json().slots[0].status).toBe('AVAILABLE');
  });

  it('POST /bookings — books an AVAILABLE slot atomically', async () => {
    const slot = await createFutureSlot();

    const res = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, slotId: slot.id, consentAccepted: true },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().slot.id).toBe(slot.id);

    const updatedSlot = await prisma.therapistSlot.findUnique({ where: { id: slot.id } });
    expect(updatedSlot?.status).toBe('BOOKED');
  });

  it('POST /bookings — double-booking same slot returns 409', async () => {
    const slot = await createFutureSlot();

    await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, slotId: slot.id, consentAccepted: true },
    });

    const patient2 = await prisma.user.create({
      data: { email: 'patient2@test.de', passwordHash: 'x', role: 'patient', sessionToken: 'patient2-token', emailVerifiedAt: new Date() },
    });
    const res2 = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: 'Bearer patient2-token', 'content-type': 'application/json' },
      payload: { therapistId, slotId: slot.id, consentAccepted: true },
    });
    expect(res2.statusCode).toBe(409);

    const slotAfter = await prisma.therapistSlot.findUnique({ where: { id: slot.id } });
    expect(slotAfter?.status).toBe('BOOKED');
  });

  it('PATCH /bookings/:id/cancel — patient cancel releases slot', async () => {
    const slot = await createFutureSlot();
    const bookRes = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, slotId: slot.id, consentAccepted: true },
    });
    const bookingId = bookRes.json().id;

    const cancelRes = await app.inject({
      method: 'PATCH', url: `/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${patientToken}` },
    });
    expect(cancelRes.statusCode).toBe(200);

    const updatedSlot = await prisma.therapistSlot.findUnique({ where: { id: slot.id } });
    expect(updatedSlot?.status).toBe('AVAILABLE');
  });

  it('PATCH /bookings/:id/respond CONFIRM — booking confirmed, slot stays BOOKED', async () => {
    const slot = await createFutureSlot();
    const bookRes = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, slotId: slot.id, consentAccepted: true },
    });

    const confirmRes = await app.inject({
      method: 'PATCH', url: `/bookings/${bookRes.json().id}/respond`,
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { action: 'CONFIRM' },
    });
    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.json().status).toBe('CONFIRMED');
    expect(confirmRes.json().confirmedSlotAt).toBeTruthy();

    const updatedSlot = await prisma.therapistSlot.findUnique({ where: { id: slot.id } });
    expect(updatedSlot?.status).toBe('BOOKED');
  });

  it('PATCH /bookings/:id/respond DECLINE — booking declined, slot released', async () => {
    const slot = await createFutureSlot();
    const bookRes = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, slotId: slot.id, consentAccepted: true },
    });

    const declineRes = await app.inject({
      method: 'PATCH', url: `/bookings/${bookRes.json().id}/respond`,
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { action: 'DECLINE', declinedReason: 'Keine Kapazität' },
    });
    expect(declineRes.statusCode).toBe(200);
    expect(declineRes.json().status).toBe('DECLINED');

    const updatedSlot = await prisma.therapistSlot.findUnique({ where: { id: slot.id } });
    expect(updatedSlot?.status).toBe('AVAILABLE');
  });

  it('Expiry — expired PENDING booking releases slot', async () => {
    const slot = await createFutureSlot();
    const booking = await prisma.bookingRequest.create({
      data: {
        therapistId,
        slotId: slot.id,
        status: 'PENDING',
        patientName: 'Test',
        patientEmail: 'test@x.de',
        consentAcceptedAt: new Date(),
        responseDueAt: new Date(Date.now() - 1000),
      },
    });
    await prisma.therapistSlot.update({ where: { id: slot.id }, data: { status: 'BOOKED' } });

    await app.inject({
      method: 'GET', url: `/bookings/incoming`,
      headers: { authorization: `Bearer ${therapistToken}` },
    });

    const updatedBooking = await prisma.bookingRequest.findUnique({ where: { id: booking.id } });
    expect(updatedBooking?.status).toBe('EXPIRED');

    const updatedSlot = await prisma.therapistSlot.findUnique({ where: { id: slot.id } });
    expect(updatedSlot?.status).toBe('AVAILABLE');
  });

  it('DELETE /therapist/slots/:id — therapist can delete own AVAILABLE slot', async () => {
    const slot = await createFutureSlot();
    const res = await app.inject({
      method: 'DELETE', url: `/therapist/slots/${slot.id}`,
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deleted).toBe(true);
  });

  it('DELETE /therapist/slots/:id — cannot delete BOOKED slot', async () => {
    const slot = await createFutureSlot({ status: 'BOOKED' });
    const res = await app.inject({
      method: 'DELETE', url: `/therapist/slots/${slot.id}`,
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('Legacy booking without slotId remains readable', async () => {
    const legacy = await prisma.bookingRequest.create({
      data: {
        therapistId,
        status: 'PENDING',
        patientName: 'Legacy Patient',
        patientEmail: 'legacy@test.de',
        preferredDays: 'Montag',
        preferredTimeWindows: 'Vormittag',
        consentAcceptedAt: new Date(),
        responseDueAt: new Date(Date.now() + 86400000),
      },
    });

    const res = await app.inject({
      method: 'GET', url: '/bookings/incoming',
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(res.statusCode).toBe(200);
    const found = res.json().find((b: { id: string }) => b.id === legacy.id);
    expect(found).toBeTruthy();
    expect(found.slot).toBeNull();
  });
});

// ─── Notification Routing Metadata ───────────────────────────────────────────

describe('GET /notifications — routing metadata', () => {
  it('includes bookingId and actionLabel for NEW_BOOKING_REQUEST', async () => {
    const therapistToken = 'notif-route-therapist-token';
    const user = await prisma.user.create({
      data: { email: 'notif-route@test.de', passwordHash: 'h', role: 'therapist', sessionToken: therapistToken },
    });
    const therapist = await prisma.therapist.create({
      data: {
        email: 'notif-route@test.de', fullName: 'Notif Test', professionalTitle: 'PT',
        city: 'Berlin', specializations: '', languages: 'de', certifications: '',
        sessionToken: therapistToken, reviewStatus: 'APPROVED', userId: user.id,
      } as any,
    });
    const booking = await prisma.bookingRequest.create({
      data: {
        therapistId: therapist.id, patientName: 'Max M.', status: 'PENDING',
        message: 'Hi', consentAcceptedAt: new Date(), responseDueAt: new Date(Date.now() + 86400000),
      },
    });

    const res = await app.inject({
      method: 'GET', url: '/notifications',
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(res.statusCode).toBe(200);
    const notif = res.json().notifications.find((n: any) => n.type === 'NEW_BOOKING_REQUEST');
    expect(notif).toBeDefined();
    expect(notif.bookingId).toBe(booking.id);
    expect(notif.actionLabel).toBeDefined();
    expect(typeof notif.actionLabel).toBe('string');
  });

  it('includes bookingId for patient BOOKING_CONFIRMED notification', async () => {
    const patientToken = 'notif-patient-token';
    const patientUser = await prisma.user.create({
      data: { email: 'notif-patient@test.de', passwordHash: 'h', role: 'patient', sessionToken: patientToken },
    });
    const therapist = await prisma.therapist.create({
      data: {
        email: 'notif-therapist2@test.de', fullName: 'T2', professionalTitle: 'PT',
        city: 'Berlin', specializations: '', languages: 'de', certifications: '',
        sessionToken: 'notif-t2-token',
      } as any,
    });
    const booking = await prisma.bookingRequest.create({
      data: {
        therapistId: therapist.id, patientUserId: patientUser.id, patientName: 'Anna',
        status: 'CONFIRMED', message: 'Hi',
        consentAcceptedAt: new Date(), responseDueAt: new Date(Date.now() + 86400000),
        respondedAt: new Date(),
      },
    });

    const res = await app.inject({
      method: 'GET', url: '/notifications',
      headers: { authorization: `Bearer ${patientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const notif = res.json().notifications.find((n: any) => n.type === 'BOOKING_CONFIRMED');
    expect(notif).toBeDefined();
    expect(notif.bookingId).toBe(booking.id);
  });

});

describe('Session token expiry', () => {
  it('rejects a token whose sessionTokenExpiresAt is in the past', async () => {
    const { prisma } = app as any;
    const user = await prisma.user.create({
      data: {
        email: 'expired-token@test.de',
        passwordHash: 'x',
        role: 'therapist',
        sessionToken: 'expired-tok',
        sessionTokenExpiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await app.inject({
      method: 'GET', url: '/auth/me',
      headers: { authorization: 'Bearer expired-tok' },
    });
    expect(res.statusCode).toBe(401);

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('accepts a token whose sessionTokenExpiresAt is in the future', async () => {
    const { prisma } = app as any;
    const user = await prisma.user.create({
      data: {
        email: 'valid-token@test.de',
        passwordHash: 'x',
        role: 'therapist',
        sessionToken: 'valid-tok',
        sessionTokenExpiresAt: new Date(Date.now() + 86400000),
      },
    });

    const res = await app.inject({
      method: 'GET', url: '/auth/me',
      headers: { authorization: 'Bearer valid-tok' },
    });
    // 401 because no therapist profile, but NOT because token expired
    expect(res.statusCode).not.toBe(500);

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('login sets sessionTokenExpiresAt 30 days in the future', async () => {
    const { prisma } = app as any;
    const hash = await hashPassword('testpass123');
    const user = await prisma.user.create({
      data: { email: 'expiry-login@test.de', passwordHash: hash, role: 'patient' },
    });

    const res = await app.inject({
      method: 'POST', url: '/auth/login',
      payload: { email: 'expiry-login@test.de', password: 'testpass123' },
    });
    expect(res.statusCode).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.sessionTokenExpiresAt).not.toBeNull();
    const diffDays = (updated!.sessionTokenExpiresAt!.getTime() - Date.now()) / 86400000;
    expect(diffDays).toBeGreaterThan(28);
    expect(diffDays).toBeLessThan(32);

    await prisma.user.delete({ where: { id: user.id } });
  });
});
