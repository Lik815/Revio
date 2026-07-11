-- AlterTable: Auto-Accept Einstellungen für Therapeuten
ALTER TABLE "Therapist" ADD COLUMN "autoAcceptEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Therapist" ADD COLUMN "autoAcceptSingle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Therapist" ADD COLUMN "autoAcceptSeries" BOOLEAN NOT NULL DEFAULT false;
