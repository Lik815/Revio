-- AddColumn
-- Adress-Einzelfelder für Practice (nullable, kein Backfill): Voraussetzung
-- für die "volle Adresse ist Pflicht"-Regel, siehe
-- docs/praxis-pflichtdaten-umsetzung.md.
ALTER TABLE "Practice" ADD COLUMN "street" TEXT;
ALTER TABLE "Practice" ADD COLUMN "houseNumber" TEXT;
ALTER TABLE "Practice" ADD COLUMN "postalCode" TEXT;
