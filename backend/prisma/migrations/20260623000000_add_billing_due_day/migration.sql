-- AlterTable: add billingDueDay to Activity (nullable, safe to run on existing data)
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "billingDueDay" INTEGER;
