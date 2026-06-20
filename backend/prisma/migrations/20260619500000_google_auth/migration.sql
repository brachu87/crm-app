-- Allow null password for Google OAuth users
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;
