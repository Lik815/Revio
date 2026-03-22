-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Practice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "hours" TEXT,
    "lat" REAL NOT NULL DEFAULT 0,
    "lng" REAL NOT NULL DEFAULT 0,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "description" TEXT,
    "homeVisit" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT,
    "logo" TEXT,
    "photos" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Practice" ("address", "city", "createdAt", "description", "hours", "id", "inviteToken", "lat", "lng", "logo", "name", "phone", "photos", "reviewStatus", "updatedAt") SELECT "address", "city", "createdAt", "description", "hours", "id", "inviteToken", "lat", "lng", "logo", "name", "phone", "photos", "reviewStatus", "updatedAt" FROM "Practice";
DROP TABLE "Practice";
ALTER TABLE "new_Practice" RENAME TO "Practice";
CREATE UNIQUE INDEX "Practice_inviteToken_key" ON "Practice"("inviteToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
