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
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
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
    "lat" REAL NOT NULL DEFAULT 0,
    "lng" REAL NOT NULL DEFAULT 0,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TherapistPracticeLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TherapistPracticeLink_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TherapistPracticeLink_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Therapist_email_key" ON "Therapist"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TherapistPracticeLink_therapistId_practiceId_key" ON "TherapistPracticeLink"("therapistId", "practiceId");
