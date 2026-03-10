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
    expect(body.therapists[0].fullName).toBe('Relevant Match');
    expect(body.therapists[0].relevance).toBe(1);
    expect(body.therapists[1].relevance).toBe(0);
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
    expect(therapist?.reviewStatus).toBe('PENDING_REVIEW');
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
    expect(link?.status).toBe('PROPOSED');
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

    // 6. Nach Freigabe: in Suche sichtbar
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
