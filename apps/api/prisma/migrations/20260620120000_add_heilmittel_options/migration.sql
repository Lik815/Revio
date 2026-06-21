-- AlterTable
ALTER TABLE "Therapist" ADD COLUMN "heilmittel" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "HeilmittelOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "HeilmittelOption_key_key" ON "HeilmittelOption"("key");

-- CreateIndex
CREATE UNIQUE INDEX "HeilmittelOption_label_key" ON "HeilmittelOption"("label");

-- CreateIndex
CREATE INDEX "HeilmittelOption_isActive_sortOrder_label_idx" ON "HeilmittelOption"("isActive", "sortOrder", "label");
