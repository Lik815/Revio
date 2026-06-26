-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "BookingRequest" ADD COLUMN "cancelledAt" DATETIME;
