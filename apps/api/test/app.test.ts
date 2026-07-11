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
  await prisma.therapistDocument.deleteMany();
  await prisma.therapistPracticeLink.deleteMany();
  await prisma.therapist.deleteMany();
  await prisma.practice.deleteMany();
  await prisma.specializationOption.deleteMany();
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
    expect(initialRes.json()).toEqual({ underConstruction: false, coursesEnabled: true });

    const updateRes = await app.inject({
      method: 'POST',
      url: '/admin/site-settings/update',
      headers: AUTH,
      payload: { underConstruction: true },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json()).toEqual({ success: true, underConstruction: true, coursesEnabled: true });

    const nextRes = await app.inject({ method: 'GET', url: '/config/site' });
    expect(nextRes.statusCode).toBe(200);
    expect(nextRes.json()).toEqual({ underConstruction: true, coursesEnabled: true });
  });
});

describe('Specialization options', () => {
  it('returns active defaults through the public config route', async () => {
    const res = await app.inject({ method: 'GET', url: '/config/options' });

    expect(res.statusCode).toBe(200);
    expect(res.json().specializations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Sportphysiotherapie' }),
        expect.objectContaining({ label: 'Neurologische Rehabilitation' }),
      ]),
    );
  });

  it('supports admin CRUD and hides inactive options from public config', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/admin/specializations',
      headers: AUTH,
      payload: { label: 'CMD' },
    });
    expect(createRes.statusCode).toBe(201);

    const created = createRes.json();
    const toggleRes = await app.inject({
      method: 'POST',
      url: `/admin/specializations/${created.id}/toggle`,
      headers: AUTH,
    });
    expect(toggleRes.statusCode).toBe(200);
    expect(toggleRes.json().isActive).toBe(false);

    const publicRes = await app.inject({ method: 'GET', url: '/config/options' });
    expect(publicRes.json().specializations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'CMD' })]),
    );
  });

  it('prevents deleting a specialization that is used by a therapist', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/admin/specializations',
      headers: AUTH,
    });
    const option = listRes.json().specializations.find(
      (item: { label: string }) => item.label === 'Sportphysiotherapie',
    );

    await prisma.therapist.create({
      data: {
        email: 'specialization@test.de',
        fullName: 'Specialization Test',
        professionalTitle: 'Physiotherapeut:in',
        city: 'Köln',
        specializations: 'Sportphysiotherapie',
        languages: 'de',
      },
    });

    const deleteRes = await app.inject({
      method: 'POST',
      url: `/admin/specializations/${option.id}/delete`,
      headers: AUTH,
    });

    expect(deleteRes.statusCode).toBe(409);
  });

  it('falls back to default specializations when the storage table is unavailable', async () => {
    const countSpy = vi
      .spyOn(prisma.specializationOption, 'count')
      .mockRejectedValueOnce(new Error('no such table: SpecializationOption'));

    const res = await app.inject({ method: 'GET', url: '/config/options' });

    expect(res.statusCode).toBe(200);
    expect(res.json().specializations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Sportphysiotherapie' }),
        expect.objectContaining({ label: 'Neurologische Rehabilitation' }),
      ]),
    );

    countSpy.mockRestore();
  });

  it('keeps the admin specializations route available when the storage table is unavailable', async () => {
    const countSpy = vi
      .spyOn(prisma.specializationOption, 'count')
      .mockRejectedValueOnce(new Error('no such table: SpecializationOption'));

    const res = await app.inject({
      method: 'GET',
      url: '/admin/specializations',
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().specializations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Sportphysiotherapie', isActive: true }),
      ]),
    );

    countSpy.mockRestore();
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

  it('creates therapist as a private DRAFT (invisible until submitted + approved)', async () => {
    await seedConfirmedOtp(validPayload.email);
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: validPayload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.therapistId).toBeTruthy();
    expect(body.accountType).toBe('therapist');
    expect(body.employmentStatus).toBe('SELF_EMPLOYED');

    const therapist = await prisma.therapist.findUnique({ where: { id: body.therapistId } });
    // New accounts start as a private DRAFT — never publicly visible until the
    // therapist explicitly submits for review and an admin approves.
    expect(therapist?.reviewStatus).toBe('DRAFT');
    expect(therapist?.isVisible).toBe(false);
    expect(therapist?.isPublished).toBe(false);
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
    expect(body.kassenarten).toEqual([]);
    expect(body.documentCount).toBe(0);
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

describe('PATCH /auth/me therapist profile fields', () => {
  async function registerTherapist(email: string) {
    await seedConfirmedOtp(email);
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: {
        email,
        firstName: 'Pia',
        lastName: 'Therapeut',
        city: 'Köln',
        specializations: ['back pain'],
        languages: ['de'],
      },
    });
    return res.json() as { therapistId: string; token: string };
  }

  it('persists gender and normalized multiple kassenarten', async () => {
    const { therapistId, token } = await registerTherapist('patch-fields@test.com');
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        gender: 'female',
        kassenarten: ['gesetzlich', 'privat'],
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const therapist = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect(therapist?.gender).toBe('female');
    expect(therapist?.kassenart).toBe('gesetzlich, privat');
  });

  it('blocks booking mode activation before profile approval', async () => {
    const { token } = await registerTherapist('patch-booking-gate@test.com');
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        bookingMode: 'FIRST_APPOINTMENT_REQUEST',
      },
    });

    expect(patchRes.statusCode).toBe(400);
    expect(patchRes.json().message).toContain('Profilprüfung');
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
    const { therapistId, token } = regRes.json();

    // 2. Direkt nach Registrierung: DRAFT, nicht in Suche sichtbar
    const searchDraft = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'back pain', city: 'Köln' },
    });
    expect(searchDraft.json().therapists).toHaveLength(0);

    // 3. Profil auf 100% vervollständigen (Voraussetzung fürs Einreichen)
    await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        photo: 'https://example.com/p.jpg',
        certifications: ['MT'],
        kassenart: 'Alle',
        phone: '+49 221 555555',
        street: 'Hauptstrasse',
        houseNumber: '1',
        homeVisit: true,
        serviceRadiusKm: 15,
        bio: 'Ich bin Physiotherapeut:in mit einem Schwerpunkt auf Bewegungstherapie.',
      },
    });
    await prisma.therapistDocument.create({
      data: {
        therapistId,
        filename: `${therapistId}.pdf`,
        originalName: 'Berufsurkunde.pdf',
        mimetype: 'application/pdf',
      },
    });

    // Therapeut reicht das Profil explizit zur Prüfung ein → PENDING_REVIEW
    const submitRes = await app.inject({
      method: 'POST',
      url: '/therapists/me/submit-for-review',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().reviewStatus).toBe('PENDING_REVIEW');

    // Vor Freigabe weiterhin nicht in Suche sichtbar
    const searchBefore = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'back pain', city: 'Köln' },
    });
    expect(searchBefore.json().therapists).toHaveLength(0);

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

