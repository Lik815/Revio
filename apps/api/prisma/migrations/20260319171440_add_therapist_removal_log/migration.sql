-- CreateTable
CREATE TABLE "TherapistRemovalLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PracticeManager" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "passwordHash" TEXT NOT NULL,
    "sessionToken" TEXT,
    "practiceId" TEXT NOT NULL,
    "therapistId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PracticeManager_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeManager_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PracticeManager" ("createdAt", "email", "id", "passwordHash", "practiceId", "sessionToken", "therapistId", "userId") SELECT "createdAt", "email", "id", "passwordHash", "practiceId", "sessionToken", "therapistId", "userId" FROM "PracticeManager";
DROP TABLE "PracticeManager";
ALTER TABLE "new_PracticeManager" RENAME TO "PracticeManager";
CREATE UNIQUE INDEX "PracticeManager_email_key" ON "PracticeManager"("email");
CREATE UNIQUE INDEX "PracticeManager_userId_key" ON "PracticeManager"("userId");
CREATE UNIQUE INDEX "PracticeManager_sessionToken_key" ON "PracticeManager"("sessionToken");
CREATE UNIQUE INDEX "PracticeManager_practiceId_key" ON "PracticeManager"("practiceId");
CREATE UNIQUE INDEX "PracticeManager_therapistId_key" ON "PracticeManager"("therapistId");
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
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "passwordHash" TEXT,
    "sessionToken" TEXT,
    "photo" TEXT,
    "invitedByPracticeId" TEXT,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'none',
    "visibilityPreference" TEXT NOT NULL DEFAULT 'hidden',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Therapist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Therapist" ("availability", "bio", "certifications", "city", "createdAt", "email", "fullName", "homeVisit", "id", "invitedByPracticeId", "isPublished", "isVisible", "kassenart", "languages", "onboardingStatus", "passwordHash", "photo", "professionalTitle", "reviewStatus", "sessionToken", "specializations", "updatedAt", "userId", "visibilityPreference") SELECT "availability", "bio", "certifications", "city", "createdAt", "email", "fullName", "homeVisit", "id", "invitedByPracticeId", "isPublished", "isVisible", "kassenart", "languages", "onboardingStatus", "passwordHash", "photo", "professionalTitle", "reviewStatus", "sessionToken", "specializations", "updatedAt", "userId", "visibilityPreference" FROM "Therapist";
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "passwordHash", "role", "sessionToken", "updatedAt") SELECT "createdAt", "email", "id", "passwordHash", "role", "sessionToken", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_sessionToken_key" ON "User"("sessionToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
