# Kurs-Feature — Vollständige Sicherung zur Wiederherstellung

> Erstellt: 2026-07-21. Diese Datei sichert das komplette Kurs-Feature vor dem Löschen,
> damit es später erneut implementiert werden kann.

## Wichtigste Wiederherstellungsquelle: Git

Der komplette, lauffähige Kurs-Code existiert im Git-Verlauf beim Commit:

```
71648a3b433e16f72f813eee9edca2c31c440a8b
```

**Schnellste Wiederherstellung** (holt alle dedizierten Dateien + Migrationen zurück):

```sh
SHA=71648a3b433e16f72f813eee9edca2c31c440a8b
git checkout $SHA -- "apps/api/src/routes/courses.ts"
git checkout $SHA -- "apps/api/src/routes/courses-public.ts"
git checkout $SHA -- "apps/api/src/routes/courses-enrollment.ts"
git checkout $SHA -- "apps/api/src/routes/admin-courses.ts"
git checkout $SHA -- "apps/api/src/utils/course-assertions.ts"
git checkout $SHA -- "apps/api/src/utils/course-feature-gate.ts"
git checkout $SHA -- "apps/admin/app/(admin)/courses/page.tsx"
git checkout $SHA -- "apps/admin/app/(admin)/courses/[id]/page.tsx"
git checkout $SHA -- "apps/mobile/src/components/CourseCard.js"
git checkout $SHA -- "apps/mobile/src/screens/courses/CourseOverviewScreen.js"
git checkout $SHA -- "apps/mobile/src/screens/courses/CourseListScreen.js"
git checkout $SHA -- "apps/mobile/src/screens/courses/CourseDetailScreen.js"
git checkout $SHA -- "apps/mobile/src/screens/courses/TherapistCoursesScreen.js"
git checkout $SHA -- "apps/mobile/src/screens/courses/TherapistCourseCreateScreen.js"
git checkout $SHA -- "apps/api/test/courses.test.ts"
git checkout $SHA -- "apps/api/prisma/migrations/20260709000000_add_course_extension/migration.sql"
git checkout $SHA -- "apps/api/prisma/migrations/20260711000000_seed_course_categories/migration.sql"
```

Danach die **Integrationspunkte** in den geteilten Dateien wieder einfügen
(siehe Abschnitt "Integrationspunkte" unten) und in Prisma die Modelle + Relationen
ergänzen (Abschnitt "Prisma"). Zum Schluss: `pnpm --filter @revio/api prisma generate`,
Migration prüfen, `pnpm build`, Tests.

## Architektur-Überblick

- **Datenmodell (Prisma):** CourseCategory, Course (Template, Owner = Therapeut ODER Praxis),
  CourseRun (Durchlauf mit Kapazität/Warteliste/Preis/Status), CourseSession (Einzeltermine),
  CourseEnrollment (gastbasiert, Double-Opt-In). Enums: CourseLocationType, CourseRunStatus,
  CourseEnrollmentStatus.
- **API:** courses.ts (Anbieter-CRUD), courses-public.ts (öffentlich, gegated),
  courses-enrollment.ts (Anmeldung/Opt-In/Storno), admin-courses.ts (Review/Eignung).
  Feature-Gate über course-feature-gate.ts (AppSetting COURSES_ENABLED, 404 wenn aus).
  4 Kurs-Mails in mailer.ts.
- **Admin:** /courses Liste + /courses/[id] Detail, Toggle in Settings.
- **Mobile:** 5 Screens (CourseOverview/List/Detail, TherapistCourses/Create) + CourseCard,
  Discover-Integration (Kurs-Chip, isCourseMode), gegated über coursesEnabled.
- **Seed:** 6 Kategorien (§20 SGB V Handlungsfelder).
- **Status bei Sicherung:** In Produktion per Toggle DEAKTIVIERT (/courses → 404).

## Prisma — Modelle, Enums, Relationen

### Relationen auf bestehende Modelle (wieder einfügen)

In `model Therapist`:

```prisma
  courses               Course[]               @relation("TherapistCourses")
```

In `model Practice`:

```prisma
  courses           Course[]              @relation("PracticeCourses")
```

### Enums + Modelle (aus schema.prisma, Zeilen 709–882)

```prisma
enum CourseLocationType {
  ONSITE
  ONLINE
  HYBRID
}

// DRAFT/PUBLISHED/PAUSED sind reversibel.
// CANCELLED ist terminal — ein abgesagter Run kann nicht re-publiziert werden.
enum CourseRunStatus {
  DRAFT
  PUBLISHED
  PAUSED
  CANCELLED
}

enum CourseEnrollmentStatus {
  EMAIL_UNCONFIRMED // Double-Opt-In: E-Mail noch nicht bestätigt
  PENDING           // E-Mail bestätigt, wartet auf Anbieter-Entscheid
  CONFIRMED
  DECLINED
  CANCELLED         // Nutzer:in oder Anbieter hat storniert
  WAITLISTED
}

// Kurs-Kategorien (Seed-Daten, §20 SGB V Handlungsfelder).
// Nicht vom Anbieter editierbar.
model CourseCategory {
  id        String   @id @default(cuid())
  key       String   @unique
  label     String   @unique
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  courses   Course[]
}

// Kurs-Template — einmalig vom Anbieter erstellt, einmalig admin-geprüft.
// Mehrere CourseRun-Instanzen (Durchläufe) können ohne erneute Review erstellt werden.
model Course {
  id          String  @id @default(cuid())

  // Eigentümer: genau einer gesetzt — assertExactlyOneOwner() an jeder Create-Route
  therapistId String?
  therapist   Therapist? @relation("TherapistCourses", fields: [therapistId], references: [id], onDelete: Cascade)
  practiceId  String?
  practice    Practice?  @relation("PracticeCourses", fields: [practiceId], references: [id], onDelete: Cascade)

  categoryKey String
  category    CourseCategory @relation(fields: [categoryKey], references: [key])

  title              String
  description        String
  targetAudience     String?
  prerequisites      String?
  instructorName     String
  instructorBio      String?
  contactInfo        String?
  cancellationPolicy String?
  locationType       CourseLocationType

  // ZPP-Nachweis: Anbieter lädt hoch, Admin prüft
  zppDocUrl String?

  // Ausschließlich admin-setzbar.
  // Service-Assert: healthInsuranceEligible=true erfordert zppVerified=true.
  healthInsuranceEligible Boolean @default(false)
  zppVerified             Boolean @default(false)

  reviewStatus ReviewStatus @default(DRAFT)
  adminNote    String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  runs CourseRun[]

  @@index([therapistId, reviewStatus])
  @@index([practiceId, reviewStatus])
  @@index([categoryKey, reviewStatus])
}

// Konkreter Durchlauf eines Kurs-Templates mit eigenen Terminen und Kapazität.
model CourseRun {
  id       String @id @default(cuid())
  courseId String
  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  // Unterscheidungslabel für parallele Runs: "Montag-Gruppe", "Herbst 2026"
  label String?

  status CourseRunStatus @default(DRAFT)

  // Standort (überschreibt oder ergänzt Course-Angaben)
  address   String?
  city      String?
  onlineUrl String?

  // Kapazität
  maxParticipants Int
  minParticipants Int?     // Informativ — kein automatischer Absage-Trigger im MVP
  waitlistEnabled Boolean  @default(false)
  waitlistMax     Int?     // wenn gesetzt: muss >= 1 sein (API-Validierung)

  bookingDeadline DateTime?

  priceAmount   Int?   // in Cent, null = kostenlos
  priceCurrency String @default("EUR")

  // Terminal-Status-Felder
  cancelledAt  DateTime?
  cancelReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessions    CourseSession[]
  enrollments CourseEnrollment[]

  @@index([courseId, status])
}

// Einzeltermin innerhalb eines CourseRun.
model CourseSession {
  id          String    @id @default(cuid())
  courseRunId String
  courseRun   CourseRun @relation(fields: [courseRunId], references: [id], onDelete: Cascade)

  startsAt DateTime
  endsAt   DateTime // Validierung: endsAt > startsAt, keine Überlappung im selben Run
  location String?  // Session-spezifischer Standort-Override

  createdAt DateTime @default(now())

  @@index([courseRunId, startsAt])
}

// Kursanmeldung / Anfrage (Gast-basiert, kein FK auf User).
// onDelete fehlt bewusst (Prisma-Default = Restrict):
// CourseEnrollment verhindert Run-Löschung. Anbieter-Konto-Löschung
// erfolgt über Anonymisierung, nicht Cascade (s. Umsetzungsplan Entscheidung #15).
model CourseEnrollment {
  id          String    @id @default(cuid())
  courseRunId String
  courseRun   CourseRun @relation(fields: [courseRunId], references: [id])

  // Gast-Kontaktdaten — werden bei Anbieter-Konto-Löschung anonymisiert
  patientName  String
  patientEmail String?
  patientPhone String?
  message      String?

  status CourseEnrollmentStatus @default(EMAIL_UNCONFIRMED)

  // Stateful Zufallstoken (kryptografisch sicher, in DB gespeichert)
  confirmToken String? @unique // null nach Bestätigung
  cancelToken  String  @unique // Gültigkeit = cancelTokenExpiresAt

  // Ablaufdatum des Storno-Links: wird auf (letzte Session startsAt + 7 Tage) gesetzt
  cancelTokenExpiresAt DateTime?

  declineReason    String?
  cancelledBy      String?   // "PARTICIPANT" | "PROVIDER"
  cancelledAt      DateTime?
  confirmedEmailAt DateTime? // Zeitpunkt des Double-Opt-In

  consentAcceptedAt DateTime

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Verhindert Doppel-Anmeldung; Re-Enrollment via Upsert (patientEmail nullable für Anonymisierung)
  @@index([courseRunId, status])
  @@index([patientEmail])
```

## Prisma-Migrationen

### `apps/api/prisma/migrations/20260709000000_add_course_extension/migration.sql`

```sql
-- Kurs-Erweiterung: CourseCategory, Course, CourseRun, CourseSession, CourseEnrollment
-- + Reverse-Relationen auf Therapist und Practice (keine Schema-Änderung, nur FK-Sicht)

-- CourseCategory (Seed-Daten werden separat via Seed-Script befüllt)
CREATE TABLE "CourseCategory" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "key"       TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CourseCategory_key_key"   ON "CourseCategory"("key");
CREATE UNIQUE INDEX "CourseCategory_label_key" ON "CourseCategory"("label");

-- Course (Template)
CREATE TABLE "Course" (
    "id"                      TEXT NOT NULL PRIMARY KEY,
    "therapistId"             TEXT,
    "practiceId"              TEXT,
    "categoryKey"             TEXT NOT NULL,
    "title"                   TEXT NOT NULL,
    "description"             TEXT NOT NULL,
    "targetAudience"          TEXT,
    "prerequisites"           TEXT,
    "instructorName"          TEXT NOT NULL,
    "instructorBio"           TEXT,
    "contactInfo"             TEXT,
    "cancellationPolicy"      TEXT,
    "locationType"            TEXT NOT NULL,
    "zppDocUrl"               TEXT,
    "healthInsuranceEligible" BOOLEAN NOT NULL DEFAULT false,
    "zppVerified"             BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus"            TEXT NOT NULL DEFAULT 'DRAFT',
    "adminNote"               TEXT,
    "createdAt"               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               DATETIME NOT NULL,
    CONSTRAINT "Course_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Course_practiceId_fkey"  FOREIGN KEY ("practiceId")  REFERENCES "Practice"  ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Course_categoryKey_fkey" FOREIGN KEY ("categoryKey") REFERENCES "CourseCategory" ("key") ON UPDATE CASCADE
);
CREATE INDEX "Course_therapistId_reviewStatus_idx" ON "Course"("therapistId", "reviewStatus");
CREATE INDEX "Course_practiceId_reviewStatus_idx"  ON "Course"("practiceId",  "reviewStatus");
CREATE INDEX "Course_categoryKey_reviewStatus_idx" ON "Course"("categoryKey", "reviewStatus");

-- CourseRun (konkreter Durchlauf)
CREATE TABLE "CourseRun" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "courseId"        TEXT NOT NULL,
    "label"           TEXT,
    "status"          TEXT NOT NULL DEFAULT 'DRAFT',
    "address"         TEXT,
    "city"            TEXT,
    "onlineUrl"       TEXT,
    "maxParticipants" INTEGER NOT NULL,
    "minParticipants" INTEGER,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "waitlistMax"     INTEGER,
    "bookingDeadline" DATETIME,
    "priceAmount"     INTEGER,
    "priceCurrency"   TEXT NOT NULL DEFAULT 'EUR',
    "cancelledAt"     DATETIME,
    "cancelReason"    TEXT,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL,
    CONSTRAINT "CourseRun_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CourseRun_courseId_status_idx" ON "CourseRun"("courseId", "status");

-- CourseSession (Einzeltermine)
CREATE TABLE "CourseSession" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "courseRunId" TEXT NOT NULL,
    "startsAt"    DATETIME NOT NULL,
    "endsAt"      DATETIME NOT NULL,
    "location"    TEXT,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseSession_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "CourseRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CourseSession_courseRunId_startsAt_idx" ON "CourseSession"("courseRunId", "startsAt");

-- CourseEnrollment (Gast-Anmeldung mit Double-Opt-In)
CREATE TABLE "CourseEnrollment" (
    "id"                   TEXT NOT NULL PRIMARY KEY,
    "courseRunId"          TEXT NOT NULL,
    "patientName"          TEXT NOT NULL,
    "patientEmail"         TEXT,
    "patientPhone"         TEXT,
    "message"              TEXT,
    "status"               TEXT NOT NULL DEFAULT 'EMAIL_UNCONFIRMED',
    "confirmToken"         TEXT,
    "cancelToken"          TEXT NOT NULL,
    "cancelTokenExpiresAt" DATETIME,
    "declineReason"        TEXT,
    "cancelledBy"          TEXT,
    "cancelledAt"          DATETIME,
    "confirmedEmailAt"     DATETIME,
    "consentAcceptedAt"    DATETIME NOT NULL,
    "createdAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            DATETIME NOT NULL,
    CONSTRAINT "CourseEnrollment_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "CourseRun" ("id") ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CourseEnrollment_confirmToken_key" ON "CourseEnrollment"("confirmToken");
CREATE UNIQUE INDEX "CourseEnrollment_cancelToken_key"  ON "CourseEnrollment"("cancelToken");
CREATE INDEX "CourseEnrollment_courseRunId_status_idx"  ON "CourseEnrollment"("courseRunId", "status");
CREATE INDEX "CourseEnrollment_patientEmail_idx"        ON "CourseEnrollment"("patientEmail");
CREATE INDEX "CourseEnrollment_confirmToken_idx"        ON "CourseEnrollment"("confirmToken");
CREATE INDEX "CourseEnrollment_cancelToken_idx"         ON "CourseEnrollment"("cancelToken");

-- PostgreSQL-Variante (Production): Advisory-Lock-fähiger Index für Kapazitätscheck
-- CREATE INDEX CONCURRENTLY "CourseEnrollment_courseRunId_status_confirmed_idx"
--   ON "CourseEnrollment"("courseRunId") WHERE status = 'CONFIRMED';

```

### `apps/api/prisma/migrations/20260711000000_seed_course_categories/migration.sql`

```sql
-- CourseCategory-Seed (§20 SGB V Handlungsfelder)
-- Stellt sicher dass die Kategorien in der DB vorhanden sind, auch wenn der
-- Seed-Script nach der initialen Migration nicht ausgeführt wurde.

INSERT INTO "CourseCategory" ("id", "key", "label", "sortOrder", "isActive", "createdAt")
VALUES
  (gen_random_uuid()::text, 'bewegung',    'Bewegungsgesundheit', 1, true, NOW()),
  (gen_random_uuid()::text, 'ernaehrung',  'Ernährung',           2, true, NOW()),
  (gen_random_uuid()::text, 'stress',      'Stressbewältigung',   3, true, NOW()),
  (gen_random_uuid()::text, 'entspannung', 'Entspannung',         4, true, NOW()),
  (gen_random_uuid()::text, 'sucht',       'Suchtmittelkonsum',   5, true, NOW()),
  (gen_random_uuid()::text, 'sonstiges',   'Sonstiges',           6, true, NOW())
ON CONFLICT ("key") DO UPDATE SET
  "label"     = EXCLUDED."label",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive"  = EXCLUDED."isActive";

```

