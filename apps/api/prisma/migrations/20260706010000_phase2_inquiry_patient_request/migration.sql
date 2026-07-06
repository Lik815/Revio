-- Phase 2: Nachfrageseite + State Machine
-- Neue Enums (SQLite: TEXT mit implizitem Constraint durch Prisma)
-- InquiryStatus: SENT | SEEN | COUNTER_PROPOSED | CONFIRMED | CANCELLED | DECLINED | DECLINED_BY_PATIENT | WITHDRAWN | AUTO_CLOSED | EXPIRED
-- InquiryCancelReason: PRAXIS_KRANKHEIT | PRAXIS_ABSAGE | PATIENT_WUNSCH | SONSTIGES
-- InquiryCancelActor: PRAXIS | PATIENT

-- PatientRequest
CREATE TABLE "PatientRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientUserId" TEXT NOT NULL,
    "heilmittel" TEXT NOT NULL,
    "kassenart" TEXT NOT NULL DEFAULT '',
    "frequenz" TEXT NOT NULL DEFAULT 'X1',
    "anzahlTermine" INTEGER NOT NULL DEFAULT 6,
    "suchtyp" TEXT NOT NULL DEFAULT 'SERIE',
    "message" TEXT,
    "migrated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientRequest_patientUserId_fkey"
        FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PatientRequest_patientUserId_createdAt_idx" ON "PatientRequest"("patientUserId", "createdAt");

-- PatientTimeWindow
CREATE TABLE "PatientTimeWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientRequestId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "vonMinute" INTEGER NOT NULL,
    "bisMinute" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientTimeWindow_patientRequestId_fkey"
        FOREIGN KEY ("patientRequestId") REFERENCES "PatientRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PatientTimeWindow_patientRequestId_idx" ON "PatientTimeWindow"("patientRequestId");

-- PrescriptionData
CREATE TABLE "PrescriptionData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientRequestId" TEXT NOT NULL UNIQUE,
    "icdCode" TEXT,
    "heilmittelposNr" TEXT,
    "indikationsSchluessel" TEXT,
    "arztName" TEXT,
    "arztDatum" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PrescriptionData_patientRequestId_fkey"
        FOREIGN KEY ("patientRequestId") REFERENCES "PatientRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Inquiry
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientRequestId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "heilmittel" TEXT NOT NULL,
    "kassenart" TEXT NOT NULL DEFAULT '',
    "frequenz" TEXT NOT NULL DEFAULT 'X1',
    "anzahlTermine" INTEGER NOT NULL DEFAULT 6,
    "patientFreitext" TEXT,
    "patientName" TEXT NOT NULL,
    "patientEmail" TEXT,
    "patientPhone" TEXT,
    "parallelAnfragenAnzahl" INTEGER NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "cancelActor" TEXT,
    "cancelledAt" DATETIME,
    "ablehnungsgrund" TEXT,
    "respondedAt" DATETIME,
    "responseDueAt" DATETIME NOT NULL,
    "reminderSentAt" DATETIME,
    "confirmedDatum" DATETIME,
    "confirmedUhrzeitVon" INTEGER,
    "confirmedUhrzeitBis" INTEGER,
    "migrated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inquiry_patientRequestId_fkey"
        FOREIGN KEY ("patientRequestId") REFERENCES "PatientRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Inquiry_therapistId_fkey"
        FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Inquiry_therapistId_status_createdAt_idx" ON "Inquiry"("therapistId", "status", "createdAt");
CREATE INDEX "Inquiry_patientRequestId_idx" ON "Inquiry"("patientRequestId");
