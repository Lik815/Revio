-- CreateTable
CREATE TABLE "AdminAccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "query" TEXT,
    "targetUserId" TEXT
);

-- CreateIndex
CREATE INDEX "AdminAccessLog_createdAt_idx" ON "AdminAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAccessLog_targetUserId_idx" ON "AdminAccessLog"("targetUserId");