## Dedizierte Kurs-Dateien (vollständig)

### `apps/api/src/routes/courses.ts`

```ts
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

```

### `apps/api/src/routes/courses-public.ts`

```ts
import { FastifyInstance } from 'fastify';
import { ReviewStatus, CourseRunStatus, CourseLocationType } from '@prisma/client';

export async function publicCourseRoutes(fastify: FastifyInstance) {

  // ── Kurssuche ──────────────────────────────────────────────────────────────
  // GET /courses?q=yoga&categoryKey=bewegung&city=Berlin&locationType=ONSITE&page=1&limit=20

  fastify.get('/courses', async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '20', 10)));

    const where: any = {
      reviewStatus: ReviewStatus.APPROVED,
      ...(q.categoryKey ? { categoryKey: q.categoryKey } : {}),
      ...(q.locationType ? { locationType: q.locationType as CourseLocationType } : {}),
      ...(q.q ? { title: { contains: q.q } } : {}),
      runs: {
        some: {
          status: CourseRunStatus.PUBLISHED,
          ...(q.city ? { city: { contains: q.city } } : {}),
        },
      },
    };

    const [courses, total] = await Promise.all([
      fastify.prisma.course.findMany({
        where,
        include: {
          category: { select: { key: true, label: true } },
          therapist: { select: { id: true, fullName: true, city: true, photo: true } },
          practice: { select: { id: true, name: true, city: true, logo: true } },
          runs: {
            where: { status: CourseRunStatus.PUBLISHED },
            include: {
              sessions: { orderBy: { startsAt: 'asc' }, take: 1 },
              _count: { select: { enrollments: { where: { status: 'CONFIRMED' } } } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      fastify.prisma.course.count({ where }),
    ]);

    // Kurse mit ausgebuchten Runs nach hinten schieben
    const sorted = [...courses].sort((a, b) => {
      const aFull = a.runs.every(r => r._count.enrollments >= r.maxParticipants);
      const bFull = b.runs.every(r => r._count.enrollments >= r.maxParticipants);
      if (aFull && !bFull) return 1;
      if (!aFull && bFull) return -1;
      return 0;
    });

    return reply.send({
      courses: sorted.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description.slice(0, 200),
        locationType: c.locationType,
        healthInsuranceEligible: c.healthInsuranceEligible,
        zppVerified: c.zppVerified,
        category: c.category,
        provider: c.therapist
          ? { type: 'therapist', id: c.therapist.id, name: c.therapist.fullName, city: c.therapist.city, photo: c.therapist.photo }
          : c.practice
          ? { type: 'practice', id: c.practice.id, name: c.practice.name, city: c.practice.city, photo: c.practice.logo }
          : null,
        runs: c.runs.map(r => ({
          id: r.id,
          label: r.label,
          status: r.status,
          city: r.city,
          maxParticipants: r.maxParticipants,
          confirmedCount: r._count.enrollments,
          available: r._count.enrollments < r.maxParticipants,
          waitlistEnabled: r.waitlistEnabled,
          bookingDeadline: r.bookingDeadline,
          priceAmount: r.priceAmount,
          priceCurrency: r.priceCurrency,
          nextSessionAt: r.sessions[0]?.startsAt ?? null,
        })),
      })),
      total,
      page,
      limit,
    });
  });

  // ── Kursdetail ─────────────────────────────────────────────────────────────
  // GET /courses/:id

  fastify.get('/courses/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const course = await fastify.prisma.course.findFirst({
      where: { id, reviewStatus: ReviewStatus.APPROVED },
      include: {
        category: true,
        therapist: { select: { id: true, fullName: true, bio: true, city: true, photo: true, specializations: true } },
        practice: { select: { id: true, name: true, description: true, city: true, address: true, phone: true, logo: true } },
        runs: {
          where: { status: { in: [CourseRunStatus.PUBLISHED, CourseRunStatus.PAUSED] } },
          include: {
            sessions: { orderBy: { startsAt: 'asc' } },
            _count: { select: { enrollments: { where: { status: 'CONFIRMED' } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!course) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    return reply.send({
      id: course.id,
      title: course.title,
      description: course.description,
      targetAudience: course.targetAudience,
      prerequisites: course.prerequisites,
      instructorName: course.instructorName,
      instructorBio: course.instructorBio,
      contactInfo: course.contactInfo,
      cancellationPolicy: course.cancellationPolicy,
      locationType: course.locationType,
      healthInsuranceEligible: course.healthInsuranceEligible,
      zppVerified: course.zppVerified,
      category: course.category,
      provider: course.therapist
        ? { type: 'therapist', ...course.therapist }
        : course.practice
        ? { type: 'practice', ...course.practice }
        : null,
      runs: course.runs.map(r => ({
        id: r.id,
        label: r.label,
        status: r.status,
        address: r.address,
        city: r.city,
        onlineUrl: r.onlineUrl,
        maxParticipants: r.maxParticipants,
        minParticipants: r.minParticipants,
        confirmedCount: r._count.enrollments,
        available: r._count.enrollments < r.maxParticipants,
        waitlistEnabled: r.waitlistEnabled,
        waitlistMax: r.waitlistMax,
        bookingDeadline: r.bookingDeadline,
        priceAmount: r.priceAmount,
        priceCurrency: r.priceCurrency,
        sessions: r.sessions.map(s => ({
          id: s.id,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          location: s.location,
        })),
      })),
    });
  });
}

```

### `apps/api/src/routes/courses-enrollment.ts`

```ts
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

```

### `apps/api/src/routes/admin-courses.ts`

```ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CourseRunStatus, ReviewStatus } from '@prisma/client';
import { assertEligibleConsistency, assertRunPublishable } from '../utils/course-assertions.js';

const reviewSchema = z.object({
  status: z.enum([
    ReviewStatus.APPROVED,
    ReviewStatus.REJECTED,
    ReviewStatus.CHANGES_REQUESTED,
    ReviewStatus.SUSPENDED,
  ]),
  adminNote: z.string().optional(),
});

const eligibilitySchema = z.object({
  healthInsuranceEligible: z.boolean(),
  zppVerified: z.boolean(),
  zppDocUrl: z.string().url().optional().nullable(),
});

export async function adminCourseRoutes(fastify: FastifyInstance) {

  // ── Pending Review Queue ───────────────────────────────────────────────────

  fastify.get('/admin/courses', {
    preHandler: fastify.verifyAdmin,
  }, async (request, reply) => {
    const query = (request.query as any);
    const status = query.status as ReviewStatus | undefined;
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10)));

    const where = status ? { reviewStatus: status } : {};

    const [courses, total] = await Promise.all([
      fastify.prisma.course.findMany({
        where,
        include: {
          category: { select: { key: true, label: true } },
          therapist: { select: { id: true, fullName: true, email: true, city: true } },
          practice: { select: { id: true, name: true, city: true } },
          runs: { select: { id: true, status: true }, take: 5 },
        },
        orderBy: { updatedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      fastify.prisma.course.count({ where }),
    ]);

    return reply.send({ courses, total, page, limit });
  });

  fastify.get('/admin/courses/:id', {
    preHandler: fastify.verifyAdmin,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const course = await fastify.prisma.course.findUnique({
      where: { id },
      include: {
        category: true,
        therapist: { select: { id: true, fullName: true, email: true, city: true } },
        practice: { select: { id: true, name: true, city: true } },
        runs: {
          include: {
            sessions: { orderBy: { startsAt: 'asc' } },
            _count: { select: { enrollments: true } },
          },
        },
      },
    });
    if (!course) return reply.status(404).send({ error: 'Kurs nicht gefunden' });
    return reply.send(course);
  });

  // ── Review action ──────────────────────────────────────────────────────────

  fastify.patch('/admin/courses/:id/review', {
    preHandler: fastify.verifyAdmin,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const existing = await fastify.prisma.course.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    const { status, adminNote } = parsed.data;

    const updated = await fastify.prisma.course.update({
      where: { id },
      data: { reviewStatus: status, adminNote: adminNote ?? null },
    });

    // Bei Freigabe: bereits vom Therapeuten angelegte Durchläufe (Status DRAFT,
    // im Wizard vor der Einreichung erstellt) automatisch veröffentlichen, damit
    // der Kurs ohne zusätzlichen manuellen Schritt öffentlich sichtbar wird.
    if (status === ReviewStatus.APPROVED) {
      const draftRuns = await fastify.prisma.courseRun.findMany({
        where: { courseId: id, status: CourseRunStatus.DRAFT },
        include: { _count: { select: { sessions: true } } },
      });
      for (const run of draftRuns) {
        try {
          assertRunPublishable({
            courseReviewStatus: updated.reviewStatus,
            sessionCount: run._count.sessions,
            maxParticipants: run.maxParticipants,
          });
          await fastify.prisma.courseRun.update({
            where: { id: run.id },
            data: { status: CourseRunStatus.PUBLISHED },
          });
        } catch {
          // Durchlauf erfüllt Veröffentlichungsvoraussetzungen (noch) nicht
          // (z. B. keine Termine) – bleibt DRAFT, Therapeut kann später selbst veröffentlichen.
        }
      }
    }

    return reply.send(updated);
  });

  // ── Health-insurance eligibility (admin-exclusive write) ───────────────────

  fastify.patch('/admin/courses/:id/eligibility', {
    preHandler: fastify.verifyAdmin,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = eligibilitySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    assertEligibleConsistency({
      healthInsuranceEligible: parsed.data.healthInsuranceEligible,
      zppVerified: parsed.data.zppVerified,
    });

    const existing = await fastify.prisma.course.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    const updated = await fastify.prisma.course.update({
      where: { id },
      data: {
        healthInsuranceEligible: parsed.data.healthInsuranceEligible,
        zppVerified: parsed.data.zppVerified,
        zppDocUrl: parsed.data.zppDocUrl ?? null,
      },
    });
    return reply.send(updated);
  });

  // ── Enrollment overview (admin) ────────────────────────────────────────────

  fastify.get('/admin/courses/:courseId/runs/:runId/enrollments', {
    preHandler: fastify.verifyAdmin,
  }, async (request, reply) => {
    const { courseId, runId } = request.params as { courseId: string; runId: string };
    const run = await fastify.prisma.courseRun.findFirst({ where: { id: runId, courseId } });
    if (!run) return reply.status(404).send({ error: 'Durchlauf nicht gefunden' });

    const enrollments = await fastify.prisma.courseEnrollment.findMany({
      where: { courseRunId: runId },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(enrollments);
  });
}

```

### `apps/api/src/utils/course-assertions.ts`

```ts
import { CourseRunStatus, ReviewStatus } from '@prisma/client';

export function assertExactlyOneOwner(opts: {
  therapistId?: string | null;
  practiceId?: string | null;
}): void {
  const set = [opts.therapistId, opts.practiceId].filter(Boolean);
  if (set.length !== 1) {
    throw new Error(
      'Ein Kurs muss genau einem Anbieter gehören (entweder therapistId oder practiceId).',
    );
  }
}

export function assertRunPublishable(opts: {
  courseReviewStatus: ReviewStatus;
  sessionCount: number;
  maxParticipants: number;
}): void {
  if (opts.courseReviewStatus !== ReviewStatus.APPROVED) {
    throw new Error(
      'Ein Kursdurchlauf kann nur veröffentlicht werden, wenn der Kurs freigegeben ist.',
    );
  }
  if (opts.sessionCount < 1) {
    throw new Error(
      'Ein Kursdurchlauf muss mindestens einen Termin haben, bevor er veröffentlicht wird.',
    );
  }
  if (opts.maxParticipants < 1) {
    throw new Error('maxParticipants muss mindestens 1 sein.');
  }
}

export function assertEligibleConsistency(opts: {
  healthInsuranceEligible: boolean;
  zppVerified: boolean;
}): void {
  if (opts.zppVerified && !opts.healthInsuranceEligible) {
    throw new Error(
      'zppVerified kann nur true sein, wenn healthInsuranceEligible ebenfalls true ist.',
    );
  }
}

export const TERMINAL_RUN_STATUSES: CourseRunStatus[] = [CourseRunStatus.CANCELLED];

export function assertRunNotTerminal(status: CourseRunStatus): void {
  if (TERMINAL_RUN_STATUSES.includes(status)) {
    throw new Error('Ein abgesagter Kursdurchlauf kann nicht mehr verändert werden.');
  }
}

```

### `apps/api/src/utils/course-feature-gate.ts`

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getBooleanAppSetting, COURSES_ENABLED_KEY } from './app-settings.js';

// Kurz gecachter Lesezugriff, damit nicht jeder Kurs-Request einen DB-Treffer
// auf AppSetting erzeugt. Der Admin-Toggle invalidiert den Cache sofort
// (invalidateCoursesEnabledCache), sodass das Abschalten ohne Verzögerung greift.
const TTL_MS = 30_000;
let cache: { value: boolean; at: number } | null = null;

type PrismaLike = Parameters<typeof getBooleanAppSetting>[0];

export async function areCoursesEnabled(prisma: PrismaLike): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;
  const value = await getBooleanAppSetting(prisma, COURSES_ENABLED_KEY, true);
  cache = { value, at: now };
  return value;
}

export function invalidateCoursesEnabledCache(): void {
  cache = null;
}

// onRequest-Hook für die öffentlichen + Provider-Kursrouten. Ist das Feature
// plattformweit deaktiviert, existiert der Endpunkt für Clients faktisch nicht
// mehr (404) — auch für direkte API-Aufrufe und gecachte Deep-Links.
// Die Admin-Kursrouten werden bewusst NICHT gegated, damit bestehende Kurse
// nach dem Abschalten weiter eingesehen und aufgeräumt werden können.
export async function courseFeatureGate(request: FastifyRequest, reply: FastifyReply) {
  const enabled = await areCoursesEnabled(request.server.prisma);
  if (!enabled) {
    return reply.status(404).send({ error: 'Funktion nicht verfügbar' });
  }
}

```

### `apps/admin/app/(admin)/courses/page.tsx`

```ts
import Link from 'next/link';
import { PageShell } from '../../../components/page-shell';
import { CourseActions } from '../../../components/action-buttons';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminSectionCard } from '../../../components/admin-section-card';
import { AdminStatusBadge } from '../../../components/admin-status-badge';
import { AdminSummaryCard } from '../../../components/admin-summary-card';
import { AdminToolbar } from '../../../components/admin-toolbar';
import { api } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import {
  approveCourse,
  rejectCourse,
  requestChangesCourse,
  suspendCourse,
} from '../../../lib/actions';