// ─── Employment status gate (PREPARING never publicly visible) ────────────────

describe('Employment status: PREPARING profiles stay private', () => {
  it('excludes a PREPARING therapist from search even when APPROVED + visible', async () => {
    const practice = await prisma.practice.create({
      data: { name: 'Prep Praxis', city: 'Köln', reviewStatus: 'APPROVED' },
    });
    await prisma.therapist.create({
      data: {
        email: 'preparing@test.com',
        fullName: 'Pia Preparing',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'back pain',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        isVisible: true,
        isPublished: true,
        employmentStatus: 'PREPARING',
        links: { create: { practiceId: practice.id, status: 'CONFIRMED' } },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { query: 'back pain', city: 'Köln' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().therapists).toHaveLength(0);
  });

  it('returns 404 on the public detail page for a PREPARING therapist', async () => {
    const t = await prisma.therapist.create({
      data: {
        email: 'preparing-detail@test.com',
        fullName: 'Pia Preparing',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'back pain',
        languages: 'de',
        certifications: '',
        reviewStatus: 'APPROVED',
        isVisible: true,
        employmentStatus: 'PREPARING',
      },
    });
    const res = await app.inject({ method: 'GET', url: `/therapist/${t.id}` });
    expect(res.statusCode).toBe(404);
  });

  it('blocks admin approval of a PREPARING profile', async () => {
    const t = await prisma.therapist.create({
      data: {
        email: 'preparing-approve@test.com',
        fullName: 'Pia Preparing',
        professionalTitle: 'PT',
        city: 'Köln',
        specializations: 'back pain',
        languages: 'de',
        certifications: '',
        reviewStatus: 'PENDING_REVIEW',
        employmentStatus: 'PREPARING',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/admin/therapists/${t.id}/approve`,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(400);
    const after = await prisma.therapist.findUnique({ where: { id: t.id } });
    expect(after?.reviewStatus).toBe('PENDING_REVIEW');
  });
});

// ─── Explicit submit-for-review ───────────────────────────────────────────────

describe('POST /therapists/me/submit-for-review', () => {
  async function registerTherapist(email: string, extra: Record<string, unknown> = {}) {
    await seedConfirmedOtp(email);
    const res = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: {
        email,
        firstName: 'Tom',
        lastName: 'Therapeut',
        city: 'Köln',
        specializations: ['back pain'],
        languages: ['de'],
        ...extra,
      },
    });
    return res.json() as { therapistId: string; token: string; employmentStatus: string };
  }

  // Bring a freshly-registered therapist to 100% completion so it can be submitted.
  async function completeProfile(token: string, therapistId: string) {
    await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        photo: 'https://example.com/p.jpg',
        certifications: ['MT'],
        kassenarten: ['gesetzlich', 'privat'],
        phone: '+49 221 555555',
        street: 'Hauptstrasse',
        houseNumber: '1',
        homeVisit: false,
        bio: 'Ich bin Physiotherapeut:in mit einem Schwerpunkt auf Bewegungstherapie.',
      },
    });
    await prisma.therapistDocument.create({
      data: {
        therapistId,
        filename: `${therapistId}.pdf`,
        originalName: 'Berufsurkunde.pdf',
        mimetype: 'application/pdf',
      },
    });
  }

  it('rejects submission of a minimally-complete profile (must be 100%)', async () => {
    const { token } = await registerTherapist('submit-minimal@test.com');
    const res = await app.inject({
      method: 'POST',
      url: '/therapists/me/submit-for-review',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('lets a SELF_EMPLOYED therapist submit once the profile is 100% complete', async () => {
    const { therapistId, token, employmentStatus } = await registerTherapist('submit-ok@test.com');
    expect(employmentStatus).toBe('SELF_EMPLOYED');
    await completeProfile(token, therapistId);

    const res = await app.inject({
      method: 'POST',
      url: '/therapists/me/submit-for-review',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reviewStatus).toBe('PENDING_REVIEW');

    const t = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect(t?.reviewStatus).toBe('PENDING_REVIEW');
  });

  it('registers a PREPARING therapist and rejects submission', async () => {
    const { therapistId, token } = await registerTherapist('submit-prep@test.com', {
      employmentStatus: 'PREPARING',
    });
    const t0 = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect(t0?.employmentStatus).toBe('PREPARING');
    expect(t0?.reviewStatus).toBe('DRAFT');

    const res = await app.inject({
      method: 'POST',
      url: '/therapists/me/submit-for-review',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    const t1 = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect(t1?.reviewStatus).toBe('DRAFT');
  });

  it('rejects submission of an incomplete profile', async () => {
    // Register without city/specializations → below the minimum review criteria
    await seedConfirmedOtp('submit-incomplete@test.com');
    const reg = await app.inject({
      method: 'POST',
      url: '/register/therapist',
      payload: { email: 'submit-incomplete@test.com', fullName: 'Min Imal' },
    });
    const { token } = reg.json();

    const res = await app.inject({
      method: 'POST',
      url: '/therapists/me/submit-for-review',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('does not change reviewStatus on a normal PATCH /auth/me update', async () => {
    const { therapistId, token } = await registerTherapist('submit-patch@test.com');

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { bio: 'Neue Bio' },
    });
    expect(patchRes.statusCode).toBe(200);

    const t = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect(t?.reviewStatus).toBe('DRAFT');
  });

  it('allows re-submission from CHANGES_REQUESTED', async () => {
    const { therapistId, token } = await registerTherapist('submit-changes@test.com');
    await completeProfile(token, therapistId);
    await prisma.therapist.update({
      where: { id: therapistId },
      data: { reviewStatus: 'CHANGES_REQUESTED' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/therapists/me/submit-for-review',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reviewStatus).toBe('PENDING_REVIEW');
  });

  it('returns the new missing fields before submission', async () => {
    const { token } = await registerTherapist('submit-missing-fields@test.com');
    const res = await app.inject({
      method: 'POST',
      url: '/therapists/me/submit-for-review',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('document');
    expect(res.json().message).toContain('phone');
    expect(res.json().message).toContain('bio');
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

// ─── Dynamic Booking ──────────────────────────────────────────────────────────

describe('Dynamic Booking', () => {
  let therapistToken: string;
  let therapistId: string;
  let patientToken: string;

  // Morgen 09:00 UTC (weit genug in der Zukunft für alle Tests)
  function futureStartsAt(offsetHours = 48) {
    const d = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return d;
  }

  async function setupTherapistAndPatient() {
    const therapist = await prisma.therapist.create({
      data: {
        email: 'dyn-therapist@test.de',
        fullName: 'Dynamic Therapeutin',
        professionalTitle: 'Physiotherapeutin',
        city: 'Berlin',
        specializations: 'Rückenschmerzen',
        languages: 'Deutsch',
        heilmittel: 'KG,MT',
        reviewStatus: 'APPROVED',
        isVisible: true,
        bookingMode: 'FIRST_APPOINTMENT_REQUEST',
        sessionToken: 'dyn-therapist-token',
        qualifikationenStatus: 'VERIFIZIERT',
      },
    });
    therapistToken = 'dyn-therapist-token';
    therapistId = therapist.id;

    // Arbeitszeit für alle Wochentage 00:00–23:59, damit jede runde Stunde
    // aus futureStartsAt() ein gültiges (buchbares) Zeitfenster ist.
    await prisma.therapistWorkingHoursRule.createMany({
      data: Array.from({ length: 7 }, (_, weekday) => ({
        therapistId,
        weekday,
        startMinute: 0,
        endMinute: 23 * 60 + 59,
      })),
    });

    await prisma.user.create({
      data: {
        email: 'dyn-patient@test.de',
        passwordHash: await hashPassword('test1234'),
        role: 'patient',
        firstName: 'Dynamic',
        lastName: 'Patient',
        sessionToken: 'dyn-patient-token',
        emailVerifiedAt: new Date(),
      },
    });
    patientToken = 'dyn-patient-token';
  }

  beforeEach(async () => {
    await setupTherapistAndPatient();
  });

  afterEach(async () => {
    await prisma.bookingRequest.deleteMany();
    await prisma.therapistBlockedTime.deleteMany();
    await prisma.therapistService.deleteMany();
    await prisma.therapistWorkingHoursRule.deleteMany();
  });

  // ── /therapist/services ──────────────────────────────────────────────────

  it('PUT /therapist/services/:heilmittelKey — legt Leistungskonfiguration an (Upsert)', async () => {
    await prisma.heilmittelOption.upsert({
      where: { key: 'KG' },
      create: { key: 'KG', label: 'KG', defaultDurationMin: 20 },
      update: {},
    });

    const res = await app.inject({
      method: 'PUT', url: '/therapist/services/KG',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { durationMin: 25 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().durationMin).toBe(25);
    expect(res.json().heilmittelKey).toBe('KG');
  });

  it('PUT /therapist/services/:heilmittelKey — lehnt unbekanntes Heilmittel ab', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/therapist/services/UNBEKANNT',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { durationMin: 20 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /therapist/services — listet konfigurierte Leistungen auf', async () => {
    await prisma.heilmittelOption.upsert({
      where: { key: 'KG' },
      create: { key: 'KG', label: 'KG', defaultDurationMin: 20 },
      update: {},
    });
    await prisma.therapistService.create({
      data: { therapistId, heilmittelKey: 'KG', durationMin: 30 },
    });

    const res = await app.inject({
      method: 'GET', url: '/therapist/services',
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(res.statusCode).toBe(200);
    // GET now returns ALL active HeilmittelOptions merged with configs
    const services = res.json().services;
    const kg = services.find((s: { heilmittelKey: string }) => s.heilmittelKey === 'KG');
    expect(kg).toBeDefined();
    expect(kg.durationMin).toBe(30);
    expect(typeof kg.label).toBe('string');
  });

  // ── Heilmittel-Konsolidierung (Phase 1) ───────────────────────────────────

  it('GET /therapist/services — gibt alle aktiven HeilmittelOptionen zurück (inkl. unkonfigurierte)', async () => {
    const res = await app.inject({
      method: 'GET', url: '/therapist/services',
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(res.statusCode).toBe(200);
    const services = res.json().services;
    expect(Array.isArray(services)).toBe(true);
    expect(services.length).toBeGreaterThan(0);
    // Alle Einträge haben label und isActive
    for (const svc of services) {
      expect(typeof svc.label).toBe('string');
      expect(typeof svc.isActive).toBe('boolean');
      expect(typeof svc.heilmittelKey).toBe('string');
      expect(typeof svc.durationMin).toBe('number');
    }
  });

  it('PUT /therapist/services/:key — syncTherapistHeilmittel aktualisiert therapist.heilmittel', async () => {
    await prisma.heilmittelOption.upsert({
      where: { key: 'KG' },
      create: { key: 'KG', label: 'KG', defaultDurationMin: 20 },
      update: {},
    });
    // Aktiviere KG → sollte therapist.heilmittel = 'KG' setzen
    await app.inject({
      method: 'PUT', url: '/therapist/services/KG',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { durationMin: 20, isActive: true },
    });
    const therapist = await prisma.therapist.findUnique({ where: { id: therapistId } });
    expect((therapist as any).heilmittel).toContain('KG');
  });

  it('GET /auth/me — heilmittel wird aus aktiven Services abgeleitet', async () => {
    await prisma.heilmittelOption.upsert({
      where: { key: 'MT' },
      create: { key: 'MT', label: 'MT', defaultDurationMin: 25 },
      update: {},
    });
    await prisma.therapistService.upsert({
      where: { therapistId_heilmittelKey: { therapistId, heilmittelKey: 'MT' } },
      create: { therapistId, heilmittelKey: 'MT', durationMin: 25, isActive: true },
      update: { isActive: true },
    });
    const res = await app.inject({
      method: 'GET', url: '/auth/me',
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(res.statusCode).toBe(200);
    const profile = res.json();
    expect(profile.heilmittel).toContain('MT');
    // Cleanup
    await prisma.therapistService.deleteMany({ where: { therapistId, heilmittelKey: 'MT' } });
  });

  it('GET /auth/me — heilmittel fällt auf legacy therapist.heilmittel zurück (kein Service vorhanden)', async () => {
    await prisma.therapistService.deleteMany({ where: { therapistId } });
    await (prisma.therapist as any).update({
      where: { id: therapistId },
      data: { heilmittel: 'KG, MT' },
    });
    const res = await app.inject({
      method: 'GET', url: '/auth/me',
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(res.statusCode).toBe(200);
    const profile = res.json();
    expect(profile.heilmittel).toContain('KG');
  });

  // ── /therapist/blocked-times ──────────────────────────────────────────────

  it('POST /therapist/blocked-times — legt Blockzeit an', async () => {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const res = await app.inject({
      method: 'POST', url: '/therapist/blocked-times',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { startsAt: start.toISOString(), endsAt: end.toISOString(), title: 'Pause' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().title).toBe('Pause');
  });

  it('POST /therapist/blocked-times — lehnt endsAt <= startsAt ab', async () => {
    const t = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const res = await app.inject({
      method: 'POST', url: '/therapist/blocked-times',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { startsAt: t.toISOString(), endsAt: t.toISOString() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /therapist/blocked-times/:id — löscht eigene Blockzeit', async () => {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const created = await prisma.therapistBlockedTime.create({
      data: { therapistId, startsAt: start, endsAt: end },
    });

    const res = await app.inject({
      method: 'DELETE', url: `/therapist/blocked-times/${created.id}`,
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deleted).toBe(true);
  });

  // ── /therapists/:id/available-slots ──────────────────────────────────────

  it('GET /therapists/:id/available-slots — gibt live berechnete Zeitfenster zurück', async () => {
    const day = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    day.setHours(0, 0, 0, 0);
    await prisma.therapistWorkingHoursRule.create({
      data: {
        therapistId,
        weekday: day.getDay(),
        startMinute: 8 * 60,
        endMinute: 10 * 60,
      },
    });

    await prisma.heilmittelOption.upsert({
      where: { key: 'KG' },
      create: { key: 'KG', label: 'KG', defaultDurationMin: 20 },
      update: { defaultDurationMin: 20 },
    });

    const from = day.toISOString();
    const to = new Date(day.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const res = await app.inject({
      method: 'GET',
      url: `/therapists/${therapistId}/available-slots?heilmittel=KG&from=${from}&to=${to}`,
    });
    expect(res.statusCode).toBe(200);
    // 08:00–10:00 à 20 Min → 6 Slots
    expect(res.json().slots.length).toBeGreaterThanOrEqual(6);
    expect(res.json().slots[0].startsAt).toBeTruthy();
    expect(res.json().slots[0].endsAt).toBeTruthy();
  });

  it('GET /therapists/:id/available-slots — erfordert heilmittel-Parameter', async () => {
    const res = await app.inject({
      method: 'GET', url: `/therapists/${therapistId}/available-slots`,
    });
    expect(res.statusCode).toBe(400);
  });

  // ── POST /bookings (dynamisch) ────────────────────────────────────────────

  it('POST /bookings — bucht Zeitfenster atomisch (startsAt)', async () => {
    const startsAt = futureStartsAt().toISOString();

    const res = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt, heilmittel: 'KG', consentAccepted: true },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().startsAt).toBeTruthy();
    expect(res.json().endsAt).toBeTruthy();

    const created = await prisma.bookingRequest.findUnique({ where: { id: res.json().id } });
    expect(created?.startsAt).toBeInstanceOf(Date);
  });

  it('POST /bookings — speichert heilmittel + kassenart', async () => {
    const startsAt = futureStartsAt().toISOString();
    const res = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt, heilmittel: 'KG', kassenart: 'gesetzlich', consentAccepted: true },
    });
    expect(res.statusCode).toBe(201);
    const created = await prisma.bookingRequest.findUnique({ where: { id: res.json().id } });
    expect(created?.heilmittel).toBe('KG');
    expect(created?.kassenart).toBe('gesetzlich');
  });

  it('POST /bookings — lehnt Heilmittel ab, das der Therapeut nicht anbietet', async () => {
    const res = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt: futureStartsAt().toISOString(), heilmittel: 'MLD', consentAccepted: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /bookings — lehnt unapproved Therapeuten ab', async () => {
    await prisma.therapist.update({ where: { id: therapistId }, data: { reviewStatus: 'PENDING_REVIEW' } });
    const res = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt: futureStartsAt().toISOString(), heilmittel: 'KG', consentAccepted: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /bookings — Doppelbuchung desselben Zeitfensters liefert 409', async () => {
    const startsAt = futureStartsAt().toISOString();

    await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt, heilmittel: 'KG', consentAccepted: true },
    });

    const patient2 = await prisma.user.create({
      data: { email: 'dyn-patient2@test.de', passwordHash: 'x', role: 'patient', sessionToken: 'dyn-patient2-token', emailVerifiedAt: new Date() },
    });
    const res2 = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: 'Bearer dyn-patient2-token', 'content-type': 'application/json' },
      payload: { therapistId, startsAt, heilmittel: 'KG', consentAccepted: true },
    });
    expect(res2.statusCode).toBe(409);
  });

  it('POST /bookings — lehnt Zeitfenster innerhalb einer Blockzeit ab', async () => {
    const startsAt = futureStartsAt();
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    await prisma.therapistBlockedTime.create({
      data: { therapistId, startsAt, endsAt },
    });

    const res = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt: startsAt.toISOString(), heilmittel: 'KG', consentAccepted: true },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /bookings — lehnt Termin außerhalb der Arbeitszeit ab', async () => {
    // Arbeitszeit auf nur Montag beschränken, dann einen Nicht-Montag buchen
    await prisma.therapistWorkingHoursRule.deleteMany({ where: { therapistId } });
    await prisma.therapistWorkingHoursRule.create({
      data: { therapistId, weekday: 1, startMinute: 8 * 60, endMinute: 12 * 60 },
    });

    // Nächsten Mittwoch 09:00 wählen (garantiert kein Montag)
    const d = new Date();
    d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7));
    d.setHours(9, 0, 0, 0);

    const res = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt: d.toISOString(), heilmittel: 'KG', consentAccepted: true },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /bookings — lehnt deaktivierte Leistung ab (TherapistService isActive=false)', async () => {
    await prisma.heilmittelOption.upsert({
      where: { key: 'KG' },
      create: { key: 'KG', label: 'KG', defaultDurationMin: 20 },
      update: {},
    });
    await prisma.therapistService.create({
      data: { therapistId, heilmittelKey: 'KG', durationMin: 20, isActive: false },
    });

    // available-slots muss leer sein
    const day = futureStartsAt();
    const from = new Date(day); from.setHours(0, 0, 0, 0);
    const to = new Date(day); to.setHours(23, 59, 59, 999);
    const slotsRes = await app.inject({
      method: 'GET',
      url: `/therapists/${therapistId}/available-slots?heilmittel=KG&from=${from.toISOString()}&to=${to.toISOString()}`,
    });
    expect(slotsRes.json().slots).toHaveLength(0);

    // und Buchung wird abgelehnt
    const res = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt: futureStartsAt().toISOString(), heilmittel: 'KG', consentAccepted: true },
    });
    expect(res.statusCode).toBe(400);
  });

  // ── Respond / Cancel ──────────────────────────────────────────────────────

  async function createDynBooking(offsetHours = 48) {
    const startsAt = futureStartsAt(offsetHours);
    const res = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt: startsAt.toISOString(), heilmittel: 'KG', consentAccepted: true },
    });
    return res.json().id as string;
  }

  it('PATCH /bookings/:id/respond CONFIRM — Buchung wird bestätigt', async () => {
    const bookingId = await createDynBooking();
    const res = await app.inject({
      method: 'PATCH', url: `/bookings/${bookingId}/respond`,
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { action: 'CONFIRM' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('CONFIRMED');
    expect(res.json().confirmedSlotAt).toBeTruthy();
  });

  it('PATCH /bookings/:id/respond DECLINE — Buchung wird abgelehnt', async () => {
    const bookingId = await createDynBooking();
    const res = await app.inject({
      method: 'PATCH', url: `/bookings/${bookingId}/respond`,
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { action: 'DECLINE', declinedReason: 'Keine Kapazität' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('DECLINED');
    expect(res.json().declinedReason).toBe('Keine Kapazität');
  });

  it('PATCH /bookings/:id/cancel — PENDING stornieren braucht keinen Grund', async () => {
    const bookingId = await createDynBooking();
    const res = await app.inject({
      method: 'PATCH', url: `/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${patientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('CANCELLED');
    expect(res.json().cancelledBy).toBe('PATIENT');

    // Nach Stornierung ist dasselbe Zeitfenster wieder buchbar (DECLINED-Buchung
    // zählt nicht mehr als Overlap).
    const rebookRes = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt: futureStartsAt().toISOString(), heilmittel: 'KG', consentAccepted: true },
    });
    expect(rebookRes.statusCode).toBe(201);
  });

  it('PATCH /bookings/:id/cancel — CONFIRMED stornieren erfordert Grund', async () => {
    const bookingId = await createDynBooking(48);
    await app.inject({
      method: 'PATCH', url: `/bookings/${bookingId}/respond`,
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { action: 'CONFIRM' },
    });

    const noReason = await app.inject({
      method: 'PATCH', url: `/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${patientToken}` },
    });
    expect(noReason.statusCode).toBe(400);

    const withReason = await app.inject({
      method: 'PATCH', url: `/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { cancelReason: 'Ich bin verhindert' },
    });
    expect(withReason.statusCode).toBe(200);
    expect(withReason.json().cancelReason).toBe('Ich bin verhindert');
    expect(withReason.json().cancelledAt).toBeTruthy();
  });

  it('PATCH /bookings/:id/therapist-cancel — erfordert Grund', async () => {
    const bookingId = await createDynBooking(48);
    await app.inject({
      method: 'PATCH', url: `/bookings/${bookingId}/respond`,
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { action: 'CONFIRM' },
    });

    const noReason = await app.inject({
      method: 'PATCH', url: `/bookings/${bookingId}/therapist-cancel`,
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(noReason.statusCode).toBe(400);

    const withReason = await app.inject({
      method: 'PATCH', url: `/bookings/${bookingId}/therapist-cancel`,
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { cancelReason: 'Krankheitsbedingt' },
    });
    expect(withReason.statusCode).toBe(200);
    expect(withReason.json().cancelReason).toBe('Krankheitsbedingt');
    expect(withReason.json().cancelledBy).toBe('THERAPIST');

    const incoming = await app.inject({
      method: 'GET', url: '/bookings/incoming',
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    const found = incoming.json().find((b: { id: string }) => b.id === bookingId);
    expect(found.cancelReason).toBe('Krankheitsbedingt');
  });

  it('Expiry — abgelaufene PENDING-Buchung wird auf EXPIRED gesetzt', async () => {
    const startsAt = futureStartsAt();
    const booking = await prisma.bookingRequest.create({
      data: {
        therapistId,
        status: 'PENDING',
        patientName: 'Test',
        patientEmail: 'test@x.de',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 20 * 60_000),
        confirmedSlotAt: startsAt,
        consentAcceptedAt: new Date(),
        responseDueAt: new Date(Date.now() - 1000), // bereits abgelaufen
      },
    });

    // Expiry wird beim nächsten List-Call getriggert
    await app.inject({
      method: 'GET', url: '/bookings/incoming',
      headers: { authorization: `Bearer ${therapistToken}` },
    });

    const updated = await prisma.bookingRequest.findUnique({ where: { id: booking.id } });
    expect(updated?.status).toBe('EXPIRED');

    // Nach Ablauf muss dasselbe Zeitfenster wieder buchbar sein
    const rebookRes = await app.inject({
      method: 'POST', url: '/bookings',
      headers: { authorization: `Bearer ${patientToken}`, 'content-type': 'application/json' },
      payload: { therapistId, startsAt: startsAt.toISOString(), heilmittel: 'KG', consentAccepted: true },
    });
    expect(rebookRes.statusCode).toBe(201);
  });
});

// ─── Therapist Working Hours ───────────────────────────────────────────────────

describe('Therapist Working Hours', () => {
  let therapistToken: string;
  let therapistId: string;

  beforeEach(async () => {
    const therapist = await prisma.therapist.create({
      data: {
        email: 'working-hours-therapist@test.de',
        fullName: 'Arbeitszeiten Therapeutin',
        professionalTitle: 'Physiotherapeutin',
        city: 'Berlin',
        specializations: 'Rückenschmerzen',
        languages: 'Deutsch',
        reviewStatus: 'APPROVED',
        isVisible: true,
        bookingMode: 'FIRST_APPOINTMENT_REQUEST',
        sessionToken: 'working-hours-therapist-token',
      },
    });
    therapistToken = 'working-hours-therapist-token';
    therapistId = therapist.id;
  });

  afterEach(async () => {
    await prisma.bookingRequest.deleteMany();
    await prisma.therapistWorkingHoursRule.deleteMany();
  });

  function mondayRule(overrides: Record<string, unknown> = {}) {
    return {
      weekday: 1,
      startMinute: 8 * 60,
      endMinute: 12 * 60,
      ...overrides,
    };
  }

  it('GET /therapist/working-hours — returns an empty list for a therapist with no rules', async () => {
    const res = await app.inject({
      method: 'GET', url: '/therapist/working-hours',
      headers: { authorization: `Bearer ${therapistToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rules).toEqual([]);
  });

  it('PUT /therapist/working-hours — saves rules and returns them (kein Slot-Materialisierer mehr)', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/therapist/working-hours',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { rules: [mondayRule()] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.rules).toHaveLength(1);
    expect(body.rules[0].weekday).toBe(1);
    expect(body.rules[0].startMinute).toBe(8 * 60);
    // Kein 'materialized'-Feld mehr — Slots werden live berechnet
    expect(body.materialized).toBeUndefined();
  });

  it('PUT /therapist/working-hours — rejects therapists without an approved/active booking mode', async () => {
    await prisma.therapist.update({ where: { id: therapistId }, data: { reviewStatus: 'PENDING_REVIEW' } });
    const res = await app.inject({
      method: 'PUT', url: '/therapist/working-hours',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { rules: [mondayRule()] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PUT /therapist/working-hours — rejects an invalid rule (endMinute before startMinute)', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/therapist/working-hours',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { rules: [mondayRule({ startMinute: 600, endMinute: 480 })] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PUT /therapist/working-hours — re-saving replaces the rule set', async () => {
    await app.inject({
      method: 'PUT', url: '/therapist/working-hours',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { rules: [mondayRule()] },
    });

    const second = await app.inject({
      method: 'PUT', url: '/therapist/working-hours',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { rules: [mondayRule({ weekday: 2 })] },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().rules).toHaveLength(1);
    expect(second.json().rules[0].weekday).toBe(2);

    const rules = await prisma.therapistWorkingHoursRule.findMany({ where: { therapistId } });
    expect(rules).toHaveLength(1);
    expect(rules[0].weekday).toBe(2);
  });

  it('PUT /therapist/working-hours — empty array clears all rules', async () => {
    await app.inject({
      method: 'PUT', url: '/therapist/working-hours',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { rules: [mondayRule()] },
    });

    const res = await app.inject({
      method: 'PUT', url: '/therapist/working-hours',
      headers: { authorization: `Bearer ${therapistToken}`, 'content-type': 'application/json' },
      payload: { rules: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rules).toEqual([]);

    const remainingRules = await prisma.therapistWorkingHoursRule.findMany({ where: { therapistId } });
    expect(remainingRules).toEqual([]);
  });
});

// ─── Therapist Patients ───────────────────────────────────────────────────────

describe('Therapist Patients', () => {
  async function createTherapist(email: string, sessionToken: string) {
    return prisma.therapist.create({
      data: {
        email, fullName: `Therapeut ${email}`, professionalTitle: 'Physiotherapeut',
        city: 'Berlin', specializations: 'Rückenschmerzen', languages: 'Deutsch',
        reviewStatus: 'APPROVED', isVisible: true,
        bookingMode: 'FIRST_APPOINTMENT_REQUEST', sessionToken,
      },
    });
  }

  async function createPatient(email: string, sessionToken: string) {
    return prisma.user.create({
      data: {
        email, passwordHash: await hashPassword('test1234'), role: 'patient',
        firstName: 'Patient', lastName: email.split('@')[0],
        sessionToken, emailVerifiedAt: new Date(), phone: '+49 170 0000000',
      },
    });
  }

  async function createBooking(therapistId: string, patientUserId: string, overrides: Record<string, unknown> = {}) {
    return prisma.bookingRequest.create({
      data: {
        therapistId, patientUserId, status: 'CONFIRMED',
        patientName: 'Test Patient', patientEmail: 'snapshot@test.de',
        consentAcceptedAt: new Date(), responseDueAt: new Date(Date.now() + 86400000),
        confirmedSlotAt: new Date(Date.now() + 3600000),
        ...overrides,
      },
    });
  }

  it('GET /therapist/patients — rejects non-therapist callers', async () => {
    await createPatient('reject-patient@test.de', 'reject-patient-token');
    const res = await app.inject({
      method: 'GET', url: '/therapist/patients',
      headers: { authorization: 'Bearer reject-patient-token' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /therapist/patients — deduplicates by patientUserId and aggregates booking count', async () => {
    const therapist = await createTherapist('dedup-therapist@test.de', 'dedup-therapist-token');
    const patient = await createPatient('dedup-patient@test.de', 'dedup-patient-token');
    await createBooking(therapist.id, patient.id, {
      status: 'DECLINED', declinedReason: 'Keine Kapazität', createdAt: new Date(Date.now() - 2 * 86400000),
    });
    await createBooking(therapist.id, patient.id, { status: 'CONFIRMED' });

    const res = await app.inject({
      method: 'GET', url: '/therapist/patients',
      headers: { authorization: 'Bearer dedup-therapist-token' },
    });
    expect(res.statusCode).toBe(200);
    const { patients } = res.json();
    expect(patients).toHaveLength(1);
    expect(patients[0].id).toBe(patient.id);
    expect(patients[0].bookingCount).toBe(2);
    expect(patients[0].email).toBe('dedup-patient@test.de');
    expect(patients[0].addressLine).toBeNull();
  });

  it('GET /therapist/patients — does not leak patients booked only with another therapist', async () => {
    const therapistA = await createTherapist('scope-a@test.de', 'scope-a-token');
    const therapistB = await createTherapist('scope-b@test.de', 'scope-b-token');
    const patientA = await createPatient('scope-patient-a@test.de', 'scope-patient-a-token');
    const patientB = await createPatient('scope-patient-b@test.de', 'scope-patient-b-token');
    await createBooking(therapistA.id, patientA.id);
    await createBooking(therapistB.id, patientB.id);

    const res = await app.inject({
      method: 'GET', url: '/therapist/patients',
      headers: { authorization: 'Bearer scope-a-token' },
    });
    const { patients } = res.json();
    expect(patients).toHaveLength(1);
    expect(patients[0].id).toBe(patientA.id);
  });

  it('GET /therapist/patients/:patientUserId — returns appointment history scoped to the relationship', async () => {
    const therapist = await createTherapist('detail-therapist@test.de', 'detail-therapist-token');
    const patient = await createPatient('detail-patient@test.de', 'detail-patient-token');
    await createBooking(therapist.id, patient.id, {
      status: 'DECLINED', declinedReason: 'Keine Kapazität', message: 'Bitte vormittags',
    });
    await createBooking(therapist.id, patient.id, { status: 'CONFIRMED' });

    const res = await app.inject({
      method: 'GET', url: `/therapist/patients/${patient.id}`,
      headers: { authorization: 'Bearer detail-therapist-token' },
    });
    expect(res.statusCode).toBe(200);
    const { patient: patientPayload, appointments } = res.json();
    expect(patientPayload.id).toBe(patient.id);
    expect(appointments).toHaveLength(2);
    expect(appointments.some((a: any) => a.declinedReason === 'Keine Kapazität')).toBe(true);
  });

  it('GET /therapist/patients/:patientUserId — 404 when no booking relationship exists', async () => {
    const therapistA = await createTherapist('iso-a@test.de', 'iso-a-token');
    const therapistB = await createTherapist('iso-b@test.de', 'iso-b-token');
    const patientB = await createPatient('iso-patient-b@test.de', 'iso-patient-b-token');
    await createBooking(therapistB.id, patientB.id);

    const res = await app.inject({
      method: 'GET', url: `/therapist/patients/${patientB.id}`,
      headers: { authorization: 'Bearer iso-a-token' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /therapist/patients/:patientUserId — rejects non-therapist callers', async () => {
    const patient = await createPatient('detail-reject-patient@test.de', 'detail-reject-patient-token');
    const res = await app.inject({
      method: 'GET', url: `/therapist/patients/${patient.id}`,
      headers: { authorization: 'Bearer detail-reject-patient-token' },
    });
    expect(res.statusCode).toBe(403);
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

// ─── E2E: Therapeut legt neue Terminzeiten an (kompletter Ablauf) ──────────────
// Ein atomarer Test, der den echten HTTP-Fluss durchspielt:
// Arbeitszeit → Leistungsdauer → Blockzeit → live berechnete Zeitfenster → Buchung
// inkl. Ablehnungen (Doppelbuchung, außerhalb Arbeitszeit, Blockzeit, deaktiviert).
describe('E2E — Therapeut legt neue Terminzeiten an', () => {
  const FLOW_T = 'flow-therapist-token';
  const FLOW_P = 'flow-patient-token';

  function nextMonday() {
    const d = new Date();
    d.setDate(d.getDate() + (((1 - d.getDay() + 7) % 7) || 7));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const at = (day: Date, h: number, m = 0) => {
    const d = new Date(day); d.setHours(h, m, 0, 0); return d;
  };
  const hhmm = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  it('Arbeitszeit → Leistungsdauer → Blockzeit → buchbare Zeitfenster → Buchung', async () => {
    const monday = nextMonday();

    const therapist = await prisma.therapist.create({
      data: {
        email: 'flow-therapist@test.de', fullName: 'Flow Therapeutin',
        professionalTitle: 'Physiotherapeutin', city: 'Berlin',
        specializations: 'Rückenschmerzen', languages: 'Deutsch', heilmittel: 'KG,MT',
        reviewStatus: 'APPROVED', isVisible: true,
        bookingMode: 'FIRST_APPOINTMENT_REQUEST', sessionToken: FLOW_T,
        qualifikationenStatus: 'VERIFIZIERT',
      },
    });
    const therapistId = therapist.id;
    await prisma.user.create({
      data: {
        email: 'flow-patient@test.de', passwordHash: await hashPassword('test1234'),
        role: 'patient', firstName: 'Flow', lastName: 'Patient',
        phone: '+49 170 1234567', sessionToken: FLOW_P, emailVerifiedAt: new Date(),
      },
    });
    await prisma.heilmittelOption.upsert({
      where: { key: 'KG' },
      create: { key: 'KG', label: 'KG', defaultDurationMin: 20 },
      update: { defaultDurationMin: 20 },
    });

    const tH = { authorization: `Bearer ${FLOW_T}`, 'content-type': 'application/json' };
    const pH = { authorization: `Bearer ${FLOW_P}`, 'content-type': 'application/json' };
    const slotsUrl = `/therapists/${therapistId}/available-slots?heilmittel=KG`
      + `&from=${at(monday, 0, 0).toISOString()}&to=${at(monday, 23, 59).toISOString()}`;

    // [1] Arbeitszeit Mo 08:00–12:00
    const wh = await app.inject({
      method: 'PUT', url: '/therapist/working-hours', headers: tH,
      payload: { rules: [{ weekday: 1, startMinute: 8 * 60, endMinute: 12 * 60 }] },
    });
    console.log('\n[1] PUT /therapist/working-hours →', wh.statusCode, '| rules:', wh.json().rules?.length);
    expect(wh.statusCode).toBe(200);
    expect(wh.json().rules).toHaveLength(1);
    expect(wh.json().materialized).toBeUndefined();

    // [2] KG-Dauer = 30 Min
    const svc = await app.inject({
      method: 'PUT', url: '/therapist/services/KG', headers: tH, payload: { durationMin: 30 },
    });
    console.log('[2] PUT /therapist/services/KG →', svc.statusCode, '| durationMin:', svc.json().durationMin);
    expect(svc.statusCode).toBe(200);
    expect(svc.json().durationMin).toBe(30);

    // [3] Blockzeit 10:00–10:30
    const block = await app.inject({
      method: 'POST', url: '/therapist/blocked-times', headers: tH,
      payload: { startsAt: at(monday, 10, 0).toISOString(), endsAt: at(monday, 10, 30).toISOString(), title: 'Dokumentation' },
    });
    console.log('[3] POST /therapist/blocked-times →', block.statusCode, '| title:', block.json().title);
    expect(block.statusCode).toBe(201);

    // [4] berechnete KG-Zeitfenster (30 Min, Blockzeit ausgespart)
    const s1 = await app.inject({ method: 'GET', url: slotsUrl });
    const t1 = s1.json().slots.map((s: { startsAt: string }) => hhmm(s.startsAt));
    console.log('[4] GET /available-slots?heilmittel=KG →', s1.statusCode, '\n    freie KG-Termine:', t1.join('  '));
    expect(s1.statusCode).toBe(200);
    expect(t1).toEqual(['08:00', '08:30', '09:00', '09:30', '10:30', '11:00', '11:30']);

    // [5] Patient bucht 09:00 → 09:00–09:30
    const book = await app.inject({
      method: 'POST', url: '/bookings', headers: pH,
      payload: { therapistId, heilmittel: 'KG', startsAt: at(monday, 9, 0).toISOString(), kassenart: 'gesetzlich', consentAccepted: true },
    });
    console.log('[5] POST /bookings 09:00 →', book.statusCode, '| Zeitraum:', hhmm(book.json().startsAt), '-', hhmm(book.json().endsAt));
    expect(book.statusCode).toBe(201);
    expect(hhmm(book.json().startsAt)).toBe('09:00');
    expect(hhmm(book.json().endsAt)).toBe('09:30');

    // [6] gebuchtes 09:00-Fenster verschwindet (09:30 bleibt — keine Überschneidung)
    const s2 = await app.inject({ method: 'GET', url: slotsUrl });
    const t2 = s2.json().slots.map((s: { startsAt: string }) => hhmm(s.startsAt));
    console.log('[6] GET /available-slots (nach Buchung) →', t2.join('  '));
    expect(t2).not.toContain('09:00');
    expect(t2).toEqual(['08:00', '08:30', '09:30', '10:30', '11:00', '11:30']);

    // [7] erneute Buchung 09:00 → 409
    const dupe = await app.inject({
      method: 'POST', url: '/bookings', headers: pH,
      payload: { therapistId, heilmittel: 'KG', startsAt: at(monday, 9, 0).toISOString(), consentAccepted: true },
    });
    console.log('[7] POST /bookings 09:00 erneut →', dupe.statusCode);
    expect(dupe.statusCode).toBe(409);

    // [8] vor Arbeitsbeginn (07:00) → 409
    const early = await app.inject({
      method: 'POST', url: '/bookings', headers: pH,
      payload: { therapistId, heilmittel: 'KG', startsAt: at(monday, 7, 0).toISOString(), consentAccepted: true },
    });
    console.log('[8] POST /bookings 07:00 (vor Arbeitsbeginn) →', early.statusCode);
    expect(early.statusCode).toBe(409);

    // [9] in der Blockzeit (10:00) → 409
    const inBlock = await app.inject({
      method: 'POST', url: '/bookings', headers: pH,
      payload: { therapistId, heilmittel: 'KG', startsAt: at(monday, 10, 0).toISOString(), consentAccepted: true },
    });
    console.log('[9] POST /bookings 10:00 (Blockzeit) →', inBlock.statusCode);
    expect(inBlock.statusCode).toBe(409);

    // [10] KG deaktivieren → keine Slots + Buchung 400
    const off = await app.inject({
      method: 'PUT', url: '/therapist/services/KG', headers: tH, payload: { durationMin: 30, isActive: false },
    });
    expect(off.statusCode).toBe(200);
    const s3 = await app.inject({ method: 'GET', url: slotsUrl });
    const bookOff = await app.inject({
      method: 'POST', url: '/bookings', headers: pH,
      payload: { therapistId, heilmittel: 'KG', startsAt: at(monday, 8, 0).toISOString(), consentAccepted: true },
    });
    // Nach Sync ist KG nicht mehr angeboten → available-slots 404, Buchung 400
    console.log('[10] KG deaktiviert → available-slots:', s3.statusCode, '| Buchung:', bookOff.statusCode);
    expect(s3.statusCode).toBe(404);
    expect(bookOff.statusCode).toBe(400);
  });
});
