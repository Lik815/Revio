-- CreateTable
CREATE TABLE "TherapistReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "therapistId" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "bookingRequestId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TherapistReview_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "Therapist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TherapistReview_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TherapistReview_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TherapistReview_bookingRequestId_key" ON "TherapistReview"("bookingRequestId");

-- CreateIndex
CREATE INDEX "TherapistReview_therapistId_status_createdAt_idx" ON "TherapistReview"("therapistId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TherapistReview_patientUserId_idx" ON "TherapistReview"("patientUserId");
