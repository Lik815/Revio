-- Entfernt das Kurs-Feature vollständig (Umkehr von 20260709000000_add_course_extension
-- und 20260711000000_seed_course_categories).
--
-- Enum-Spalten waren TEXT (keine nativen Enum-Typen), daher kein DROP TYPE nötig.
-- Tabellen werden in Kind->Eltern-Reihenfolge gedroppt (FK-sicher).
-- "IF EXISTS" hält die Migration idempotent und portabel (SQLite + PostgreSQL).

DROP TABLE IF EXISTS "CourseEnrollment";
DROP TABLE IF EXISTS "CourseSession";
DROP TABLE IF EXISTS "CourseRun";
DROP TABLE IF EXISTS "Course";
DROP TABLE IF EXISTS "CourseCategory";
