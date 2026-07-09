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
