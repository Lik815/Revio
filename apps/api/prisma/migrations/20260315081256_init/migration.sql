-- CreateTable
CREATE TABLE "Therapist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "professionalTitle" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "bio" TEXT,
    "homeVisit" BOOLEAN NOT NULL DEFAULT false,
    "specializations" TEXT NOT NULL,
    "languages" TEXT NOT NULL,
    "certifications" TEXT NOT NULL DEFAULT '',
    "kassenart" TEXT NOT NULL DEFAULT '',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "passwordHash" TEXT,
    "sessionToken" TEXT,
    "photo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Practice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "hours" TEXT,
    "lat" REAL NOT NULL DEFAULT 0,
    "lng" REAL NOT NULL DEFAULT 0,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "adminEmail" TEXT,
    "adminPasswordHash" TEXT,
    "adminSessionToken" TEXT,
    "adminTherapistId" TEXT,
    "description" TEXT,
    "inviteToken" TEXT,
    "logo" TEXT,
    "photos" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Practice_adminTherapistId_fkey" FOREIGN KEY ("adminTherapistId") REFERENCES "Therapist" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "TherapistPracticeLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "initiatedBy" TEXT NOT NULL DEFAULT 'THERAPIST',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TherapistPracticeLink_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TherapistPracticeLink_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Therapist_email_key" ON "Therapist"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Therapist_sessionToken_key" ON "Therapist"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Practice_adminEmail_key" ON "Practice"("adminEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Practice_adminSessionToken_key" ON "Practice"("adminSessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Practice_adminTherapistId_key" ON "Practice"("adminTherapistId");

-- CreateIndex
CREATE UNIQUE INDEX "Practice_inviteToken_key" ON "Practice"("inviteToken");

-- CreateIndex
CREATE INDEX "SearchSuggestion_normalized_idx" ON "SearchSuggestion"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "TherapistPracticeLink_therapistId_practiceId_key" ON "TherapistPracticeLink"("therapistId", "practiceId");
