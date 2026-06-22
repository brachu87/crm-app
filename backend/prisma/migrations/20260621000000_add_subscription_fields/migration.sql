ALTER TABLE "Business" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "Business" ADD COLUMN "subscriptionExpires" DATETIME;
