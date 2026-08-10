-- AddColumn
-- Praxis-Zusatzdaten (nullable/mit Default, kein Backfill), siehe
-- docs/praxis-zusatzdaten-umsetzung.md, Teil B.1.
ALTER TABLE "Practice" ADD COLUMN "email" TEXT;
ALTER TABLE "Practice" ADD COLUMN "website" TEXT;
ALTER TABLE "Practice" ADD COLUMN "wheelchairAccessible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Practice" ADD COLUMN "parkingAvailable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Practice" ADD COLUMN "publicTransportNote" TEXT;
