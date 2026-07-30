-- AddColumn
-- Zustimmungs-Gate (Directory-First-Refactor, Paket R1). Nullable, kein Backfill:
-- bleibt leer bei Selbstregistrierung, Pflichtfeld nur beim Operator-Anlegen.
ALTER TABLE "Therapist" ADD COLUMN "consentObtainedAt" DATETIME;
ALTER TABLE "Therapist" ADD COLUMN "consentChannel" TEXT;
ALTER TABLE "Therapist" ADD COLUMN "consentNote" TEXT;
