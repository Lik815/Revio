-- AddColumn
-- Soft-Delete/Archiv für Therapeuten (nullable, kein Backfill): gesetzt =
-- archiviert. Endgültiges Löschen ist nur aus dem Archiv heraus möglich.
ALTER TABLE "Therapist" ADD COLUMN "archivedAt" DATETIME;
