ALTER TABLE "Therapist" ADD COLUMN "bookingMode" TEXT NOT NULL DEFAULT 'DIRECTORY_ONLY';
ALTER TABLE "Therapist" ADD COLUMN "nextFreeSlotAt" DATETIME;

CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "patientName" TEXT NOT NULL,
    "patientEmail" TEXT,
    "patientPhone" TEXT,
    "preferredDays" TEXT NOT NULL DEFAULT '',
    "preferredTimeWindows" TEXT NOT NULL DEFAULT '',
    "message" TEXT,
    "consentAcceptedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseDueAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    "confirmedSlotAt" DATETIME,
    CONSTRAINT "BookingRequest_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BookingRequest_therapistId_status_createdAt_idx" ON "BookingRequest"("therapistId", "status", "createdAt");
