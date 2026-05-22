-- AlterTable
ALTER TABLE "Therapist" ADD COLUMN "sessionTokenExpiresAt" DATETIME;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionTokenExpiresAt" DATETIME;
