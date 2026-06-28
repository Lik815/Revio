-- Practice-as-account: additive only. No table rebuilds, no touching legacy
-- tables. SQLite stores the Role enum as TEXT, so adding `practice_admin` needs
-- no DDL here.

-- AlterTable: Therapist — free-text practice name fallback
ALTER TABLE "Therapist" ADD COLUMN "practiceNameText" TEXT;

-- AlterTable: Practice — practice-as-account fields (all nullable or defaulted
-- so existing practices created via therapist registration keep working)
ALTER TABLE "Practice" ADD COLUMN "ownerUserId" TEXT REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Practice" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Practice" ADD COLUMN "email" TEXT;
ALTER TABLE "Practice" ADD COLUMN "website" TEXT;
ALTER TABLE "Practice" ADD COLUMN "specialties" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Practice" ADD COLUMN "services" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Practice" ADD COLUMN "openingHours" TEXT;
ALTER TABLE "Practice" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: Practice.ownerUserId
CREATE INDEX "Practice_ownerUserId_idx" ON "Practice"("ownerUserId");

-- CreateTable: UserFavoritePractice
CREATE TABLE "UserFavoritePractice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFavoritePractice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserFavoritePractice_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: UserFavoritePractice
CREATE INDEX "UserFavoritePractice_userId_idx" ON "UserFavoritePractice"("userId");
CREATE UNIQUE INDEX "UserFavoritePractice_userId_practiceId_key" ON "UserFavoritePractice"("userId", "practiceId");
