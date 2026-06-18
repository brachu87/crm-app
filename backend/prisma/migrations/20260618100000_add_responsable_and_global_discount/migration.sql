-- AlterTable: add responsable and globalDiscount to Client
ALTER TABLE "Client" ADD COLUMN "responsableName" TEXT;
ALTER TABLE "Client" ADD COLUMN "responsablePhone" TEXT;
ALTER TABLE "Client" ADD COLUMN "globalDiscount" REAL NOT NULL DEFAULT 0;
