-- CreateTable
CREATE TABLE "CertificationOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CertificationOption_key_key" ON "CertificationOption"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CertificationOption_label_key" ON "CertificationOption"("label");

-- CreateIndex
CREATE INDEX "CertificationOption_isActive_sortOrder_label_idx" ON "CertificationOption"("isActive", "sortOrder", "label");
