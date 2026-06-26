-- CreateTable
CREATE TABLE "TherapistWorkingHoursRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 20,
    "intervalMin" INTEGER,
    "effectiveFrom" DATETIME,
    "effectiveUntil" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TherapistWorkingHoursRule_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TherapistWorkingHoursRule_therapistId_isActive_idx" ON "TherapistWorkingHoursRule"("therapistId", "isActive");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TherapistSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 20,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "workingHoursRuleId" TEXT,
    CONSTRAINT "TherapistSlot_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TherapistSlot_workingHoursRuleId_fkey" FOREIGN KEY ("workingHoursRuleId") REFERENCES "TherapistWorkingHoursRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TherapistSlot" ("id", "therapistId", "startsAt", "durationMin", "status", "createdAt") SELECT "id", "therapistId", "startsAt", "durationMin", "status", "createdAt" FROM "TherapistSlot";
DROP TABLE "TherapistSlot";
ALTER TABLE "new_TherapistSlot" RENAME TO "TherapistSlot";
CREATE UNIQUE INDEX "TherapistSlot_therapistId_startsAt_key" ON "TherapistSlot"("therapistId", "startsAt");
CREATE INDEX "TherapistSlot_therapistId_status_startsAt_idx" ON "TherapistSlot"("therapistId", "status", "startsAt");
CREATE INDEX "TherapistSlot_workingHoursRuleId_idx" ON "TherapistSlot"("workingHoursRuleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
