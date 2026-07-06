-- Phase 1: Kapazitätsmodell, Abwesenheiten, denormalisierte Kalender-Slots

-- Neue Enums (SQLite: als TEXT-Constraint abgebildet)
-- AbsenceGrund: URLAUB | FORTBILDUNG | KRANKHEIT | SONSTIGES
-- ScheduledSlotStatus: SCHEDULED | CANCELLED | COMPLETED
-- QualifikationStatus: UNGEPRÜFT | EINGEREICHT | VERIFIZIERT | ABGELAUFEN

-- TherapistService: kassenarten hinzufügen
ALTER TABLE "TherapistService" ADD COLUMN "kassenarten" TEXT NOT NULL DEFAULT '';

-- Therapist: Qualifikations-Verifikations-Felder
ALTER TABLE "Therapist" ADD COLUMN "qualifikationenStatus" TEXT NOT NULL DEFAULT 'UNGEPRÜFT';
ALTER TABLE "Therapist" ADD COLUMN "qualifikationenVerifiziertAt" DATETIME;

-- TherapistCapacityRule
CREATE TABLE "TherapistCapacityRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL UNIQUE,
    "maxNeueSerienProWoche" INTEGER NOT NULL DEFAULT 2,
    "laufendeNeuaufnahmenDieseWoche" INTEGER NOT NULL DEFAULT 0,
    "weekResetAt" DATETIME,
    "maxAnfragenOffen" INTEGER NOT NULL DEFAULT 5,
    "autoPauseBeiFullCapacity" BOOLEAN NOT NULL DEFAULT true,
    "belegungsfaktor" REAL NOT NULL DEFAULT 0.4,
    "abgeschlosseneInquiriesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TherapistCapacityRule_therapistId_fkey"
        FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- TherapistAbsence
CREATE TABLE "TherapistAbsence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "von" DATETIME NOT NULL,
    "bis" DATETIME NOT NULL,
    "grund" TEXT NOT NULL DEFAULT 'SONSTIGES',
    "ganzePraxis" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TherapistAbsence_therapistId_fkey"
        FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TherapistAbsence_therapistId_von_bis_idx" ON "TherapistAbsence"("therapistId", "von", "bis");

-- ScheduledSlot
CREATE TABLE "ScheduledSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingRequestId" TEXT NOT NULL,
    "therapistId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "seriesIndex" INTEGER NOT NULL DEFAULT 1,
    "heilmittel" TEXT NOT NULL DEFAULT '',
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledSlot_bookingRequestId_fkey"
        FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledSlot_therapistId_fkey"
        FOREIGN KEY ("therapistId") REFERENCES "Therapist"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ScheduledSlot_therapistId_startsAt_status_idx" ON "ScheduledSlot"("therapistId", "startsAt", "status");
CREATE INDEX "ScheduledSlot_bookingRequestId_idx" ON "ScheduledSlot"("bookingRequestId");
