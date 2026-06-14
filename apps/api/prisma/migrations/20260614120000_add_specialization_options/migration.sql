CREATE TABLE "SpecializationOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "SpecializationOption_key_key" ON "SpecializationOption"("key");
CREATE UNIQUE INDEX "SpecializationOption_label_key" ON "SpecializationOption"("label");
CREATE INDEX "SpecializationOption_isActive_sortOrder_label_idx" ON "SpecializationOption"("isActive", "sortOrder", "label");
