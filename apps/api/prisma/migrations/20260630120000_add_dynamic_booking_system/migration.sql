-- AlterTable: HeilmittelOption bekommt eine globale Standard-Behandlungsdauer
ALTER TABLE "HeilmittelOption" ADD COLUMN "defaultDurationMin" INTEGER NOT NULL DEFAULT 20;

-- AlterTable: BookingRequest bekommt den echten Termin-Zeitraum (dynamisches Buchungssystem)
ALTER TABLE "BookingRequest" ADD COLUMN "startsAt" DATETIME;
ALTER TABLE "BookingRequest" ADD COLUMN "endsAt" DATETIME;

-- CreateTable: Therapeutenspezifische Leistungskonfiguration (Dauer-Override pro Heilmittel)
CREATE TABLE "TherapistService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "heilmittelKey" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "bufferAfterMin" INTEGER NOT NULL DEFAULT 0,
    "slotIntervalMin" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TherapistService_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: Neutrale Blockzeiten (Pause, Hausbesuch, Urlaub, …)
CREATE TABLE "TherapistBlockedTime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Blockiert',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TherapistBlockedTime_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TherapistService_therapistId_heilmittelKey_key" ON "TherapistService"("therapistId", "heilmittelKey");
CREATE INDEX "TherapistService_therapistId_isActive_idx" ON "TherapistService"("therapistId", "isActive");
CREATE INDEX "TherapistBlockedTime_therapistId_startsAt_endsAt_idx" ON "TherapistBlockedTime"("therapistId", "startsAt", "endsAt");
