-- AlterTable: add dni to Client
ALTER TABLE "Client" ADD COLUMN "dni" TEXT;

-- CreateTable: ClientNote
CREATE TABLE "ClientNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ClientNote_clientId_idx" ON "ClientNote"("clientId");
