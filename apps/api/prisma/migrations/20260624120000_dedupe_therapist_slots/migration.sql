-- TherapistSlot was created on 2026-05-08 (20260508133618_add_therapist_slots)
-- without any uniqueness constraint. The (therapistId, startsAt) unique index
-- was only added three days later (20260511100000_unique_slot_per_therapist_time).
-- CREATE UNIQUE INDEX fails on SQLite if violating rows already exist, so if any
-- duplicate slots were created in that three-day gap, that migration would have
-- failed to apply — leaving the database without the constraint to this day, and
-- still carrying the duplicate rows that caused the failure in the first place.
--
-- This migration cleans up any such duplicates, then (re)creates the index
-- idempotently so the constraint is guaranteed to exist afterwards regardless
-- of whether it was already present.
--
-- Cleanup is conservative: for a given (therapistId, startsAt) group with more
-- than one row, a survivor is only chosen automatically when at most one row in
-- that group has a booking attached. Groups where two *different* bookings
-- collide on the same slot time are left untouched — that would mean two real
-- booking requests for the same therapist at the same exact time, which is a
-- separate, more serious problem than a duplicate free slot and needs manual
-- review rather than an automatic delete.
--
-- Within an eligible group, the surviving row is the one with a booking
-- attached if there is one (so cleanup never has to touch booking data),
-- otherwise the oldest by createdAt (ties broken by id). All other rows in
-- that group are deleted.

DELETE FROM "TherapistSlot"
WHERE "id" IN (
  SELECT id FROM (
    SELECT
      t."id" AS id,
      COUNT(*) OVER (PARTITION BY t."therapistId", t."startsAt") AS group_size,
      COUNT(br."id") OVER (PARTITION BY t."therapistId", t."startsAt") AS booking_count,
      ROW_NUMBER() OVER (
        PARTITION BY t."therapistId", t."startsAt"
        ORDER BY (br."id" IS NULL) ASC, t."createdAt" ASC, t."id" ASC
      ) AS rn
    FROM "TherapistSlot" t
    LEFT JOIN "BookingRequest" br ON br."slotId" = t."id"
  )
  WHERE group_size > 1
    AND booking_count <= 1
    AND rn > 1
);

-- CreateIndex (idempotent — guarantees the constraint exists going forward
-- regardless of whether the original 20260511100000 migration ever actually
-- applied successfully)
CREATE UNIQUE INDEX IF NOT EXISTS "TherapistSlot_therapistId_startsAt_key"
  ON "TherapistSlot"("therapistId", "startsAt");
