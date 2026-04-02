-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Therapist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "professionalTitle" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "bio" TEXT,
    "homeVisit" BOOLEAN NOT NULL DEFAULT false,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Therapist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Therapist" ("availability", "bio", "certifications", "city", "createdAt", "email", "expoPushToken", "fullName", "homeVisit", "id", "invitedByPracticeId", "isPublished", "isVisible", "kassenart", "languages", "onboardingStatus", "passwordHash", "photo", "professionalTitle", "reviewStatus", "sessionToken", "specializations", "updatedAt", "userId", "visibilityPreference") SELECT "availability", "bio", "certifications", "city", "createdAt", "email", "expoPushToken", "fullName", "homeVisit", "id", "invitedByPracticeId", "isPublished", "isVisible", "kassenart", "languages", "onboardingStatus", "passwordHash", "photo", "professionalTitle", "reviewStatus", "sessionToken", "specializations", "updatedAt", "userId", "visibilityPreference" FROM "Therapist";
DROP TABLE "Therapist";
ALTER TABLE "new_Therapist" RENAME TO "Therapist";
CREATE UNIQUE INDEX "Therapist_email_key" ON "Therapist"("email");
CREATE UNIQUE INDEX "Therapist_userId_key" ON "Therapist"("userId");
CREATE UNIQUE INDEX "Therapist_sessionToken_key" ON "Therapist"("sessionToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
