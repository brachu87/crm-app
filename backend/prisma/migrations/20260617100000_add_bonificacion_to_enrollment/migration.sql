-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN "bonificada" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Enrollment" ADD COLUMN "bonificadaHasta" DATETIME;
