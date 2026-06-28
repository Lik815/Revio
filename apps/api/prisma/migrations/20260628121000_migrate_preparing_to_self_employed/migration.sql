-- Data migration: PREPARING is no longer a selectable employment status.
-- Migrate any existing PREPARING therapists to SELF_EMPLOYED. The enum value is
-- intentionally KEPT in the schema for now (defensive gates remain as a safety
-- net); only the user-facing selection paths were removed.
UPDATE "Therapist" SET "employmentStatus" = 'SELF_EMPLOYED' WHERE "employmentStatus" = 'PREPARING';