type SearchParams = Promise<{ status?: string; q?: string }>;

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { courses } = await api.getAdminCourses();

  const statusFilter = params.status ?? 'ALL';
  const q = (params.q ?? '').toLowerCase();

  const filtered = courses
    .filter((course) => {
      const matchesStatus = statusFilter === 'ALL' || course.reviewStatus === statusFilter;
      const matchesQuery = !q || [course.title, course.therapist?.fullName, course.practice?.name, course.category?.label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
      return matchesStatus && matchesQuery;
    })
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  const pendingCount = filtered.filter((c) => c.reviewStatus === 'PENDING_REVIEW').length;
  const changesCount = filtered.filter((c) => c.reviewStatus === 'CHANGES_REQUESTED').length;
  const approvedCount = filtered.filter((c) => c.reviewStatus === 'APPROVED').length;
  const activeFilters = [params.q, statusFilter !== 'ALL' ? statusFilter : ''].filter(Boolean).length;

  return (
    <PageShell
      title="Gesundheitskurse"
      description="Von Therapeuten eingereichte Kurse prüfen und freigeben."
      eyebrow="Reviews"
      actions={<div className="hero-pill">{filtered.length} Kurse in der Ansicht</div>}
    >
      <div className="review-summary-grid">
        <AdminSummaryCard
          kicker="Offen"
          value={pendingCount}
          label="Warten auf Review"
          href="/courses?status=PENDING_REVIEW"
        />
        <AdminSummaryCard
          kicker="Rückfragen"
          value={changesCount}
          label="Änderungen angefragt"
          tone="warning"
          href="/courses?status=CHANGES_REQUESTED"
        />
        <AdminSummaryCard
          kicker="Freigegeben"
          value={approvedCount}
          label="Öffentlich sichtbar"
          tone="success"
          href="/courses?status=APPROVED"
        />
      </div>

      <AdminSectionCard
        eyebrow="Filter"
        title="Kurse eingrenzen"
        description="Suche nach Titel, Kategorie oder Anbieter."
        actions={activeFilters > 0 ? <Link href="/courses" className="secondary-btn secondary-btn--compact">Filter zurücksetzen</Link> : null}
      >
        <AdminToolbar>
          <form className="toolbar" action="/courses">
            <input name="q" defaultValue={params.q ?? ''} className="toolbar-input" placeholder="Titel, Kategorie oder Anbieter" />
            <select name="status" defaultValue={statusFilter} className="toolbar-select">
              <option value="ALL">Alle Status</option>
              <option value="PENDING_REVIEW">Ausstehend</option>
              <option value="APPROVED">Freigegeben</option>
              <option value="CHANGES_REQUESTED">Änderungen</option>
              <option value="REJECTED">Abgelehnt</option>
              <option value="SUSPENDED">Gesperrt</option>
              <option value="DRAFT">Entwurf</option>
            </select>
            <button className="primary-btn" type="submit">Anwenden</button>
          </form>
        </AdminToolbar>
      </AdminSectionCard>

      {filtered.length === 0 ? (
        <AdminEmptyState
          icon="📚"
          title="Keine Kurse für diese Filter"
          description="Versuche einen anderen Status oder entferne den Suchbegriff."
          compact
          action={<Link href="/courses" className="secondary-btn secondary-btn--compact">Alle Kurse anzeigen</Link>}
        />
      ) : (
        <AdminSectionCard
          eyebrow="Queue"
          title="Kurs-Arbeitsliste"
          description="Sortiert nach zuletzt aktualisiert – am längsten unbearbeitete Kurse zuerst."
          actions={<div className="hero-pill">{activeFilters > 0 ? `${activeFilters} aktive Filter` : 'Keine aktiven Filter'}</div>}
        >
          <table className="table table--elevated focus-table">
            <thead>
              <tr>
                <th>Kurs</th>
                <th>Anbieter</th>
                <th>Status</th>
                <th>Durchläufe</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((course) => {
                const publishedRuns = course.runs.filter((r) => r.status === 'PUBLISHED').length;
                return (
                  <tr key={course.id}>
                    <td data-label="Kurs">
                      <div className="entity-block">
                        <Link href={`/courses/${course.id}`} className="entity-link">
                          {course.title}
                        </Link>
                        <div className="entity-meta">{course.category?.label ?? course.category?.key ?? '—'}</div>
                      </div>
                    </td>
                    <td data-label="Anbieter">
                      <div className="entity-block">
                        <span className="table-strong">{course.therapist?.fullName ?? course.practice?.name ?? '—'}</span>
                        <div className="entity-meta">{course.therapist?.email ?? course.practice?.city ?? ''}</div>
                      </div>
                    </td>
                    <td data-label="Status">
                      <div className="priority-stack">
                        <AdminStatusBadge status={course.reviewStatus} />
                        <span className="entity-meta">Aktualisiert {formatDate(course.updatedAt)}</span>
                      </div>
                    </td>
                    <td data-label="Durchläufe">
                      <span className="entity-meta">
                        {course.runs.length === 0
                          ? 'Noch kein Durchlauf'
                          : `${course.runs.length} gesamt · ${publishedRuns} veröffentlicht`}
                      </span>
                    </td>
                    <td data-label="Aktionen">
                      <CourseActions
                        id={course.id}
                        status={course.reviewStatus}
                        actions={{
                          approve: approveCourse,
                          reject: rejectCourse,
                          requestChanges: requestChangesCourse,
                          suspend: suspendCourse,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminSectionCard>
      )}
    </PageShell>
  );
}

```

### `apps/admin/app/(admin)/courses/[id]/page.tsx`

```ts
import Link from 'next/link';
import { PageShell } from '../../../../components/page-shell';
import { CourseActions } from '../../../../components/action-buttons';
import { AdminSectionCard } from '../../../../components/admin-section-card';
import { api } from '../../../../lib/api';
import { formatDateTime } from '../../../../lib/format';
import { humanizeReviewStatus } from '../../../../lib/review-status';
import {
  approveCourse,
  rejectCourse,
  requestChangesCourse,
  suspendCourse,
} from '../../../../lib/actions';

type Props = {
  params: Promise<{ id: string }>;
};

const runStatusLabel: Record<string, string> = {
  DRAFT: 'Entwurf',
  PUBLISHED: 'Veröffentlicht',
  PAUSED: 'Pausiert',
  CANCELLED: 'Abgesagt',
};

export default async function CourseDetailPage({ params }: Props) {
  const { id } = await params;
  const course = await api.getAdminCourse(id);

  const reviewCopy: Record<string, string> = {
    DRAFT: 'Der Therapeut hat den Kurs noch nicht eingereicht.',
    PENDING_REVIEW: 'Wartet aktuell auf Prüfung.',
    APPROVED: 'Freigegeben. Durchläufe mit Terminen sind öffentlich sichtbar.',
    REJECTED: 'Abgelehnt.',
    CHANGES_REQUESTED: 'Der Therapeut wurde um Änderungen gebeten.',
    SUSPENDED: 'Gesperrt – aktuell nicht öffentlich sichtbar.',
  };

  return (
    <PageShell
      title={course.title}
      description={`${course.category?.label ?? course.category?.key ?? '—'} · ${course.therapist?.fullName ?? course.practice?.name ?? '—'}`}
      eyebrow={<Link href="/courses" className="page-back-link">← Zurück zur Liste</Link>}
      actions={
        <span className={`badge badge--${course.reviewStatus}`}>
          {humanizeReviewStatus(course.reviewStatus)}
        </span>
      }
    >
      <section className="card-grid" style={{ marginBottom: 24 }}>
        <article className="card">
          <div className="kicker">Review</div>
          <div className={`badge badge--${course.reviewStatus}`} style={{ width: 'fit-content', marginTop: 8 }}>
            {humanizeReviewStatus(course.reviewStatus)}
          </div>
          <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            {reviewCopy[course.reviewStatus] ?? ''}
          </p>
          {course.adminNote && (
            <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              Notiz: {course.adminNote}
            </p>
          )}
        </article>

        <article className="card">
          <div className="kicker">Anbieter</div>
          <p style={{ margin: '8px 0 0', fontWeight: 600 }}>
            {course.therapist?.fullName ?? course.practice?.name ?? '—'}
          </p>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            {course.therapist?.email ?? course.practice?.city ?? ''}
          </p>
        </article>

        <article className="card">
          <div className="kicker">Zeitpunkte</div>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Erstellt {formatDateTime(course.createdAt)}
          </p>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Aktualisiert {formatDateTime(course.updatedAt)}
          </p>
        </article>
      </section>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Review-Entscheidung
        </div>
        <CourseActions
          id={course.id}
          status={course.reviewStatus}
          actions={{
            approve: approveCourse,
            reject: rejectCourse,
            requestChanges: requestChangesCourse,
            suspend: suspendCourse,
          }}
        />
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 32 }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="kicker" style={{ marginBottom: 12 }}>Kursdetails</div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0 }}>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Format</dt>
            <dd style={{ margin: 0 }}>{course.locationType}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Kursleitung</dt>
            <dd style={{ margin: 0 }}>{course.instructorName}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Zielgruppe</dt>
            <dd style={{ margin: 0 }}>{course.targetAudience || '–'}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Voraussetzungen</dt>
            <dd style={{ margin: 0 }}>{course.prerequisites || '–'}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Krankenkasse</dt>
            <dd style={{ margin: 0 }}>{course.healthInsuranceEligible ? 'Ja' : 'Nein'}{course.zppVerified ? ' (ZPP geprüft)' : ''}</dd>
          </dl>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="kicker" style={{ marginBottom: 12 }}>Beschreibung</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{course.description}</p>
        </div>
      </section>

      <AdminSectionCard
        eyebrow="Durchläufe"
        title="Durchläufe & Termine"
        description="Nur Durchläufe mit mindestens einem Termin können veröffentlicht werden."
      >
        {course.runs.length === 0 ? (
          <p className="table-note">Noch kein Durchlauf angelegt.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {course.runs.map((run) => (
              <div key={run.id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <strong>{run.label || 'Ohne Bezeichnung'}</strong>
                  <span className={`badge badge--${run.status === 'PUBLISHED' ? 'APPROVED' : run.status === 'CANCELLED' ? 'REJECTED' : 'DRAFT'}`}>
                    {runStatusLabel[run.status] ?? run.status}
                  </span>
                </div>
                <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                  {run.city ? `${run.city} · ` : ''}Max. {run.maxParticipants} Teilnehmer
                  {run._count ? ` · ${run._count.enrollments} angemeldet` : ''}
                </p>
                {run.sessions && run.sessions.length > 0 ? (
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--muted)' }}>
                    {run.sessions.map((s) => (
                      <li key={s.id}>
                        {formatDateTime(s.startsAt)} – {new Date(s.endsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        {s.location ? ` · ${s.location}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--muted)' }}>Noch keine Termine.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminSectionCard>
    </PageShell>
  );
}

```

### `apps/mobile/src/components/CourseCard.js`

```js
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { RADIUS, SHADOW, SPACE, TYPE } from '../utils/app-utils';

export function formatNextDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatPrice(amount, currency) {
  if (!amount || Number(amount) === 0) return 'Kostenlos';
  return Number(amount).toLocaleString('de-DE', {
    style: 'currency',
    currency: currency ?? 'EUR',
    maximumFractionDigits: 0,
  });
}

export function CourseCard({ course, c, onPress }) {
  const cheapestRun = course.runs?.reduce((min, r) => {
    if (!min) return r;
    return Number(r.priceAmount ?? 0) < Number(min.priceAmount ?? 0) ? r : min;
  }, null);
  const nextDate = course.runs?.map((r) => r.nextSessionAt).filter(Boolean).sort()[0];
  const anyAvailable = course.runs?.some((r) => r.available);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: c.card,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: c.border,
          padding: SPACE.lg,
          gap: SPACE.sm,
          opacity: pressed ? 0.85 : 1,
        },
        SHADOW.card,
      ]}
    >
      {/* Kurs-Kennzeichnung: klar von Therapeuten-Karte abgegrenzt */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
        <View style={{ backgroundColor: c.accent, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={[TYPE.label, { color: '#FFFFFF', letterSpacing: 0.5 }]}>KURS</Text>
        </View>
        <View style={{ backgroundColor: c.primaryBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={[TYPE.label, { color: c.primary }]}>{course.category?.label ?? course.category?.key}</Text>
        </View>
        {course.healthInsuranceEligible && (
          <View style={{ backgroundColor: c.accentBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={[TYPE.label, { color: c.accent }]}>Krankenkasse</Text>
          </View>
        )}
      </View>

      <Text style={[TYPE.heading, { color: c.text }]} numberOfLines={2}>{course.title}</Text>

      {course.description ? (
        <Text style={[TYPE.body, { color: c.textMuted }]} numberOfLines={2}>{course.description}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.xs }}>
        <View style={{ gap: 2 }}>
          {course.provider?.name ? (
            <Text style={[TYPE.meta, { color: c.textMuted }]}>{course.provider.name}</Text>
          ) : null}
          {nextDate ? (
            <Text style={[TYPE.meta, { color: c.textMuted }]}>Ab {formatNextDate(nextDate)}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {cheapestRun ? (
            <Text style={[TYPE.heading, { color: c.primary }]}>
              {formatPrice(cheapestRun.priceAmount, cheapestRun.priceCurrency)}
            </Text>
          ) : null}
          <View style={{
            backgroundColor: anyAvailable ? c.successBg : c.mutedBg,
            borderRadius: RADIUS.full,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
            <Text style={[TYPE.label, { color: anyAvailable ? c.success : c.muted }]}>
              {anyAvailable ? 'Verfügbar' : 'Ausgebucht'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

```

### `apps/mobile/src/screens/courses/CourseOverviewScreen.js`

```js
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, RADIUS, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';
import { StatusBadge } from './TherapistCoursesScreen';

const LOCATION_TYPE_LABEL = {
  ONSITE: 'Vor Ort',
  ONLINE: 'Online',
  HYBRID: 'Hybrid',
};

const RUN_STATUS_LABEL = {
  DRAFT: 'Entwurf',
  PUBLISHED: 'Veröffentlicht',
  PAUSED: 'Pausiert',
  CANCELLED: 'Abgesagt',
};

function InfoRow({ label, value, c }) {
  if (!value) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={[TYPE.label, { color: c.textMuted }]}>{label}</Text>
      <Text style={[TYPE.body, { color: c.text }]}>{value}</Text>
    </View>
  );
}

function Section({ title, c, children }) {
  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, gap: SPACE.md }}>
      <Text style={[TYPE.heading, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CourseOverviewScreen({ authToken, c, courseId, onBack, onEdit }) {
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${getBaseUrl()}/courses/my/${courseId}`, {
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setCourse(data);
        }
      } catch (_) {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [courseId, authToken]);

  if (loading || !course) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: insets.top }}>
          <BackButton c={c} label="Meine Kurse" onPress={onBack} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      </View>
    );
  }

  const isDraftOrChanges = course.reviewStatus === 'DRAFT' || course.reviewStatus === 'CHANGES_REQUESTED';
  const isApproved = course.reviewStatus === 'APPROVED';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: SPACE.lg }}>
        <BackButton c={c} label="Meine Kurse" onPress={onBack} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingTop: 0, gap: SPACE.lg, paddingBottom: 120 }}>
        <View style={{ gap: SPACE.sm }}>
          <Text style={[TYPE.xl, { color: c.text }]}>{course.title}</Text>
          <StatusBadge status={course.reviewStatus} c={c} />
          {course.reviewStatus === 'PENDING_REVIEW' && (
            <Text style={[TYPE.meta, { color: c.warning, fontWeight: '600' }]}>Das Revio-Team prüft diesen Kurs gerade. Änderungen sind erst danach möglich.</Text>
          )}
          {course.reviewStatus === 'CHANGES_REQUESTED' && (
            <Text style={[TYPE.meta, { color: c.warning, fontWeight: '600' }]}>Admin hat Änderungen angefragt{course.adminNote ? `: ${course.adminNote}` : '.'}</Text>
          )}
          {course.reviewStatus === 'REJECTED' && (
            <Text style={[TYPE.meta, { color: c.error, fontWeight: '600' }]}>Abgelehnt{course.adminNote ? `: ${course.adminNote}` : '.'}</Text>
          )}
        </View>

        <Section title="Kursdetails" c={c}>
          <InfoRow label="Kategorie" value={course.category?.label ?? course.categoryKey} c={c} />
          <InfoRow label="Format" value={LOCATION_TYPE_LABEL[course.locationType] ?? course.locationType} c={c} />
          <InfoRow label="Kursleitung" value={course.instructorName} c={c} />
          <InfoRow label="Zielgruppe" value={course.targetAudience} c={c} />
          <InfoRow label="Beschreibung" value={course.description} c={c} />
        </Section>

        <Section title={`Durchläufe (${course.runs?.length ?? 0})`} c={c}>
          {(!course.runs || course.runs.length === 0) ? (
            <Text style={[TYPE.meta, { color: c.textMuted }]}>Noch kein Durchlauf angelegt.</Text>
          ) : (
            course.runs.map((run) => (
              <View
                key={run.id}
                style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: SPACE.md, gap: 6 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[TYPE.body, { color: c.text, fontWeight: '700' }]}>{run.label || 'Ohne Bezeichnung'}</Text>
                  <View style={{ backgroundColor: run.status === 'PUBLISHED' ? c.successBg : c.mutedBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={[TYPE.label, { color: run.status === 'PUBLISHED' ? c.success : c.muted }]}>
                      {RUN_STATUS_LABEL[run.status] ?? run.status}
                    </Text>
                  </View>
                </View>
                <Text style={[TYPE.meta, { color: c.textMuted }]}>
                  {run.city ? `${run.city} · ` : ''}Max. {run.maxParticipants} Teilnehmer
                  {run._count ? ` · ${run._count.enrollments} angemeldet` : ''}
                </Text>
                {run.sessions && run.sessions.length > 0 ? (
                  <View style={{ gap: 3, marginTop: 2 }}>
                    {run.sessions.map((s) => (
                      <Text key={s.id} style={[TYPE.meta, { color: c.textMuted }]}>
                        • {formatDateTime(s.startsAt)}{s.location ? ` · ${s.location}` : ''}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={[TYPE.meta, { color: c.textMuted }]}>Noch keine Termine.</Text>
                )}
              </View>
            ))
          )}
        </Section>
      </ScrollView>

      {(isDraftOrChanges || isApproved) && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACE.lg, paddingBottom: insets.bottom + SPACE.md, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
          <Pressable
            onPress={() => onEdit(course)}
            style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <Ionicons name={isApproved ? 'add-circle-outline' : 'create-outline'} size={18} color="#FFFFFF" />
            <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>
              {isApproved ? 'Durchlauf hinzufügen' : 'Bearbeiten'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

```

### `apps/mobile/src/screens/courses/CourseListScreen.js`

```js
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/use-theme';
import { getBaseUrl, RADIUS, SPACE, TUNNEL_HEADERS, TYPE, courseCategoryChips } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';
import { CourseCard } from '../../components/CourseCard';
import { ROOT_ROUTES } from '../../navigation/route-names';

const CATEGORY_CHIPS = courseCategoryChips;

export function CourseListScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const [categoryKey, setCategoryKey] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchCourses = useCallback(async (key, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (key) params.set('categoryKey', key);
      const res = await fetch(`${getBaseUrl()}/courses?${params}`, { headers: { ...TUNNEL_HEADERS } });
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (_) {
      // ignore network errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses(categoryKey);
  }, [categoryKey, fetchCourses]);

  const handleCategorySelect = (key) => {
    setCategoryKey(key);
  };

  const openDetail = (course) => {
    navigation.navigate(ROOT_ROUTES.COURSE_DETAIL, { courseId: course.id, courseTitle: course.title });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: SPACE.lg, backgroundColor: c.background }}>
        <BackButton c={c} label="Zurück" onPress={() => navigation.goBack()} />
        <Text style={[TYPE.xl, { color: c.text, marginBottom: SPACE.md }]}>Gesundheitskurse</Text>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: SPACE.sm, paddingBottom: SPACE.md }}
        >
          {CATEGORY_CHIPS.map((chip) => {
            const active = categoryKey === chip.key;
            return (
              <Pressable
                key={String(chip.key)}
                onPress={() => handleCategorySelect(chip.key)}
                style={{
                  borderWidth: 1,
                  borderRadius: RADIUS.full,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderColor: active ? c.primary : c.border,
                  backgroundColor: active ? c.primary : c.card,
                }}
              >
                <Text style={[TYPE.meta, { color: active ? '#FFFFFF' : c.text }]}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md, paddingBottom: insets.bottom + SPACE.xl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCourses(categoryKey, true)}
              tintColor={c.primary}
            />
          }
          renderItem={({ item }) => (
            <CourseCard course={item} c={c} onPress={() => openDetail(item)} />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: SPACE.xxl * 2 }}>
              <Text style={[TYPE.heading, { color: c.textMuted, textAlign: 'center' }]}>
                Keine Kurse gefunden
              </Text>
              <Text style={[TYPE.body, { color: c.muted, textAlign: 'center', marginTop: SPACE.sm }]}>
                Versuche eine andere Kategorie
              </Text>
            </View>
          }
          ListHeaderComponent={
            total > 0 ? (
              <Text style={[TYPE.meta, { color: c.textMuted, marginBottom: SPACE.sm }]}>
                {total} {total === 1 ? 'Kurs' : 'Kurse'}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

```

### `apps/mobile/src/screens/courses/CourseDetailScreen.js`

```js
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/use-theme';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';

function formatDate(iso, opts) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', opts ?? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatPrice(amount, currency) {
  if (!amount || Number(amount) === 0) return 'Kostenlos';
  return Number(amount).toLocaleString('de-DE', {
    style: 'currency',
    currency: currency ?? 'EUR',
    maximumFractionDigits: 0,
  });
}

function SectionLabel({ text, c }) {
  return (
    <Text style={[TYPE.label, { color: c.textMuted, marginBottom: SPACE.sm }]}>{text}</Text>
  );
}

function RunCard({ run, c, onEnroll }) {
  const [expanded, setExpanded] = useState(false);
  const spotsLeft = run.maxParticipants - run.confirmedCount;
  const isFull = !run.available;
  const isPaused = run.status === 'PAUSED';
  const canEnroll = run.available || run.waitlistEnabled;
  const deadline = run.bookingDeadline ? new Date(run.bookingDeadline) : null;
  const deadlinePassed = deadline && deadline < new Date();

  return (
    <View style={[{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }, SHADOW.card]}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={{ padding: SPACE.lg, gap: SPACE.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 3 }}>
            {run.label ? (
              <Text style={[TYPE.heading, { color: c.text }]}>{run.label}</Text>
            ) : null}
            {run.city ? (
              <Text style={[TYPE.meta, { color: c.textMuted }]}>{run.city}</Text>
            ) : null}
            {run.sessions?.[0] ? (
              <Text style={[TYPE.meta, { color: c.textMuted }]}>
                Startet {formatDate(run.sessions[0].startsAt)}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[TYPE.heading, { color: c.primary }]}>
              {formatPrice(run.priceAmount, run.priceCurrency)}
            </Text>
            {isPaused ? (
              <View style={{ backgroundColor: c.warningBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={[TYPE.label, { color: c.warning }]}>Pausiert</Text>
              </View>
            ) : isFull && !run.waitlistEnabled ? (
              <View style={{ backgroundColor: c.mutedBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={[TYPE.label, { color: c.muted }]}>Ausgebucht</Text>
              </View>
            ) : isFull && run.waitlistEnabled ? (
              <View style={{ backgroundColor: c.warningBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={[TYPE.label, { color: c.warning }]}>Warteliste</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: c.successBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={[TYPE.label, { color: c.success }]}>
                  {spotsLeft <= 3 ? `Noch ${spotsLeft} Platz${spotsLeft === 1 ? '' : ''}` : 'Verfügbar'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[TYPE.meta, { color: c.primary }]}>
            {run.sessions?.length ?? 0} Termine  {expanded ? '▲' : '▼'}
          </Text>
        </View>
      </Pressable>

      {expanded && run.sessions?.length > 0 && (
        <View style={{ borderTopWidth: 1, borderColor: c.border, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, gap: SPACE.sm }}>
          {run.sessions.map((session, idx) => (
            <View key={session.id} style={{ flexDirection: 'row', gap: SPACE.md }}>
              <Text style={[TYPE.meta, { color: c.muted, width: 20 }]}>{idx + 1}.</Text>
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.meta, { color: c.text }]}>
                  {formatDate(session.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                <Text style={[TYPE.meta, { color: c.textMuted }]}>
                  {formatTime(session.startsAt)} – {formatTime(session.endsAt)} Uhr
                  {session.location ? `  ·  ${session.location}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!isPaused && !deadlinePassed && canEnroll && (
        <View style={{ borderTopWidth: 1, borderColor: c.border, padding: SPACE.lg }}>
          <Pressable
            onPress={() => onEnroll(run)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? c.accent : c.primary,
              borderRadius: RADIUS.md,
              paddingVertical: 14,
              alignItems: 'center',
            })}
          >
            <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>
              {isFull ? 'Auf Warteliste' : 'Jetzt anmelden'}
            </Text>
          </Pressable>
          {deadline && !deadlinePassed && (
            <Text style={[TYPE.meta, { color: c.muted, textAlign: 'center', marginTop: SPACE.sm }]}>
              Anmeldeschluss: {formatDate(deadline, { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          )}
        </View>
      )}
      {deadlinePassed && (
        <View style={{ borderTopWidth: 1, borderColor: c.border, padding: SPACE.md }}>
          <Text style={[TYPE.meta, { color: c.muted, textAlign: 'center' }]}>Anmeldeschluss überschritten</Text>
        </View>
      )}
    </View>
  );
}

function EnrollModal({ visible, run, courseTitle, c, onClose }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setName(''); setEmail(''); setPhone(''); setConsent(false);
    setSubmitting(false); setSuccess(false); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Name und E-Mail sind Pflichtfelder.');
      return;
    }
    if (!consent) {
      setError('Bitte stimme der Datenschutzerklärung zu.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/courses/runs/${run.id}/enroll`, {
        method: 'POST',
        headers: { ...TUNNEL_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: name.trim(),
          patientEmail: email.trim().toLowerCase(),
          patientPhone: phone.trim() || undefined,
          consentAccepted: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data?.error ?? 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
      }
    } catch (_) {
      setError('Netzwerkfehler. Bitte prüfe deine Verbindung.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: insets.top + SPACE.md, paddingBottom: SPACE.sm, borderBottomWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[TYPE.heading, { color: c.text, flex: 1 }]} numberOfLines={1}>Anmeldung</Text>
          <Pressable onPress={handleClose} hitSlop={10} style={{ padding: 4 }}>
            <Text style={[TYPE.heading, { color: c.primary }]}>Schliessen</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          {success ? (
            <View style={{ alignItems: 'center', paddingTop: SPACE.xxl, gap: SPACE.lg }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.successBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 28 }}>✓</Text>
              </View>
              <Text style={[TYPE.lg, { color: c.text, textAlign: 'center' }]}>Anmeldung eingegangen</Text>
              <Text style={[TYPE.body, { color: c.textMuted, textAlign: 'center' }]}>
                Wir haben dir eine Bestätigungsmail geschickt. Bitte bestätige deine Anmeldung über den Link in der E-Mail.
              </Text>
              <Pressable
                onPress={handleClose}
                style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: SPACE.xxl, marginTop: SPACE.md }}
              >
                <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>Fertig</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ gap: SPACE.xs }}>
                <Text style={[TYPE.meta, { color: c.textMuted }]}>Kurs</Text>
                <Text style={[TYPE.body, { color: c.text }]}>{courseTitle}</Text>
                {run?.label ? <Text style={[TYPE.meta, { color: c.textMuted }]}>{run.label}</Text> : null}
              </View>

              <View style={{ gap: SPACE.md }}>
                <View style={{ gap: SPACE.xs }}>
                  <Text style={[TYPE.meta, { color: c.textMuted }]}>Name *</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Vor- und Nachname"
                    placeholderTextColor={c.muted}
                    autoCapitalize="words"
                    style={[TYPE.body, { color: c.text, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 12 }]}
                  />
                </View>

                <View style={{ gap: SPACE.xs }}>
                  <Text style={[TYPE.meta, { color: c.textMuted }]}>E-Mail *</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="deine@email.de"
                    placeholderTextColor={c.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[TYPE.body, { color: c.text, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 12 }]}
                  />
                </View>

                <View style={{ gap: SPACE.xs }}>
                  <Text style={[TYPE.meta, { color: c.textMuted }]}>Telefon (optional)</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+49 ..."
                    placeholderTextColor={c.muted}
                    keyboardType="phone-pad"
                    style={[TYPE.body, { color: c.text, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 12 }]}
                  />
                </View>
              </View>

              <Pressable
                onPress={() => setConsent((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: consent ? c.primary : c.border, backgroundColor: consent ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  {consent ? <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>✓</Text> : null}
                </View>
                <Text style={[TYPE.body, { color: c.textMuted, flex: 1 }]}>
                  Ich stimme der Verarbeitung meiner Daten zur Kursanmeldung zu. Die Anmeldung ist erst nach Bestätigung per E-Mail verbindlich.
                </Text>
              </Pressable>

              {error ? (
                <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.sm, padding: SPACE.md }}>
                  <Text style={[TYPE.meta, { color: c.error }]}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={submitting}
                style={({ pressed }) => ({
                  backgroundColor: submitting ? c.muted : pressed ? c.accent : c.primary,
                  borderRadius: RADIUS.md,
                  paddingVertical: 16,
                  alignItems: 'center',
                  marginTop: SPACE.sm,
                })}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>Jetzt anmelden</Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CourseDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { courseId, courseTitle: initialTitle } = route.params ?? {};
  const { c } = useTheme();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrollRun, setEnrollRun] = useState(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    fetch(`${getBaseUrl()}/courses/${courseId}`, { headers: { ...TUNNEL_HEADERS } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setCourse(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  const publishedRuns = course?.runs?.filter((r) => r.status === 'PUBLISHED') ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <BackButton c={c} label="Zurück" onPress={() => navigation.goBack()} />
          <ActivityIndicator color={c.primary} style={{ marginTop: SPACE.xxl }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Header */}
          <View style={{ paddingHorizontal: SPACE.lg, backgroundColor: c.background }}>
            <BackButton c={c} label="Kurse" onPress={() => navigation.goBack()} />
          </View>

          <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.md }}>
            {/* Category + flags */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
              {course?.category && (
                <View style={{ backgroundColor: c.primaryBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={[TYPE.label, { color: c.primary }]}>{course.category.label}</Text>
                </View>
              )}
              {course?.healthInsuranceEligible && (
                <View style={{ backgroundColor: c.accentBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={[TYPE.label, { color: c.accent }]}>Krankenkasse</Text>
                </View>
              )}
              {course?.zppVerified && (
                <View style={{ backgroundColor: c.successBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={[TYPE.label, { color: c.success }]}>ZPP-zertifiziert</Text>
                </View>
              )}
            </View>

            <Text style={[TYPE.xl, { color: c.text }]}>{course?.title ?? initialTitle}</Text>

            {/* Provider */}
            {course?.provider && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                <Text style={[TYPE.body, { color: c.textMuted }]}>
                  {course.provider.name}
                  {course.provider.city ? `  ·  ${course.provider.city}` : ''}
                </Text>
              </View>
            )}

            {/* Instructor */}
            {course?.instructorName && course.instructorName !== course.provider?.name && (
              <Text style={[TYPE.meta, { color: c.textMuted }]}>Kursleitung: {course.instructorName}</Text>
            )}
          </View>

          {/* Description */}
          {course?.description ? (
            <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.lg, gap: SPACE.sm }}>
              <SectionLabel text="Kursbeschreibung" c={c} />
              <Text style={[TYPE.body, { color: c.text, lineHeight: 24 }]}>{course.description}</Text>
            </View>
          ) : null}

          {/* Target audience */}
          {course?.targetAudience ? (
            <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.lg, gap: SPACE.sm }}>
              <SectionLabel text="Zielgruppe" c={c} />
              <Text style={[TYPE.body, { color: c.text }]}>{course.targetAudience}</Text>
            </View>
          ) : null}

          {/* Prerequisites */}
          {course?.prerequisites ? (
            <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.lg, gap: SPACE.sm }}>
              <SectionLabel text="Voraussetzungen" c={c} />
              <Text style={[TYPE.body, { color: c.text }]}>{course.prerequisites}</Text>
            </View>
          ) : null}

          {/* Runs */}
          <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.xl, gap: SPACE.md }}>
            <SectionLabel text={`Termine & Anmeldung (${publishedRuns.length})`} c={c} />
            {publishedRuns.length === 0 ? (
              <Text style={[TYPE.body, { color: c.muted }]}>Derzeit keine buchbaren Termine</Text>
            ) : (
              publishedRuns.map((run) => (
                <RunCard key={run.id} run={run} c={c} onEnroll={(r) => setEnrollRun(r)} />
              ))
            )}
          </View>

          {/* Cancellation policy */}
          {course?.cancellationPolicy ? (
            <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.xl, gap: SPACE.sm }}>
              <SectionLabel text="Stornierungsbedingungen" c={c} />
              <Text style={[TYPE.body, { color: c.textMuted }]}>{course.cancellationPolicy}</Text>
            </View>
          ) : null}

          {/* Contact */}
          {course?.contactInfo ? (
            <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.lg, gap: SPACE.sm }}>
              <SectionLabel text="Kontakt" c={c} />
              <Text style={[TYPE.body, { color: c.textMuted }]}>{course.contactInfo}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <EnrollModal
        visible={!!enrollRun}
        run={enrollRun}
        courseTitle={course?.title ?? initialTitle}
        c={c}
        onClose={() => setEnrollRun(null)}
      />
    </View>
  );
}

```

### `apps/mobile/src/screens/courses/TherapistCoursesScreen.js`

```js
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/use-theme';
import { useToast } from '../../hooks/use-toast';
import { ToastOverlay } from '../../components/ToastOverlay';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';
import { TherapistCourseCreateScreen } from './TherapistCourseCreateScreen';
import { CourseOverviewScreen } from './CourseOverviewScreen';

export const STATUS_META = {
  DRAFT:            { label: 'Entwurf',          bg: 'mutedBg',   fg: 'muted',   icon: 'create-outline' },
  PENDING_REVIEW:   { label: 'In Prüfung',        bg: 'warningBg', fg: 'warning', icon: 'time-outline' },
  APPROVED:         { label: 'Genehmigt',         bg: 'successBg', fg: 'success', icon: 'checkmark-circle-outline' },
  REJECTED:         { label: 'Abgelehnt',         bg: 'errorBg',   fg: 'error',   icon: 'close-circle-outline' },
  CHANGES_REQUESTED:{ label: 'Änderungen nötig',  bg: 'warningBg', fg: 'warning', icon: 'alert-circle-outline' },
  SUSPENDED:        { label: 'Gesperrt',          bg: 'errorBg',   fg: 'error',   icon: 'ban-outline' },
};

export function StatusBadge({ status, c }) {
  const meta = STATUS_META[status] ?? { label: status, bg: 'mutedBg', fg: 'muted', icon: 'ellipse-outline' };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c[meta.bg], borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6 }}>
      <Ionicons name={meta.icon} size={14} color={c[meta.fg]} />
      <Text style={[TYPE.meta, { color: c[meta.fg], fontWeight: '700' }]}>{meta.label}</Text>
    </View>
  );
}

function CourseRow({ course, c, onPress }) {
  const runCount = course.runs?.length ?? 0;
  const meta = STATUS_META[course.reviewStatus];
  const accentColor = meta ? c[meta.fg] : c.border;
  const highlight = course.reviewStatus === 'PENDING_REVIEW' || course.reviewStatus === 'CHANGES_REQUESTED';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: highlight ? c.warningBg : c.card,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderLeftWidth: 4,
          borderColor: highlight ? accentColor : c.border,
          borderLeftColor: accentColor,
          padding: SPACE.lg,
          gap: SPACE.sm,
          opacity: pressed ? 0.85 : 1,
        },
        SHADOW.card,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.sm }}>
        <Text style={[TYPE.heading, { color: c.text, flex: 1 }]} numberOfLines={2}>{course.title}</Text>
      </View>
      <StatusBadge status={course.reviewStatus} c={c} />
      <Text style={[TYPE.meta, { color: c.textMuted }]}>
        {course.category?.label ?? course.categoryKey}
        {runCount > 0 ? `  ·  ${runCount} ${runCount === 1 ? 'Durchlauf' : 'Durchläufe'}` : '  ·  Noch kein Durchlauf'}
      </Text>
      {course.reviewStatus === 'DRAFT' && (
        <Text style={[TYPE.meta, { color: c.primary }]}>Noch nicht eingereicht – tippe zum Bearbeiten</Text>
      )}
      {course.reviewStatus === 'PENDING_REVIEW' && (
        <Text style={[TYPE.meta, { color: c.warning, fontWeight: '600' }]}>Das Revio-Team prüft diesen Kurs gerade</Text>
      )}
      {course.reviewStatus === 'CHANGES_REQUESTED' && (
        <Text style={[TYPE.meta, { color: c.warning, fontWeight: '600' }]}>Admin hat Änderungen angefragt</Text>
      )}
    </Pressable>
  );
}

export function TherapistCoursesScreen({ authToken, c: cProp, onBack }) {
  const { c: themeC } = useTheme();
  const c = cProp ?? themeC;

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [viewCourseId, setViewCourseId] = useState(null);
  const { toastMsg, toastAnim, showToast } = useToast();

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/courses/my`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        // GET /courses/my liefert das Array direkt (kein { courses } Wrapper wie /courses).
        setCourses(Array.isArray(data) ? data : []);
      }
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  if (showCreate || editCourse) {
    return (
      <TherapistCourseCreateScreen
        authToken={authToken}
        c={c}
        existingCourse={editCourse}
        onBack={() => { setShowCreate(false); setEditCourse(null); }}
        onSaved={(message) => { setShowCreate(false); setEditCourse(null); load(); if (message) showToast(message); }}
      />
    );
  }

  if (viewCourseId) {
    return (
      <CourseOverviewScreen
        authToken={authToken}
        c={c}
        courseId={viewCourseId}
        onBack={() => setViewCourseId(null)}
        onEdit={(course) => { setViewCourseId(null); setEditCourse(course); }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: SPACE.lg, backgroundColor: c.background }}>
        <BackButton c={c} label="Optionen" onPress={onBack} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md }}>
          <Text style={[TYPE.xl, { color: c.text }]}>Meine Kurse</Text>
          <Pressable
            onPress={() => setShowCreate(true)}
            style={{ backgroundColor: c.primary, borderRadius: RADIUS.full, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c.primary} />}
          renderItem={({ item }) => (
            <CourseRow course={item} c={c} onPress={() => setViewCourseId(item.id)} />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: SPACE.lg }}>
              <Ionicons name="school-outline" size={48} color={c.border} />
              <Text style={[TYPE.heading, { color: c.textMuted, textAlign: 'center' }]}>Noch keine Kurse</Text>
              <Pressable
                onPress={() => setShowCreate(true)}
                style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: SPACE.xl }}
              >
                <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>Ersten Kurs anlegen</Text>
              </Pressable>
            </View>
          }
        />
      )}

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}

```

### `apps/mobile/src/screens/courses/TherapistCourseCreateScreen.js`

```js
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/use-theme';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';

const CATEGORIES = [
  { key: 'bewegung',    label: 'Bewegungsgesundheit' },
  { key: 'ernaehrung', label: 'Ernährung' },
  { key: 'stress',     label: 'Stressbewältigung' },
  { key: 'entspannung',label: 'Entspannung' },
  { key: 'sucht',      label: 'Suchtmittelkonsum' },
  { key: 'sonstiges',  label: 'Sonstiges' },
];

const LOCATION_TYPES = [
  { key: 'ONSITE',  label: 'Vor Ort' },
  { key: 'ONLINE',  label: 'Online' },
  { key: 'HYBRID',  label: 'Hybrid' },
];

// ── Hilfskomponenten ─────────────────────────────────────────────────────────

function Field({ label, required, children }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={[TYPE.meta, { color: '#6B838E' }]}>{label}{required ? ' *' : ''}</Text>
      {children}
    </View>
  );
}

function Input({ value, onChangeText, placeholder, c, multiline, keyboardType, style }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      keyboardType={keyboardType}
      multiline={multiline}
      style={[
        TYPE.body,
        {
          color: c.text,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: RADIUS.sm,
          paddingHorizontal: SPACE.md,
          paddingVertical: 11,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? 'top' : undefined,
        },
        style,
      ]}
    />
  );
}

function ChipSelect({ options, value, onChange, c }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={{
              borderWidth: 1,
              borderRadius: RADIUS.full,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderColor: active ? c.primary : c.border,
              backgroundColor: active ? c.primary : c.card,
            }}
          >
            <Text style={[TYPE.meta, { color: active ? '#FFFFFF' : c.text }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepHeader({ step, total, c }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: SPACE.lg }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i < step ? c.primary : i === step ? c.accent : c.border,
          }}
        />
      ))}
    </View>
  );
}

// ── Datums-/Zeitpicker (nativ) ────────────────────────────────────────────────

function formatDatePart(value) {
  return value ? value.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Datum wählen';
}

function formatTimePart(value) {
  return value ? value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'Uhrzeit wählen';
}

// iOS: kompakter, immer sichtbarer Picker (öffnet natives Popover beim Tippen).
// Android: Pressable-Feld, das per Tap den nativen Dialog öffnet (kein Inline-Widget möglich).
function PickerField({ label, value, onChange, mode, c, themeMode }) {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const handleChange = (event, selected) => {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) onChange(selected);
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={[TYPE.label, { color: c.textMuted, marginBottom: 3 }]}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode}
          display="compact"
          onChange={handleChange}
          locale="de-DE"
          themeVariant={themeMode === 'dark' ? 'dark' : 'light'}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : (
        <>
          <Pressable
            onPress={() => setShowAndroidPicker(true)}
            style={{
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: RADIUS.sm,
              paddingHorizontal: SPACE.md,
              paddingVertical: 11,
            }}
          >
            <Text style={[TYPE.body, { color: value ? c.text : c.muted }]}>
              {mode === 'date' ? formatDatePart(value) : formatTimePart(value)}
            </Text>
          </Pressable>
          {showAndroidPicker && (
            <DateTimePicker value={value ?? new Date()} mode={mode} display="default" onChange={handleChange} />
          )}
        </>
      )}
    </View>
  );
}

function DateTimeRow({ session, index, onChange, onRemove, c, themeMode }) {
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, padding: SPACE.md, gap: SPACE.sm }, SHADOW.card]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[TYPE.meta, { color: c.textMuted }]}>Termin {index + 1}</Text>
        {index > 0 && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={c.muted} />
          </Pressable>
        )}
      </View>
      <View style={{ gap: SPACE.sm }}>
        <PickerField
          label="Datum"
          value={session.date}
          onChange={(v) => onChange({ ...session, date: v })}
          mode="date"
          c={c}
          themeMode={themeMode}
        />
        <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
          <PickerField
            label="Von"
            value={session.startTime}
            onChange={(v) => onChange({ ...session, startTime: v })}
            mode="time"
            c={c}
            themeMode={themeMode}
          />
          <PickerField
            label="Bis"
            value={session.endTime}
            onChange={(v) => onChange({ ...session, endTime: v })}
            mode="time"
            c={c}
            themeMode={themeMode}
          />
        </View>
        <View>
          <Text style={[TYPE.label, { color: c.textMuted, marginBottom: 3 }]}>Ort (optional)</Text>
          <Input
            value={session.location}
            onChangeText={(v) => onChange({ ...session, location: v })}
            placeholder="Raum 3, Musterstr. 1"
            c={c}
          />
        </View>
      </View>
    </View>
  );
}

// ── Datum + Uhrzeit zusammenführen ────────────────────────────────────────────

function combineDateAndTime(date, time) {
  if (!date || !time) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes());
}

// ── Haupt-Screen ─────────────────────────────────────────────────────────────

export function TherapistCourseCreateScreen({ authToken, c: cProp, existingCourse, onBack, onSaved }) {
  const { c: themeC, themeMode } = useTheme();
  const c = cProp ?? themeC;
  const insets = useSafeAreaInsets();

  const isEdit = !!existingCourse;
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Step 0 – Kursdetails
  const [title, setTitle] = useState(existingCourse?.title ?? '');
  const [categoryKey, setCategoryKey] = useState(existingCourse?.categoryKey ?? '');
  const [locationType, setLocationType] = useState(existingCourse?.locationType ?? 'ONSITE');
  const [description, setDescription] = useState(existingCourse?.description ?? '');
  const [targetAudience, setTargetAudience] = useState(existingCourse?.targetAudience ?? '');
  const [instructorName, setInstructorName] = useState(existingCourse?.instructorName ?? '');

  // Step 1 – Durchlauf
  const [runLabel, setRunLabel] = useState('');
  const [city, setCity] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('10');
  const [priceAmount, setPriceAmount] = useState('0');
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);

  // Step 2 – Termine
  const [sessions, setSessions] = useState([
    { date: null, startTime: null, endTime: null, location: '' },
  ]);

  const updateSession = (idx, val) => setSessions((prev) => prev.map((s, i) => i === idx ? val : s));
  const addSession = () => setSessions((prev) => [...prev, { date: null, startTime: null, endTime: null, location: '' }]);
  const removeSession = (idx) => setSessions((prev) => prev.filter((_, i) => i !== idx));

  const validateStep0 = () => {
    if (!title.trim()) return 'Titel ist Pflichtfeld.';
    if (!categoryKey) return 'Bitte eine Kategorie wählen.';
    if (!description.trim() || description.trim().length < 10) return 'Beschreibung muss mindestens 10 Zeichen haben.';
    if (!instructorName.trim()) return 'Kursleitung ist Pflichtfeld.';
    return null;
  };

  const validateStep1 = () => {
    if (!maxParticipants || parseInt(maxParticipants, 10) < 1) return 'Mindestens 1 Teilnehmer.';
    return null;
  };

  const validateStep2 = () => {
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (!s.date || !s.startTime || !s.endTime) return `Termin ${i + 1}: Datum und Uhrzeiten ausfüllen.`;
      const start = combineDateAndTime(s.date, s.startTime);
      const end = combineDateAndTime(s.date, s.endTime);
      if (end <= start) return `Termin ${i + 1}: Endzeit muss nach Startzeit liegen.`;
    }
    return null;
  };

  const handleNext = () => {
    setError(null);
    const err = step === 0 ? validateStep0() : step === 1 ? validateStep1() : null;
    if (err) { setError(err); return; }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setError(null);
    const err = validateStep2();
    if (err) { setError(err); return; }

    setSubmitting(true);
    try {
      // 1. Kurs anlegen oder vorhandenen verwenden
      let courseId = existingCourse?.id;
      if (!courseId || existingCourse?.reviewStatus === 'DRAFT' || existingCourse?.reviewStatus === 'CHANGES_REQUESTED') {
        const coursePayload = {
          categoryKey,
          title: title.trim(),
          description: description.trim(),
          targetAudience: targetAudience.trim() || undefined,
          instructorName: instructorName.trim(),
          locationType,
        };
        const courseRes = await fetch(
          courseId ? `${getBaseUrl()}/courses/my/${courseId}` : `${getBaseUrl()}/courses/my`,
          {
            method: courseId ? 'PUT' : 'POST',
            headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(coursePayload),
          },
        );
        if (!courseRes.ok) {
          const d = await courseRes.json().catch(() => ({}));
          throw new Error(d?.error ?? 'Kurs konnte nicht gespeichert werden.');
        }
        const courseData = await courseRes.json();
        courseId = courseData.id ?? courseId;
      }

      // 2. Durchlauf anlegen
      const runPayload = {
        label: runLabel.trim() || undefined,
        city: city.trim() || undefined,
        maxParticipants: parseInt(maxParticipants, 10),
        priceAmount: parseInt(priceAmount, 10) || 0,
        priceCurrency: 'EUR',
        waitlistEnabled,
      };
      const runRes = await fetch(`${getBaseUrl()}/courses/my/${courseId}/runs`, {
        method: 'POST',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(runPayload),
      });
      if (!runRes.ok) {
        const d = await runRes.json().catch(() => ({}));
        throw new Error(d?.error ?? 'Durchlauf konnte nicht angelegt werden.');
      }
      const runData = await runRes.json();
      const runId = runData.id;

      // 3. Sessions anlegen
      const sessionPayloads = sessions.map((s) => ({
        startsAt: combineDateAndTime(s.date, s.startTime).toISOString(),
        endsAt: combineDateAndTime(s.date, s.endTime).toISOString(),
        location: s.location.trim() || undefined,
      }));
      const sessRes = await fetch(`${getBaseUrl()}/courses/my/${courseId}/runs/${runId}/sessions`, {
        method: 'POST',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionPayloads),
      });
      if (!sessRes.ok) {
        const d = await sessRes.json().catch(() => ({}));
        throw new Error(d?.error ?? 'Termine konnten nicht gespeichert werden.');
      }

      // 4. Zur Prüfung einreichen (nur wenn DRAFT oder CHANGES_REQUESTED)
      const willSubmit = !existingCourse || existingCourse.reviewStatus === 'DRAFT' || existingCourse.reviewStatus === 'CHANGES_REQUESTED';
      if (willSubmit) {
        await fetch(`${getBaseUrl()}/courses/my/${courseId}/submit`, {
          method: 'POST',
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        });
      }

      onSaved(willSubmit ? 'Kurs eingereicht – wird jetzt geprüft.' : 'Änderungen gespeichert.');
    } catch (e) {
      setError(e.message ?? 'Unbekannter Fehler.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ['Kursdetails', 'Durchlauf', 'Termine'];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ paddingHorizontal: SPACE.lg }}>
        <BackButton c={c} label={step === 0 ? 'Meine Kurse' : stepLabels[step - 1]} onPress={step === 0 ? onBack : () => setStep((s) => s - 1)} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: insets.bottom + 40, gap: SPACE.lg }} keyboardShouldPersistTaps="handled">
        <StepHeader step={step} total={3} c={c} />

        <View style={{ gap: 2 }}>
          <Text style={[TYPE.xl, { color: c.text }]}>{isEdit ? 'Kurs bearbeiten' : 'Neuer Kurs'}</Text>
          <Text style={[TYPE.meta, { color: c.textMuted }]}>Schritt {step + 1} von 3 – {stepLabels[step]}</Text>
        </View>

        {/* ── Schritt 0: Kursdetails ── */}
        {step === 0 && (
          <>
            <Field label="Kurstitel" required>
              <Input value={title} onChangeText={setTitle} placeholder="z. B. Rückenfit für den Alltag" c={c} />
            </Field>

            <Field label="Kategorie" required>
              <ChipSelect options={CATEGORIES} value={categoryKey} onChange={setCategoryKey} c={c} />
            </Field>

            <Field label="Format" required>
              <ChipSelect options={LOCATION_TYPES} value={locationType} onChange={setLocationType} c={c} />
            </Field>

            <Field label="Beschreibung" required>
              <Input value={description} onChangeText={setDescription} placeholder="Worum geht es in diesem Kurs?" c={c} multiline />
            </Field>

            <Field label="Zielgruppe">
              <Input value={targetAudience} onChangeText={setTargetAudience} placeholder="z. B. Berufstätige mit Rückenproblemen" c={c} multiline />
            </Field>

            <Field label="Kursleitung" required>
              <Input value={instructorName} onChangeText={setInstructorName} placeholder="Vor- und Nachname" c={c} />
            </Field>
          </>
        )}

        {/* ── Schritt 1: Durchlauf ── */}
        {step === 1 && (
          <>
            <Field label="Bezeichnung des Durchlaufs">
              <Input value={runLabel} onChangeText={setRunLabel} placeholder="z. B. Herbst 2026" c={c} />
            </Field>

            <Field label="Stadt / Ort">
              <Input value={city} onChangeText={setCity} placeholder="z. B. München" c={c} />
            </Field>

            <Field label="Max. Teilnehmerzahl" required>
              <Input value={maxParticipants} onChangeText={setMaxParticipants} placeholder="10" c={c} keyboardType="number-pad" />
            </Field>

            <Field label="Preis (EUR, 0 = kostenlos)">
              <Input value={priceAmount} onChangeText={setPriceAmount} placeholder="0" c={c} keyboardType="number-pad" />
            </Field>

            <Pressable onPress={() => setWaitlistEnabled((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
              <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                borderColor: waitlistEnabled ? c.primary : c.border,
                backgroundColor: waitlistEnabled ? c.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {waitlistEnabled ? <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>✓</Text> : null}
              </View>
              <View>
                <Text style={[TYPE.body, { color: c.text }]}>Warteliste aktivieren</Text>
                <Text style={[TYPE.meta, { color: c.textMuted }]}>Bei Ausbuchtung können sich weitere Interessierte eintragen</Text>
              </View>
            </Pressable>
          </>
        )}

        {/* ── Schritt 2: Termine ── */}
        {step === 2 && (
          <>
            <Text style={[TYPE.body, { color: c.textMuted }]}>
              Trage alle Einzeltermine des Durchlaufs ein. Jeder Termin erscheint danach in deinem Kalender.
            </Text>
            {sessions.map((session, idx) => (
              <DateTimeRow
                key={idx}
                session={session}
                index={idx}
                onChange={(val) => updateSession(idx, val)}
                onRemove={() => removeSession(idx)}
                c={c}
                themeMode={themeMode}
              />
            ))}
            <Pressable
              onPress={addSession}
              style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.sm }}
            >
              <Ionicons name="add-circle-outline" size={20} color={c.primary} />
              <Text style={[TYPE.body, { color: c.primary }]}>Weiteren Termin hinzufügen</Text>
            </Pressable>
          </>
        )}

        {error ? (
          <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.sm, padding: SPACE.md }}>
            <Text style={[TYPE.meta, { color: c.error }]}>{error}</Text>
          </View>
        ) : null}

        {/* ── Navigations-Button ── */}
        <Pressable
          onPress={step < 2 ? handleNext : handleSubmit}
          disabled={submitting}
          style={({ pressed }) => ({
            backgroundColor: submitting ? c.muted : pressed ? c.accent : c.primary,
            borderRadius: RADIUS.md,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: SPACE.sm,
          })}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>
              {step < 2 ? 'Weiter' : 'Kurs einreichen'}
            </Text>
          )}
        </Pressable>

        {step === 2 && (
          <Text style={[TYPE.meta, { color: c.textMuted, textAlign: 'center' }]}>
            Nach dem Einreichen prüft das Revio-Team deinen Kurs und schaltet ihn frei.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

```

### `apps/api/test/courses.test.ts`

```ts
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

```

## Integrationspunkte in geteilten Dateien

Diese Dateien bleiben bestehen; bei der Wiederherstellung müssen die folgenden
Kurs-bezogenen Zeilen wieder eingefügt werden. Gezeigt sind die Trefferzeilen
mit je 3 Zeilen Kontext (grep -n -C3, case-insensitive "course|kurs").

### `apps/api/src/app.ts`

```
22-import { scheduleRoutes } from './routes/schedule.js';
23-import { inquiryRoutes } from './routes/inquiry.js';
24-import { matchRoutes } from './routes/match.js';
25:import { courseRoutes } from './routes/courses.js';
26:import { adminCourseRoutes } from './routes/admin-courses.js';
27:import { publicCourseRoutes } from './routes/courses-public.js';
28:import { courseEnrollmentRoutes } from './routes/courses-enrollment.js';
29:import { courseFeatureGate } from './utils/course-feature-gate.js';
30-
31-const __dirname = dirname(fileURLToPath(import.meta.url));
32-
--
59-  await app.register(scheduleRoutes);
60-  await app.register(inquiryRoutes);
61-  await app.register(matchRoutes);
62:  // Öffentliche + Provider-Kursrouten hinter dem plattformweiten Kurs-Schalter.
63-  // Ist das Feature deaktiviert, antworten alle diese Endpunkte mit 404 — der
64-  // Gate-Hook wirkt nur in diesem gekapselten Kontext.
65-  await app.register(async (gated) => {
66:    gated.addHook('onRequest', courseFeatureGate);
67:    await gated.register(courseRoutes);
68:    await gated.register(publicCourseRoutes);
69:    await gated.register(courseEnrollmentRoutes);
70-  });
71:  // Admin-Kursrouten bleiben bewusst ungegated (Aufräumen nach dem Abschalten).
72:  await app.register(adminCourseRoutes);
73-
74-  // Scheduled expiry: mark stale PENDING bookings as EXPIRED every 5 min.
75-  // Im dynamischen Buchungssystem gibt es keine TherapistSlot-Statusänderung
```

### `apps/api/prisma/seed.ts`

```
424-    },
425-  });
426-
427:  // ── CourseCategory-Seed (§20 SGB V Handlungsfelder) ──────────────────────
428:  const courseCategories = [
429-    { key: 'bewegung',   label: 'Bewegungsgesundheit',  sortOrder: 1 },
430-    { key: 'ernaehrung', label: 'Ernährung',             sortOrder: 2 },
431-    { key: 'stress',     label: 'Stressbewältigung',     sortOrder: 3 },
--
433-    { key: 'sucht',      label: 'Suchtmittelkonsum',     sortOrder: 5 },
434-    { key: 'sonstiges',  label: 'Sonstiges',             sortOrder: 6 },
435-  ];
436:  for (const cat of courseCategories) {
437:    await prisma.courseCategory.upsert({
438-      where: { key: cat.key },
439-      update: { label: cat.label, sortOrder: cat.sortOrder },
440-      create: cat,
441-    });
442-  }
443:  console.log(`  ${courseCategories.length} CourseCategories angelegt`);
444-
445-  // ── SearchSuggestions ─────────────────────────────────────────────────────
446-  await (prisma as any).searchSuggestion.deleteMany();
```

### `apps/api/src/utils/mailer.ts`

```
237-  });
238-}
239-
240:// ── Kurs-Enrollment E-Mails ───────────────────────────────────────────────────
241-
242:export async function sendCourseEnrollmentConfirmEmail(opts: {
243-  to: string;
244-  participantName: string;
245:  courseTitle: string;
246-  runLabel: string | null;
247-  confirmLink: string;
248-}) {
249:  const { to, participantName, courseTitle, runLabel, confirmLink } = opts;
250-  const runPart = runLabel ? ` (${runLabel})` : '';
251-  await getResend().emails.send({
252-    from: FROM,
253-    to,
254:    subject: `Bitte bestätige deine Kursanmeldung: ${courseTitle}`,
255-    html: `
256-      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
257-        <h2 style="color:#2563eb">Anmeldung bestätigen</h2>
258-        <p>Hallo ${participantName},</p>
259-        <p>
260:          Danke für deine Anmeldung zum Kurs <strong>${courseTitle}${runPart}</strong>.
261-          Bitte bestätige deine E-Mail-Adresse, um die Anmeldung abzuschließen:
262-        </p>
263-        <p style="margin:32px 0">
--
274-        <p style="color:#9ca3af;font-size:12px">Revio · noreply@my-revio.de</p>
275-      </div>
276-    `,
277:    text: `Hallo ${participantName},\n\nBitte bestätige deine Anmeldung zum Kurs "${courseTitle}${runPart}":\n${confirmLink}\n\nDieser Link ist 48 Stunden gültig.`,
278-  });
279-}
280-
281:export async function sendCourseEnrollmentSuccessEmail(opts: {
282-  to: string;
283-  participantName: string;
284:  courseTitle: string;
285-  runLabel: string | null;
286-  cancelLink: string;
287-  sessions: Array<{ startsAt: Date; endsAt: Date }>;
288-}) {
289:  const { to, participantName, courseTitle, runLabel, cancelLink, sessions } = opts;
290-  const runPart = runLabel ? ` (${runLabel})` : '';
291-  const fmt = (d: Date) =>
292-    d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
--
299-  await getResend().emails.send({
300-    from: FROM,
301-    to,
302:    subject: `Anmeldung bestätigt: ${courseTitle}`,
303-    html: `
304-      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
305-        <h2 style="color:#16a34a">Anmeldung bestätigt</h2>
306-        <p>Hallo ${participantName},</p>
307:        <p>Deine Anmeldung zum Kurs <strong>${courseTitle}${runPart}</strong> ist eingegangen und wird vom Anbieter geprüft.</p>
308-        ${sessionList ? `<ul style="padding-left:20px">${sessionList}${moreNote}</ul>` : ''}
309-        <p>
310-          Möchtest du deine Anmeldung stornieren?
--
314-        <p style="color:#9ca3af;font-size:12px">Revio · noreply@my-revio.de</p>
315-      </div>
316-    `,
317:    text: `Hallo ${participantName},\n\nDeine Anmeldung zum Kurs "${courseTitle}${runPart}" ist bestätigt.\n\nAnmeldung stornieren: ${cancelLink}`,
318-  });
319-}
320-
321:export async function sendCourseEnrollmentCancelledEmail(opts: {
322-  to: string;
323-  participantName: string;
324:  courseTitle: string;
325-  runLabel: string | null;
326-  cancelledBy: 'PARTICIPANT' | 'PROVIDER';
327-}) {
328:  const { to, participantName, courseTitle, runLabel, cancelledBy } = opts;
329-  const runPart = runLabel ? ` (${runLabel})` : '';
330-  const reason =
331-    cancelledBy === 'PROVIDER'
--
335-  await getResend().emails.send({
336-    from: FROM,
337-    to,
338:    subject: `Anmeldung storniert: ${courseTitle}`,
339-    html: `
340-      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
341-        <h2 style="color:#dc2626">Anmeldung storniert</h2>
342-        <p>Hallo ${participantName},</p>
343-        <p>${reason}</p>
344:        <p><strong>Kurs:</strong> ${courseTitle}${runPart}</p>
345-        <p>Bei Fragen erreichst du uns unter <a href="mailto:revioclub.app@gmail.com" style="color:#2563eb">revioclub.app@gmail.com</a>.</p>
346-        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0"/>
347-        <p style="color:#9ca3af;font-size:12px">Revio · noreply@my-revio.de</p>
348-      </div>
349-    `,
350:    text: `Hallo ${participantName},\n\n${reason}\n\nKurs: ${courseTitle}${runPart}\n\nBei Fragen: revioclub.app@gmail.com`,
351-  });
352-}
353-
354:export async function sendCourseRunCancelledBulkEmail(opts: {
355-  to: string;
356-  participantName: string;
357:  courseTitle: string;
358-  runLabel: string | null;
359-  cancelReason: string;
360-}) {
361:  const { to, participantName, courseTitle, runLabel, cancelReason } = opts;
362-  const runPart = runLabel ? ` (${runLabel})` : '';
363-
364-  await getResend().emails.send({
365-    from: FROM,
366-    to,
367:    subject: `Kurs abgesagt: ${courseTitle}`,
368-    html: `
369-      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a">
370:        <h2 style="color:#dc2626">Kurs wurde abgesagt</h2>
371-        <p>Hallo ${participantName},</p>
372-        <p>
373:          Der Kursdurchlauf <strong>${courseTitle}${runPart}</strong> wurde leider abgesagt.
374-        </p>
375-        <p><strong>Grund:</strong> ${cancelReason}</p>
376-        <p>Bei Fragen erreichst du uns unter <a href="mailto:revioclub.app@gmail.com" style="color:#2563eb">revioclub.app@gmail.com</a>.</p>
--
378-        <p style="color:#9ca3af;font-size:12px">Revio · noreply@my-revio.de</p>
379-      </div>
380-    `,
381:    text: `Hallo ${participantName},\n\nDer Kurs "${courseTitle}${runPart}" wurde abgesagt.\n\nGrund: ${cancelReason}\n\nBei Fragen: revioclub.app@gmail.com`,
382-  });
383-}
384-
```

### `apps/api/src/utils/app-settings.ts`

```
10-};
11-
12-export const SITE_UNDER_CONSTRUCTION_KEY = 'site_under_construction';
13:export const COURSES_ENABLED_KEY = 'courses_enabled';
14-
15-export async function getBooleanAppSetting(
16-  prisma: AppSettingStore,
--
38-export async function getPublicSiteSettings(prisma: AppSettingStore) {
39-  return {
40-    underConstruction: await getBooleanAppSetting(prisma, SITE_UNDER_CONSTRUCTION_KEY, false),
41:    // Plattformweiter Kurs-Schalter. Fallback true = rückwärtskompatibel
42:    // (ohne gesetztes Setting bleiben Kurse an, bis der Admin sie abschaltet).
43:    coursesEnabled: await getBooleanAppSetting(prisma, COURSES_ENABLED_KEY, true),
44-  };
45-}
```

### `apps/api/src/routes/admin.ts`

```
19-  getDefaultSpecializationOptions,
20-  isSpecializationOptionStorageError,
21-} from '../utils/specialization-options.js';
22:import { getPublicSiteSettings, setBooleanAppSetting, SITE_UNDER_CONSTRUCTION_KEY, COURSES_ENABLED_KEY } from '../utils/app-settings.js';
23:import { invalidateCoursesEnabledCache } from '../utils/course-feature-gate.js';
24-
25-
26-const splitList = (value: string) =>
--
127-  });
128-  const siteSettingsSchema = z.object({
129-    underConstruction: z.boolean().optional(),
130:    coursesEnabled: z.boolean().optional(),
131-  });
132-  const blogPostSchema = z.object({
133-    slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, 'Ungültiger Slug'),
--
241-      );
242-    }
243-
244:    if (parsed.data.coursesEnabled !== undefined) {
245-      await setBooleanAppSetting(
246-        fastify.prisma,
247:        COURSES_ENABLED_KEY,
248:        parsed.data.coursesEnabled,
249-      );
250-      // Gate-Cache leeren, damit das Abschalten sofort greift.
251:      invalidateCoursesEnabledCache();
252-    }
253-
254-    return {
```

### `apps/admin/app/(admin)/settings/page.tsx`

```
1-import { PageShell } from '../../../components/page-shell';
2-import { api } from '../../../lib/api';
3:import { updateSiteUnderConstruction, updateCoursesEnabled } from '../../../lib/actions';
4-
5-export default async function SettingsPage() {
6-  const siteSettings = await api.getSiteSettings();
7-  const websiteStateLabel = siteSettings.underConstruction ? 'Under Construction aktiv' : 'Website normal sichtbar';
8:  const coursesStateLabel = siteSettings.coursesEnabled ? 'Kurse aktiv' : 'Kurse deaktiviert';
9-
10-  return (
11-    <PageShell
--
61-        <div className="panel-header">
62-          <div className="panel-header__content">
63-            <div className="kicker">App</div>
64:            <h3>Gesundheitskurse</h3>
65-            <p className="panel-header__description">
66:              Plattformweiter Schalter für die Kurs-Funktion. Ist sie deaktiviert, sind Kurse für
67-              alle Nutzer:innen unsichtbar und die zugehörigen Endpunkte antworten nicht mehr.
68-            </p>
69-          </div>
70:          <span className={`badge ${siteSettings.coursesEnabled ? 'badge--APPROVED' : 'badge--PENDING_REVIEW'}`}>
71:            {coursesStateLabel}
72-          </span>
73-        </div>
74-
75-        <div className="settings-feature-grid">
76-          <div className="settings-feature-card">
77-            <div className="settings-feature-card__label">App settings</div>
78:            <h4>Kurse plattformweit steuern</h4>
79-            <p>
80:              Deaktiviere die Kurs-Funktion für die gesamte Plattform. Die Suche, die Kursdetails und
81:              der Anbieter-Bereich „Meine Kurse" verschwinden für alle Nutzer:innen. Bereits angelegte
82:              Kurse bleiben erhalten und werden beim erneuten Aktivieren wieder sichtbar.
83-            </p>
84-            <div className="settings-feature-actions">
85:              <form action={updateCoursesEnabled}>
86:                <input type="hidden" name="coursesEnabled" value={siteSettings.coursesEnabled ? 'false' : 'true'} />
87:                <button className={`primary-btn ${siteSettings.coursesEnabled ? 'primary-btn--muted' : ''}`} type="submit">
88:                  {siteSettings.coursesEnabled ? 'Kurse deaktivieren' : 'Kurse aktivieren'}
89-                </button>
90-              </form>
91-            </div>
--
93-
94-          <aside className="settings-status-card">
95-            <div className="settings-status-card__eyebrow">Live-Status</div>
96:            <strong>{coursesStateLabel}</strong>
97:            <p>Gilt für App und öffentliche Kurs-Endpunkte.</p>
98-            <p>
99:              Der Admin-Bereich zur Kurs-Prüfung bleibt unabhängig davon erreichbar, damit bestehende
100:              Kurse weiter verwaltet werden können.
101-            </p>
102-          </aside>
103-        </div>
```

### `apps/admin/components/sidebar.tsx`

```
24-      { href: '/therapists', label: 'Therapeuten', icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z' },
25-      { href: '/practices', label: 'Praxen', icon: 'M4 21V9l8-6 8 6v12M9 21v-6h6v6M4 11h16' },
26-      { href: '/links', label: 'Verknüpfungen', icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
27:      { href: '/courses', label: 'Kurse', icon: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V4h16v13M4 19.5V21' },
28-      { href: '/feedback', label: 'Feedback', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
29-    ],
30-  },
```

### `apps/admin/lib/actions.ts`

```
160-  revalidatePath('/practices');
161-}
162-
163:// Course actions
164:async function reviewCourse(id: string, status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'SUSPENDED') {
165:  await adminRequest(`/admin/courses/${id}/review`, { method: 'PATCH', body: { status } });
166:  revalidatePath('/courses');
167:  revalidatePath(`/courses/${id}`);
168-}
169-
170:export async function approveCourse(id: string) {
171:  await reviewCourse(id, 'APPROVED');
172-}
173-
174:export async function rejectCourse(id: string) {
175:  await reviewCourse(id, 'REJECTED');
176-}
177-
178:export async function requestChangesCourse(id: string) {
179:  await reviewCourse(id, 'CHANGES_REQUESTED');
180-}
181-
182:export async function suspendCourse(id: string) {
183:  await reviewCourse(id, 'SUSPENDED');
184-}
185-
186-// Certification option actions
--
287-  revalidatePath('/settings');
288-}
289-
290:export async function updateCoursesEnabled(formData: FormData) {
291:  const value = String(formData.get('coursesEnabled') ?? '').trim();
292:  const coursesEnabled = value === 'true';
293-
294-  await adminRequest('/admin/site-settings/update', {
295:    body: { coursesEnabled },
296-  });
297-
298-  revalidatePath('/settings');
```

### `apps/admin/lib/api.ts`

```
125-
126-export type SiteSettings = {
127-  underConstruction: boolean;
128:  coursesEnabled: boolean;
129-};
130-
131-export type BlogPost = {
--
180-  };
181-};
182-
183:export type AdminCourseRun = {
184-  id: string;
185-  label: string | null;
186-  status: string;
--
195-  _count?: { enrollments: number };
196-};
197-
198:export type AdminCourse = {
199-  id: string;
200-  title: string;
201-  description: string;
--
216-  category: { key: string; label: string } | null;
217-  therapist: { id: string; fullName: string; email: string; city: string } | null;
218-  practice: { id: string; name: string; city: string } | null;
219:  runs: AdminCourseRun[];
220-};
221-
222-export const api = {
--
233-  getCertificationOptions: () => adminFetch<{ certifications: CertificationOption[] }>('/admin/certifications'),
234-  getSpecializationOptions: () => adminFetch<{ specializations: SpecializationOption[] }>('/admin/specializations'),
235-  getHeilmittelOptions: () => adminFetch<{ heilmittel: HeilmittelOption[] }>('/admin/heilmittel'),
236:  getAdminCourses: () => adminFetch<{ courses: AdminCourse[]; total: number }>('/admin/courses?limit=50'),
237:  getAdminCourse: (id: string) => adminFetch<AdminCourse>(`/admin/courses/${id}`),
238-};
```

### `apps/mobile/src/hooks/use-search.js`

```
95-  const [searched, setSearched] = useState(false);
96-  const [viewMode, setViewMode] = useState('list');
97-
98:  // ── Kurssuche (eigener Pfad, unabhängig von Therapeuten-Ergebnissen) ───────
99:  // Läuft NICHT durch runSearchWith – Kurse brauchen keinen Ort und dürfen die
100-  // Therapeuten-Ergebnisse (results/mapTherapists) nicht überschreiben.
101:  const [courseResults, setCourseResults] = useState([]);
102:  const [courseLoading, setCourseLoading] = useState(false);
103:  const [courseCategoryKey, setCourseCategoryKey] = useState(null);
104:  const courseDebounceRef = useRef(null);
105-
106-  // ── Autocomplete ──────────────────────────────────────────────────────────
107-  const [acSuggestions, setAcSuggestions] = useState([]);
--
178-    return () => { if (acDebounceRef.current) clearTimeout(acDebounceRef.current); };
179-  }, [query]);
180-
181:  // ── Kurssuche: Fetch + debounced Effekt ───────────────────────────────────
182:  const runCourseSearch = async (text, categoryKey) => {
183:    setCourseLoading(true);
184-    try {
185-      const params = new URLSearchParams({ limit: '20' });
186-      const trimmed = typeof text === 'string' ? text.trim() : '';
187-      if (trimmed.length >= 2) params.set('q', trimmed);
188-      if (categoryKey) params.set('categoryKey', categoryKey);
189:      const res = await fetch(`${getBaseUrl()}/courses?${params}`, { headers: { ...TUNNEL_HEADERS } });
190-      if (res.ok) {
191-        const data = await res.json();
192:        setCourseResults(data.courses ?? []);
193-      } else {
194:        setCourseResults([]);
195-      }
196-    } catch {
197:      setCourseResults([]);
198-    } finally {
199:      setCourseLoading(false);
200-    }
201-  };
202-
203:  // Ein Effekt deckt alle drei Auslöser im Kursmodus ab: Chip-Aktivierung,
204-  // Kategorie-Wechsel und Titel-Textsuche (query). 350 ms Debounce.
205-  useEffect(() => {
206:    if (activeChip?.type !== 'courses') return;
207:    if (courseDebounceRef.current) clearTimeout(courseDebounceRef.current);
208:    courseDebounceRef.current = setTimeout(() => {
209:      runCourseSearch(query, courseCategoryKey);
210-    }, 350);
211:    return () => { if (courseDebounceRef.current) clearTimeout(courseDebounceRef.current); };
212-    // eslint-disable-next-line react-hooks/exhaustive-deps
213:  }, [activeChip, query, courseCategoryKey]);
214-
215:  const selectCourseCategory = (key) => {
216:    setCourseCategoryKey(key);
217-  };
218-
219-  // ── Filter helpers ────────────────────────────────────────────────────────
--
244-    setSearched(false);
245-    setViewMode('list');
246-    setShowFilters(false);
247:    setCourseResults([]);
248:    setCourseCategoryKey(null);
249-  };
250-
251-  // ── Core search logic ─────────────────────────────────────────────────────
--
362-  const runSearch = () => runSearchWith(query, userCoords);
363-
364-  const selectChip = (chip) => {
365:    // Kurs-Chip zweigt VOR runSearchWith ab: kein Ort-Guard, kein LocationSheet.
366:    if (chip.type === 'courses') {
367-      setActiveChip(chip);
368-      setQuery('');
369-      setShowAutocomplete(false);
370:      setCourseCategoryKey(null);
371-      // Fetch übernimmt der debounced Effekt (reagiert auf activeChip-Wechsel).
372-      return;
373-    }
--
387-
388-  // ── Re-filter locally when filters change ─────────────────────────────────
389-  // Diese Filter grenzen nur die bereits geladene Obermenge ein — kein neuer
390:  // Server-Request. Im Kursmodus (activeChip.type === 'courses') dürfen die
391-  // Therapeuten-Ergebnisse nicht angefasst werden.
392-  useEffect(() => {
393-    if (!searchedRef.current) return;
394:    if (activeChip?.type === 'courses') return;
395-    setResults(applyFilters(allApiTherapists, userCoords));
396-    // eslint-disable-next-line react-hooks/exhaustive-deps
397-  }, [homeVisit, kassenart, gender, fortbildungen]);
--
664-    allApiTherapists,
665-    searched, setSearched,
666-    viewMode, setViewMode,
667:    // Course search
668:    courseResults,
669:    courseLoading,
670:    courseCategoryKey,
671:    selectCourseCategory,
672-    // Autocomplete
673-    acSuggestions,
674-    // Search actions
```

### `apps/mobile/src/hooks/use-config-options.js`

```
36-  certificationOptions: certificationFallback,
37-  specializationOptions: specializationFallback,
38-  heilmittelOptions: heilmittelFallback,
39:  // Plattformweiter Kurs-Schalter (aus /config/options → site.coursesEnabled).
40-  // Default true = rückwärtskompatibel, bis der Admin ihn abschaltet.
41:  coursesEnabled: true,
42-};
43-
44-// Module-level cache shared by every useConfigOptions() call site, so /config/options
--
60-        certificationOptions: normalizeOptions(data.certifications, certificationFallback),
61-        specializationOptions: normalizeOptions(data.specializations, specializationFallback),
62-        heilmittelOptions: normalizeOptions(data.heilmittel, heilmittelFallback),
63:        // Nur explizit false schaltet ab; alles andere lässt Kurse an.
64:        coursesEnabled: data.site?.coursesEnabled !== false,
65-      };
66-      cachedState = next;
67-      listeners.forEach((listener) => listener(next));
```

### `apps/mobile/src/hooks/use-therapist-schedule-data.js`

```
1-import { useCallback, useEffect, useRef, useState } from 'react';
2-import { getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';
3-
4:// Schedule data (working hours, blocked times, course sessions) changes rarely,
5-// so a tab-focus refresh only refetches when the last load is older than this.
6-// Pass { force: true } (pull-to-refresh) to bypass.
7-const SCHEDULE_STALE_MS = 30 * 1000;
--
9-export function useTherapistScheduleData({ authToken }) {
10-  const [workingHoursRules, setWorkingHoursRules] = useState([]);
11-  const [blockedTimes, setBlockedTimes] = useState([]);
12:  const [courseSessions, setCourseSessions] = useState([]);
13-  const [loading, setLoading] = useState(false);
14-  const cancelledRef = useRef(false);
15-  const lastLoadedAtRef = useRef(0);
--
25-      const to = new Date();
26-      to.setDate(to.getDate() + 90);
27-
28:      const [hoursRes, blockedRes, courseSessionsRes] = await Promise.all([
29-        fetch(`${getBaseUrl()}/therapist/working-hours`, {
30-          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
31-        }).catch(() => null),
--
34-          { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` } },
35-        ).catch(() => null),
36-        fetch(
37:          `${getBaseUrl()}/courses/my/sessions?from=${from.toISOString()}&to=${to.toISOString()}`,
38-          { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` } },
39-        ).catch(() => null),
40-      ]);
--
49-        const d = await blockedRes.json().catch(() => ({}));
50-        if (!cancelledRef.current) setBlockedTimes(d.blockedTimes ?? []);
51-      }
52:      if (courseSessionsRes?.ok) {
53:        const d = await courseSessionsRes.json().catch(() => ({}));
54:        if (!cancelledRef.current) setCourseSessions(d.sessions ?? []);
55-      }
56-      if (!cancelledRef.current) lastLoadedAtRef.current = Date.now();
57-    } finally {
--
67-    return () => { cancelledRef.current = true; };
68-  }, [load]);
69-
70:  return { workingHoursRules, blockedTimes, courseSessions, loading, refreshScheduleData: load };
71-}
```

### `apps/mobile/src/navigation/AppTabs.js`

```
12-import { TherapistProfileScreen } from '../screens/public/TherapistProfileScreen';
13-import { PracticeProfileScreen } from '../screens/public/PracticeProfileScreen';
14-import { TherapistDashboardScreen } from '../screens/dashboard/TherapistDashboardScreen';
15:import { CourseDetailScreen } from '../screens/courses/CourseDetailScreen';
16-import { LoginScreen } from '../screens/auth/LoginScreen';
17-import { translations } from '../i18n/translations';
18-import { CustomTabBar } from './CustomTabBar';
--
42-  };
43-}
44-
45:const DiscoverCourseStack = createNativeStackNavigator();
46-function DiscoverStack() {
47-  return (
48:    <DiscoverCourseStack.Navigator screenOptions={{ headerShown: false }}>
49:      <DiscoverCourseStack.Screen component={DiscoverTabScreen} name="DiscoverHome" />
50:      <DiscoverCourseStack.Screen component={ProfileTabScreen} name={ROOT_ROUTES.PROFILE} />
51:      <DiscoverCourseStack.Screen component={TherapistProfileScreen} name={ROOT_ROUTES.THERAPIST_PROFILE} />
52:      <DiscoverCourseStack.Screen component={PracticeProfileScreen} name={ROOT_ROUTES.PRACTICE_PROFILE} />
53:      <DiscoverCourseStack.Screen component={CourseDetailScreen} name={ROOT_ROUTES.COURSE_DETAIL} />
54:    </DiscoverCourseStack.Navigator>
55-  );
56-}
57-const FavoritesStack = withProfileScreens(FavoritesTabScreen, 'FavoritesHome');
```

### `apps/mobile/src/navigation/route-names.js`

```
6-  PRACTICE_PROFILE: 'PracticeProfile',
7-  LOGIN: 'Login',
8-  REGISTRATION: 'Registration',
9:  COURSE_LIST: 'CourseList',
10:  COURSE_DETAIL: 'CourseDetail',
11-};
12-
13-export const TAB_ROUTES = {
```

### `apps/mobile/src/screens/discover/DiscoverContent.js`

```
25-  TYPE,
26-} from '../../utils/app-utils';
27-import { AccountHeader } from '../../components/AccountHeader';
28:import { CourseCard } from '../../components/CourseCard';
29-import { useConfigOptions } from '../../hooks/use-config-options';
30-
31-// ── Map platform split ──────────────────────────────────────────────────────
--
117-    requestableOnly,
118-    setRequestableOnly,
119-    bannerExtraPadding = 0,
120:    courseResults,
121:    courseLoading,
122:    courseCategoryKey,
123:    selectCourseCategory,
124:    courseCategoryChips,
125:    openCourseById,
126-  } = props;
127-
128-  const insets = useSafeAreaInsets();
129-
130:  // Plattformweiter Kurs-Schalter: bei "aus" verschwindet der Kurs-Chip und der
131:  // Kursmodus ist nicht mehr erreichbar (auch wenn activeChip noch gesetzt wäre).
132:  const { coursesEnabled } = useConfigOptions();
133:  const visibleQuickChips = coursesEnabled
134-    ? quickChips
135:    : quickChips.filter((chip) => chip.type !== 'courses');
136-
137:  const isCourseMode = coursesEnabled && activeChip?.type === 'courses';
138:  const safeCourseResults = Array.isArray(courseResults) ? courseResults : [];
139:  const safeCourseCategoryChips = Array.isArray(courseCategoryChips) ? courseCategoryChips : [];
140-
141-  const safeResults = Array.isArray(results) ? results : [];
142-  const matchedResultsCount = safeResults.filter(
--
173-  const visibleSuggestions = safeAcSuggestions.filter((group) => group.type !== 'PRACTICE_NAME');
174-  const mutedText = c.textMuted ?? c.muted;
175-  const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
176:  const showHeaderToggle = !isCourseMode && (viewMode === 'map' || searched || safeResults.length > 0);
177-  const [fortbildungQuery, setFortbildungQuery] = React.useState('');
178-  const [showRadiusPicker, setShowRadiusPicker] = React.useState(false);
179-
--
731-          </View>
732-        )}
733-
734:        {!searched && !isCourseMode && (
735-          <View style={styles.hero}>
736-            <Text style={[styles.heroTitle, { color: c.text }]}>{t('heroTitle')}</Text>
737-            <Text style={[styles.heroSub, { color: c.muted }]}>{t('heroSub')}</Text>
--
751-              value={query}
752-              onChangeText={(text) => {
753-                setQuery(text);
754:                // Im Kursmodus den Kurs-Chip NICHT nullen – sonst fällt die
755-                // Suche zurück in die Therapeutensuche und die Titelsuche bricht.
756:                if (isCourseMode) return;
757-                setShowAutocomplete(true);
758-                setActiveChip(null);
759-              }}
760:              onSubmitEditing={() => { if (!isCourseMode) runSearch(); }}
761:              onFocus={() => { if (!isCourseMode) setShowAutocomplete(true); }}
762-              onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
763-              returnKeyType="search"
764:              placeholder={isCourseMode ? 'Kurse suchen' : t('searchPlaceholder')}
765-              placeholderTextColor={c.muted}
766-              style={[styles.searchInput, { color: c.text }]}
767-            />
--
770-                <Ionicons name="close-circle" size={16} color={c.muted} />
771-              </Pressable>
772-            )}
773:            {!isCourseMode && (
774-              <>
775-                <View style={[styles.searchDivider, { backgroundColor: c.border }]} />
776-                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
--
793-            )}
794-          </View>
795-
796:          {!isCourseMode && showAutocomplete && visibleSuggestions.length > 0 && (
797-            <View style={[styles.autocompleteBox, { backgroundColor: c.card, borderColor: c.primary }]}>
798-              {visibleSuggestions.map((group) => {
799-                const typeLabel = group.type === 'SPECIALTY' ? 'Spezialisierung'
--
861-          </View>
862-        )}
863-
864:        {/* Kategorie-Chips – nur im Kursmodus */}
865:        {isCourseMode && (
866-          <ScrollView
867-            horizontal
868-            showsHorizontalScrollIndicator={false}
869-            contentContainerStyle={styles.chipsRow}
870-          >
871:            {safeCourseCategoryChips.map((chip) => {
872:              const active = (courseCategoryKey ?? null) === chip.key;
873-              return (
874-                <Pressable
875-                  key={String(chip.key)}
876:                  onPress={() => selectCourseCategory(chip.key)}
877-                  style={[
878-                    styles.chip,
879-                    active
--
898-        showsVerticalScrollIndicator={false}
899-        keyboardShouldPersistTaps="handled"
900-      >
901:      {isCourseMode ? (
902-        <>
903:          {courseLoading && [1, 2, 3].map((item) => <SkeletonCard key={item} C={c} />)}
904-
905:          {!courseLoading && safeCourseResults.map((course) => (
906:            <View key={course.id} style={{ marginBottom: 14 }}>
907:              <CourseCard course={course} c={c} onPress={() => openCourseById(course.id, course.title)} />
908-            </View>
909-          ))}
910-
911:          {!courseLoading && safeCourseResults.length === 0 && (
912-            <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
913-              <Ionicons name="school-outline" size={32} color={c.muted} />
914:              <Text style={[styles.emptyTitle, { color: c.text }]}>Keine Kurse gefunden</Text>
915-              <Text style={[styles.emptyBody, { color: c.muted }]}>
916-                Versuche eine andere Kategorie oder einen anderen Suchbegriff.
917-              </Text>
```

### `apps/mobile/src/screens/discover/DiscoverScreen.js`

```
17-import { DiscoverContent } from './DiscoverContent';
18-import { NextAppointmentBanner, NEXT_APPOINTMENT_BANNER_HEIGHT } from '../../components/NextAppointmentBanner';
19-import { useTherapyData } from '../../context/TherapyContext';
20:import { getNextPatientAppointment, courseCategoryChips } from '../../utils/app-utils';
21-
22-const t = (key) => translations.de[key] ?? key;
23-
--
90-    navigation.navigate(ROOT_ROUTES.THERAPIST_PROFILE, { therapistId: id, therapist: fallback });
91-  };
92-
93:  const openCourseById = (id, title = null) => {
94:    navigation.navigate(ROOT_ROUTES.COURSE_DETAIL, { courseId: id, courseTitle: title });
95-  };
96-
97-  const handleBannerPress = () => {
--
156-        userCoords={search.userCoords}
157-        viewMode={search.viewMode}
158-        bannerExtraPadding={nextAppointment ? NEXT_APPOINTMENT_BANNER_HEIGHT + 16 : 0}
159:        courseResults={search.courseResults}
160:        courseLoading={search.courseLoading}
161:        courseCategoryKey={search.courseCategoryKey}
162:        selectCourseCategory={search.selectCourseCategory}
163:        courseCategoryChips={courseCategoryChips}
164:        openCourseById={openCourseById}
165-      />
166-
167-      <NextAppointmentBanner
```

### `apps/mobile/src/screens/options/OptionsScreen.js`

```
12-import { WorkingHoursScreen } from '../therapy/WorkingHoursScreen';
13-import { TherapistServicesScreen } from '../therapy/TherapistServicesScreen';
14-import { BlockedTimesScreen } from '../therapy/BlockedTimesScreen';
15:import { TherapistCoursesScreen } from '../courses/TherapistCoursesScreen';
16-
17-const t = (key) => translations.de[key] ?? key;
18-
--
37-  const [showWorkingHours, setShowWorkingHours] = useState(false);
38-  const [showServices, setShowServices] = useState(false);
39-  const [showBlockedTimes, setShowBlockedTimes] = useState(false);
40:  const [showMyCourses, setShowMyCourses] = useState(false);
41-
42-  const handleLogout = async () => {
43-    await logoutFromContext();
--
54-  if (showBlockedTimes) {
55-    return <BlockedTimesScreen c={c} authToken={authToken} onBack={() => setShowBlockedTimes(false)} />;
56-  }
57:  if (showMyCourses) {
58:    return <TherapistCoursesScreen c={c} authToken={authToken} onBack={() => setShowMyCourses(false)} />;
59-  }
60-
61-  return (
--
73-        onShowWorkingHours={() => setShowWorkingHours(true)}
74-        onShowServices={() => setShowServices(true)}
75-        onShowBlockedTimes={() => setShowBlockedTimes(true)}
76:        onShowMyCourses={() => setShowMyCourses(true)}
77-        c={c}
78-        t={t}
79-        styles={appStyles}
```

### `apps/mobile/src/screens/options/OptionsContent.js`

```
11-  onShowLogin, onShowRegister,
12-  onShowFeedback, onLogout,
13-  onShowDebug,
14:  onShowWorkingHours, onShowServices, onShowBlockedTimes, onShowMyCourses,
15-  c, t, styles,
16-}) {
17-  const [debugTapCount, setDebugTapCount] = React.useState(0);
18:  const { coursesEnabled } = useConfigOptions();
19-const renderOptions = () => {
20-  const isLoggedIn = Boolean(loggedInTherapist || loggedInPatient);
21-
--
99-          </>
100-        )}
101-
102:        {/* ── Kurse (alle eingeloggten Therapeuten) — nur wenn plattformweit aktiv ── */}
103:        {loggedInTherapist && coursesEnabled && (
104-          <>
105:            <SectionHeader title="Gesundheitskurse" />
106-            <OptionGroup>
107-              <OptionRow
108:                label="Meine Kurse"
109:                subtitle="Kurse anlegen, planen und einreichen"
110-                icon="school-outline"
111:                onPress={onShowMyCourses}
112-                valueColor={c.primary}
113-                last
114-              />
```

### `apps/mobile/src/screens/dashboard/TherapistDashboardScreen.js`

```
321-  );
322-}
323-
324:function AgendaCourseRow({ item, c }) {
325-  const { startsAt, endsAt, session } = item;
326-  const durationMin = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
327-  const accentColor = c.accent ?? '#5A9E8E';
--
334-      </Text>
335-      <View style={{ flex: 1, paddingLeft: 6 }}>
336-        <Text style={{ fontSize: 14, fontWeight: '600', color: accentColor }} numberOfLines={1}>
337:          {session?.courseTitle ?? 'Kurs'}
338-        </Text>
339-        {session?.runLabel ? (
340-          <Text style={{ fontSize: 12, color: accentColor, opacity: 0.8, marginTop: 1 }} numberOfLines={1}>{session.runLabel}</Text>
--
342-      </View>
343-      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
344-        <View style={{ backgroundColor: accentColor, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
345:          <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>Kurs</Text>
346-        </View>
347-        <Text style={{ fontSize: 12, color: accentColor }}>{durationMin} Min</Text>
348-      </View>
--
417-                servicesByKey={servicesByKey}
418-                c={c}
419-              />
420:            ) : item.type === 'course' ? (
421:              <AgendaCourseRow item={item} c={c} />
422-            ) : (
423-              <AgendaFreeRow item={item} c={c} />
424-            )}
--
518-    refreshTherapyTab,
519-  } = useTherapyData();
520-
521:  const { workingHoursRules, blockedTimes, courseSessions, refreshScheduleData } = useTherapistScheduleData({ authToken });
522-  const { servicesByKey } = useTherapistServices({ authToken });
523-
524-  const [selectedDate] = useState(() => {
--
545-  );
546-
547-  const agendaItems = useMemo(
548:    () => getDayAgendaItems({ bookings: incomingBookings, workingHoursRules, blockedTimes, courseSessions, date: selectedDate }),
549:    [incomingBookings, workingHoursRules, blockedTimes, courseSessions, selectedDate],
550-  );
551-
552-  const agendaState = useMemo(() => getCurrentAgendaState(agendaItems, now), [agendaItems, now]);
```

### `apps/mobile/src/utils/app-utils.js`

```
15-  { label: 'Sportphysiotherapie', keywords: ['sport', 'sportphysiotherapie', 'sportverletzung', 'sportreha'] },
16-  { label: 'Neurologische Rehabilitation', keywords: ['neurologie', 'neurologisch', 'neurologische rehabilitation', 'bobath', 'vojta', 'bobath-therapie', 'vojta-therapie'] },
17-  { label: 'Schulterrehabilitation', keywords: ['schulter', 'schulterrehabilitation', 'nackenschmerzen', 'nacken'] },
18:  // Sondermodus: schaltet die Ergebnisliste auf Gesundheitskurse um (siehe use-search.js)
19:  { label: 'Gesundheitskurse', type: 'courses' },
20-];
21-
22:// Kategorie-Chips für die Kurssuche (Sondermodus des Gesundheitskurse-Chips)
23:const courseCategoryChips = [
24-  { key: null, label: 'Alle' },
25-  { key: 'bewegung', label: 'Bewegung' },
26-  { key: 'ernaehrung', label: 'Ernährung' },
--
516-  normalizeLanguageCodes,
517-  normalizeTherapistProfile,
518-  quickChips,
519:  courseCategoryChips,
520-  regSpecOptions,
521-  resolveKassenartFilterValues,
522-  resolveMediaUrl,
```

### `apps/mobile/src/utils/therapist-dashboard.js`

```
141-/**
142- * Wandelt computeDayPeriods-Ergebnis in typisierte Agenda-Items um.
143- * kind=blocked wird nicht angezeigt.
144: * courseSessions werden als type='course' Items eingefügt und chronologisch einsortiert.
145- */
146:export function getDayAgendaItems({ bookings, workingHoursRules, blockedTimes, courseSessions = [], date }) {
147-  const periods = computeDayPeriods(
148-    Array.isArray(workingHoursRules) ? workingHoursRules : [],
149-    Array.isArray(blockedTimes) ? blockedTimes : [],
--
167-    }
168-  }
169-
170:  // Kurs-Sessions des Tages einfügen
171:  if (Array.isArray(courseSessions)) {
172:    for (const s of courseSessions) {
173-      const start = new Date(s.startsAt);
174-      const end = new Date(s.endsAt);
175-      if (start >= dayStart && start <= dayEnd) {
176:        items.push({ type: 'course', session: s, startsAt: start, endsAt: end });
177-      }
178-    }
179-  }
```

### `apps/api/test/app.test.ts`

```
109-  it('returns public site config and can toggle under construction via admin', async () => {
110-    const initialRes = await app.inject({ method: 'GET', url: '/config/site' });
111-    expect(initialRes.statusCode).toBe(200);
112:    expect(initialRes.json()).toEqual({ underConstruction: false, coursesEnabled: true });
113-
114-    const updateRes = await app.inject({
115-      method: 'POST',
--
119-    });
120-
121-    expect(updateRes.statusCode).toBe(200);
122:    expect(updateRes.json()).toEqual({ success: true, underConstruction: true, coursesEnabled: true });
123-
124-    const nextRes = await app.inject({ method: 'GET', url: '/config/site' });
125-    expect(nextRes.statusCode).toBe(200);
126:    expect(nextRes.json()).toEqual({ underConstruction: true, coursesEnabled: true });
127-  });
128-});
129-
```

