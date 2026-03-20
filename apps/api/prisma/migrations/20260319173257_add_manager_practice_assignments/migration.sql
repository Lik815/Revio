-- CreateTable
CREATE TABLE "ManagerPracticeAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "managerId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManagerPracticeAssignment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "PracticeManager" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManagerPracticeAssignment_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "practiceId" TEXT,
    "therapistId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PracticeManager_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PracticeManager" ("createdAt", "email", "id", "passwordHash", "practiceId", "sessionToken", "therapistId", "userId") SELECT "createdAt", "email", "id", "passwordHash", "practiceId", "sessionToken", "therapistId", "userId" FROM "PracticeManager";
DROP TABLE "PracticeManager";
ALTER TABLE "new_PracticeManager" RENAME TO "PracticeManager";
CREATE UNIQUE INDEX "PracticeManager_email_key" ON "PracticeManager"("email");
CREATE UNIQUE INDEX "PracticeManager_userId_key" ON "PracticeManager"("userId");
CREATE UNIQUE INDEX "PracticeManager_sessionToken_key" ON "PracticeManager"("sessionToken");
CREATE UNIQUE INDEX "PracticeManager_therapistId_key" ON "PracticeManager"("therapistId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ManagerPracticeAssignment_managerId_practiceId_key" ON "ManagerPracticeAssignment"("managerId", "practiceId");
