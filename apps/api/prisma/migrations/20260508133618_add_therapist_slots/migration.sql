/*
  Warnings:

  - You are about to drop the `email_verification_token` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `password_reset_token` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `patient_profile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refresh_token` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `therapist_profile_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_v2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `emailOtpCode` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailOtpExpiresAt` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "email_verification_token_expires_at_idx";

-- DropIndex
DROP INDEX "email_verification_token_user_id_idx";

-- DropIndex
DROP INDEX "email_verification_token_token_hash_key";

-- DropIndex
DROP INDEX "password_reset_token_expires_at_idx";

-- DropIndex
DROP INDEX "password_reset_token_user_id_idx";

-- DropIndex
DROP INDEX "password_reset_token_token_hash_key";

-- DropIndex
DROP INDEX "patient_profile_user_id_key";

-- DropIndex
DROP INDEX "refresh_token_revoked_at_idx";

-- DropIndex
DROP INDEX "refresh_token_expires_at_idx";

-- DropIndex
DROP INDEX "refresh_token_user_id_idx";

-- DropIndex
DROP INDEX "refresh_token_token_hash_key";

-- DropIndex
DROP INDEX "therapist_profile_v2_user_id_key";

-- DropIndex
DROP INDEX "user_v2_email_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "email_verification_token";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "password_reset_token";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "patient_profile";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "refresh_token";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "therapist_profile_v2";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "user_v2";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "TherapistSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 20,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TherapistSlot_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BookingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "patientUserId" TEXT,
    "slotId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "patientName" TEXT NOT NULL,
    "patientEmail" TEXT,
    "patientPhone" TEXT,
    "preferredDays" TEXT NOT NULL DEFAULT '',
    "preferredTimeWindows" TEXT NOT NULL DEFAULT '',
    "message" TEXT,
    "declinedReason" TEXT,
    "consentAcceptedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseDueAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    "confirmedSlotAt" DATETIME,
    CONSTRAINT "BookingRequest_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingRequest_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookingRequest_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TherapistSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BookingRequest" ("confirmedSlotAt", "consentAcceptedAt", "createdAt", "declinedReason", "id", "message", "patientEmail", "patientName", "patientPhone", "patientUserId", "preferredDays", "preferredTimeWindows", "respondedAt", "responseDueAt", "status", "therapistId") SELECT "confirmedSlotAt", "consentAcceptedAt", "createdAt", "declinedReason", "id", "message", "patientEmail", "patientName", "patientPhone", "patientUserId", "preferredDays", "preferredTimeWindows", "respondedAt", "responseDueAt", "status", "therapistId" FROM "BookingRequest";
DROP TABLE "BookingRequest";
ALTER TABLE "new_BookingRequest" RENAME TO "BookingRequest";
CREATE UNIQUE INDEX "BookingRequest_slotId_key" ON "BookingRequest"("slotId");
CREATE INDEX "BookingRequest_therapistId_status_createdAt_idx" ON "BookingRequest"("therapistId", "status", "createdAt");
CREATE INDEX "BookingRequest_patientUserId_status_createdAt_idx" ON "BookingRequest"("patientUserId", "status", "createdAt");
CREATE TABLE "new_Therapist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "professionalTitle" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "bio" TEXT,
    "homeVisit" BOOLEAN NOT NULL DEFAULT false,
    "isFreelancer" BOOLEAN NOT NULL DEFAULT true,
    "specializations" TEXT NOT NULL,
    "languages" TEXT NOT NULL,
    "certifications" TEXT NOT NULL DEFAULT '',
    "kassenart" TEXT NOT NULL DEFAULT '',
    "availability" TEXT NOT NULL DEFAULT '',
    "serviceRadiusKm" REAL,
    "homeLat" REAL NOT NULL DEFAULT 0,
    "homeLng" REAL NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "passwordHash" TEXT,
    "sessionToken" TEXT,
    "photo" TEXT,
    "expoPushToken" TEXT,
    "invitedByPracticeId" TEXT,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'none',
    "visibilityPreference" TEXT NOT NULL DEFAULT 'hidden',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "bookingMode" TEXT NOT NULL DEFAULT 'DIRECTORY_ONLY',
    "nextFreeSlotAt" DATETIME,
    "postalCode" TEXT,
    "street" TEXT,
    "houseNumber" TEXT,
    "locationPrecision" TEXT NOT NULL DEFAULT 'approximate',
    "latitude" REAL,
    "longitude" REAL,
    "taxRegistrationStatus" TEXT,
    "healthAuthorityStatus" TEXT,
    "complianceUpdatedAt" DATETIME,
    "gender" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Therapist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Therapist" ("availability", "bio", "bookingMode", "certifications", "city", "complianceUpdatedAt", "createdAt", "email", "expoPushToken", "fullName", "gender", "healthAuthorityStatus", "homeLat", "homeLng", "homeVisit", "houseNumber", "id", "invitedByPracticeId", "isFreelancer", "isPublished", "isVisible", "kassenart", "languages", "latitude", "locationPrecision", "longitude", "nextFreeSlotAt", "onboardingStatus", "passwordHash", "photo", "postalCode", "professionalTitle", "reviewStatus", "serviceRadiusKm", "sessionToken", "specializations", "street", "taxRegistrationStatus", "updatedAt", "userId", "visibilityPreference") SELECT "availability", "bio", "bookingMode", "certifications", "city", "complianceUpdatedAt", "createdAt", "email", "expoPushToken", "fullName", "gender", "healthAuthorityStatus", "homeLat", "homeLng", "homeVisit", "houseNumber", "id", "invitedByPracticeId", "isFreelancer", "isPublished", "isVisible", "kassenart", "languages", "latitude", "locationPrecision", "longitude", "nextFreeSlotAt", "onboardingStatus", "passwordHash", "photo", "postalCode", "professionalTitle", "reviewStatus", "serviceRadiusKm", "sessionToken", "specializations", "street", "taxRegistrationStatus", "updatedAt", "userId", "visibilityPreference" FROM "Therapist";
DROP TABLE "Therapist";
ALTER TABLE "new_Therapist" RENAME TO "Therapist";
CREATE UNIQUE INDEX "Therapist_email_key" ON "Therapist"("email");
CREATE UNIQUE INDEX "Therapist_userId_key" ON "Therapist"("userId");
CREATE UNIQUE INDEX "Therapist_sessionToken_key" ON "Therapist"("sessionToken");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "sessionToken" TEXT,
    "role" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "emailVerificationToken" TEXT,
    "emailVerifiedAt" DATETIME,
    "requiresEmailVerification" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetToken" TEXT,
    "passwordResetExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerificationToken", "emailVerifiedAt", "firstName", "id", "lastName", "passwordHash", "passwordResetExpiresAt", "passwordResetToken", "requiresEmailVerification", "role", "sessionToken", "updatedAt") SELECT "createdAt", "email", "emailVerificationToken", "emailVerifiedAt", "firstName", "id", "lastName", "passwordHash", "passwordResetExpiresAt", "passwordResetToken", "requiresEmailVerification", "role", "sessionToken", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_sessionToken_key" ON "User"("sessionToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TherapistSlot_therapistId_status_startsAt_idx" ON "TherapistSlot"("therapistId", "status", "startsAt");
