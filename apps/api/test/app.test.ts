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
  await prisma.practiceManager.deleteMany();
  await prisma.user.deleteMany();
  await prisma.bookingRequest.deleteMany();
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
    expect(forgotRes.json().success).toBe(true);

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
    expect(res.json()).toEqual({
      success: true,
      message: 'Wenn ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt.',
    });
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

  it('returns a generic success response for manager accounts without issuing a reset token', async () => {
    const passwordHash = await hashPassword('manager-pass-123');
    const managerUser = await prisma.user.create({
      data: {
        email: 'manager-reset@test.de',
        passwordHash,
        role: 'manager',
      },
    });
    await prisma.practiceManager.create({
      data: {
        email: managerUser.email,
        userId: managerUser.id,
        passwordHash,
      },
    });

    const forgotRes = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: managerUser.email },
    });
    expect(forgotRes.statusCode).toBe(200);
    expect(forgotRes.json()).toEqual({
      success: true,
      message: 'Wenn ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt.',
    });

    const userAfterRequest = await prisma.user.findUnique({ where: { email: managerUser.email } });
    expect(userAfterRequest?.passwordResetToken).toBeNull();
    expect(userAfterRequest?.passwordResetExpiresAt).toBeNull();
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

describe('Therapist-only auth scope', () => {
  it('rejects legacy manager login via /auth/login', async () => {
    const passwordHash = await hashPassword('manager-login-123');
    await prisma.practiceManager.create({
      data: {
        email: 'manager-login@test.de',
        passwordHash,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'manager-login@test.de', password: 'manager-login-123' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects manager session tokens for therapist profile updates', async () => {
    const therapistPasswordHash = await hashPassword('therapist-pass-123');
    const therapistUser = await prisma.user.create({
      data: {
        email: 'therapist-scope@test.de',
        passwordHash: therapistPasswordHash,
        role: 'therapist',
      },
    });
    const therapist = await prisma.therapist.create({
      data: {
        email: therapistUser.email,
        userId: therapistUser.id,
        fullName: 'Therapist Scope',
        professionalTitle: 'Physiotherapeut',
        city: 'Köln',
        specializations: 'Rücken',
        languages: 'de',
        certifications: '',
        passwordHash: therapistPasswordHash,
      },
    });

    const managerPasswordHash = await hashPassword('manager-pass-123');
    const managerUser = await prisma.user.create({
      data: {
        email: 'manager-scope@test.de',
        passwordHash: managerPasswordHash,
        role: 'manager',
        sessionToken: 'manager-token',
      },
    });
    await prisma.practiceManager.create({
      data: {
        email: managerUser.email,
        userId: managerUser.id,
        passwordHash: managerPasswordHash,
        sessionToken: 'manager-token',
        therapistId: therapist.id,
      },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/auth/me',
      headers: { authorization: 'Bearer manager-token' },
      payload: { bio: 'Neue Bio' },
    });

    expect(res.statusCode).toBe(401);

    const therapistAfterPatch = await prisma.therapist.findUnique({ where: { id: therapist.id } });
    expect(therapistAfterPatch?.bio).toBeNull();
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

describe.skip('Invite Flow: practice manager creates therapist profile', () => {
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

describe.skip('POST /manager/register', () => {
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

describe.skip('POST /manager/login + GET /manager/me', () => {
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

describe.skip('Manager visibility in search', () => {
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
