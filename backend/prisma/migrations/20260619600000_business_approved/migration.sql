ALTER TABLE "Business" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "approvedAt" TIMESTAMP;
-- Aprobar todas las cuentas existentes
UPDATE "Business" SET "approved" = true, "approvedAt" = NOW();
