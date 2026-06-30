-- ── CONTRACT: TherapistSlot entfernen ──────────────────────────────────────
--
-- SCHRITT 1: Bestehende Buchungen migrieren
-- startsAt/endsAt aus dem verknüpften TherapistSlot befüllen,
-- falls noch nicht gesetzt (z.B. alte PENDING/CONFIRMED-Buchungen).

UPDATE "BookingRequest"
SET
  "startsAt" = s."startsAt",
  "endsAt"   = datetime(s."startsAt", '+' || s."durationMin" || ' minutes'),
  "confirmedSlotAt" = COALESCE("BookingRequest"."confirmedSlotAt", s."startsAt")
FROM "TherapistSlot" s
WHERE "BookingRequest"."slotId" = s."id"
  AND "BookingRequest"."startsAt" IS NULL;

-- Fallback für Buchungen ohne Slot-Referenz aber mit confirmedSlotAt
UPDATE "BookingRequest"
SET
  "startsAt" = "confirmedSlotAt",
  "endsAt"   = datetime("confirmedSlotAt", '+20 minutes')
WHERE "startsAt" IS NULL
  AND "confirmedSlotAt" IS NOT NULL;

-- SCHRITT 2: slotId-Referenz entfernen, TherapistSlot droppen

-- DROP TABLE "TherapistSlot" (erst nachdem slotId-FK weg ist)
-- SQLite unterstützt kein DROP CONSTRAINT direkt; wir löschen/erstellen BookingRequest neu
-- Stattdessen: nur slotId auf NULL setzen (Spalte bleibt als nullable tombstone)

UPDATE "BookingRequest" SET "slotId" = NULL WHERE "slotId" IS NOT NULL;

-- TherapistSlot-Zeilen droppen
DELETE FROM "TherapistSlot";

-- ── Entfernen der working-hours-Felder aus TherapistWorkingHoursRule ────────
-- SQLite erlaubt kein ALTER TABLE DROP COLUMN in älteren Versionen;
-- Felder bleiben als nullable tombstone bis zu einem späteren Schema-Refresh.
-- In PostgreSQL/Production:
--   ALTER TABLE "TherapistWorkingHoursRule" DROP COLUMN IF EXISTS "durationMin";
--   ALTER TABLE "TherapistWorkingHoursRule" DROP COLUMN IF EXISTS "intervalMin";
--   ALTER TABLE "BookingRequest" DROP COLUMN IF EXISTS "slotId";
--   DROP TABLE "TherapistSlot";
