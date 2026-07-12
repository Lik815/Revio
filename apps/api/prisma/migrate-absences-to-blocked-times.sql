-- Einmalige, idempotente Datenmigration: kopiert bestehende TherapistAbsence-
-- Zeilen nach TherapistBlockedTime (grund gesetzt), damit Abwesenheiten künftig
-- vom Slot-Generator und der Buchungs-Konfliktprüfung berücksichtigt werden.
-- TherapistAbsence wurde dort nie abgefragt — eingetragener Urlaub verhinderte
-- bisher keine neuen Patienten-Buchungen. Die TherapistAbsence-Tabelle bleibt
-- unangetastet bestehen (kein Datenverlust bei Doppelausführung).
--
-- Ausführen (einmalig, gegen Produktion):
--   railway connect Postgres < prisma/migrate-absences-to-blocked-times.sql
INSERT INTO "TherapistBlockedTime" (id, "therapistId", "startsAt", "endsAt", title, grund, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  a."therapistId",
  a.von,
  a.bis,
  CASE a.grund
    WHEN 'URLAUB' THEN 'Urlaub'
    WHEN 'FORTBILDUNG' THEN 'Fortbildung'
    WHEN 'KRANKHEIT' THEN 'Krankheit'
    ELSE 'Sonstiges'
  END,
  a.grund,
  NOW(),
  NOW()
FROM "TherapistAbsence" a
WHERE NOT EXISTS (
  SELECT 1 FROM "TherapistBlockedTime" b
  WHERE b."therapistId" = a."therapistId"
    AND b."startsAt" = a.von
    AND b."endsAt" = a.bis
    AND b.grund = a.grund
);
