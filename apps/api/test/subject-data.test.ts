import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';
import { hashPassword } from '../src/routes/auth-utils.js';

process.env.DATABASE_URL ??= 'file:./prisma/test.db';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

afterEach(async () => {
  await prisma.userFavoriteTherapist.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.therapist.deleteMany();
});

describe('GET /auth/me/export (DSGVO Art. 15/20, DS-40)', () => {
  it('exportiert alle Patientendaten, ohne Geheimnisse', { timeout: 30000 }, async () => {
    const token = 'sess-export-patient-xyz';
    const user = await prisma.user.create({
      data: {
        email: 'export-test@example.de',
        role: 'patient',
        firstName: 'Ex',
        lastName: 'Port',
        passwordHash: await hashPassword('pw'),
        sessionToken: token,
      },
    });
    const therapist = await prisma.therapist.create({
      data: {
        email: 'th-export@example.de',
        fullName: 'Th Export',
        professionalTitle: 'Physiotherapeut',
        city: 'Köln',
        specializations: 'Rücken',
        languages: 'de',
      },
    });
    await prisma.userFavoriteTherapist.create({ data: { userId: user.id, therapistId: therapist.id } });
    await prisma.notification.create({ data: { userId: user.id, type: 'TEST', message: 'Hallo' } });

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.subjectType).toBe('patient');
    expect(body.account.email).toBe('export-test@example.de');
    expect(body.data.favorites).toHaveLength(1);
    expect(body.data.notifications).toHaveLength(1);

    // DS-40 / P3: keine Geheimnisse im Export
    const raw = res.body;
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('sessionToken');
    expect(raw).not.toContain(token);
  });

  it('exportiert Therapeutendaten inkl. Profil', { timeout: 30000 }, async () => {
    const token = 'sess-export-therapist-xyz';
    await prisma.therapist.create({
      data: {
        email: 'therapist-export@example.de',
        fullName: 'Doc Export',
        professionalTitle: 'Physiotherapeut',
        city: 'Bonn',
        specializations: 'Sport',
        languages: 'de',
        sessionToken: token,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me/export',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.subjectType).toBe('therapist');
    expect(body.therapistProfile.fullName).toBe('Doc Export');
    expect(res.body).not.toContain('sessionToken');
    expect(res.body).not.toContain(token);
  });

  it('lehnt den Export ohne Token ab (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me/export' });
    expect(res.statusCode).toBe(401);
  });
});
