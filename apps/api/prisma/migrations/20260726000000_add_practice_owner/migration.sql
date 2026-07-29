-- AddColumn
-- Owner-Relation (Directory-First-Refactor, Paket P2). Nullable, kein Backfill:
-- bestehende Praxen bleiben unbeansprucht (ownerId IS NULL) bis zum ersten Claim.
ALTER TABLE "Practice" ADD COLUMN "ownerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Practice_ownerId_key" ON "Practice"("ownerId");
