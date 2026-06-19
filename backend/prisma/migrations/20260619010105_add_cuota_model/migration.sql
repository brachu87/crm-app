/*
  Warnings:

  - You are about to drop the column `dueDate` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentStatus` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `enrollmentId` on the `Payment` table. All the data in the column will be lost.
  - Added the required column `cuotaId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Cuota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amountDue" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cuota_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AccountMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" TEXT NOT NULL,
    CONSTRAINT "AccountMovement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AccountMovement" ("amount", "businessId", "clientId", "createdAt", "date", "description", "id", "type") SELECT "amount", "businessId", "clientId", "createdAt", "date", "description", "id", "type" FROM "AccountMovement";
DROP TABLE "AccountMovement";
ALTER TABLE "new_AccountMovement" RENAME TO "AccountMovement";
CREATE INDEX "AccountMovement_clientId_idx" ON "AccountMovement"("clientId");
CREATE INDEX "AccountMovement_businessId_idx" ON "AccountMovement"("businessId");
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "capacity" INTEGER,
    "schedule" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Activity_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("active", "branchId", "businessId", "capacity", "createdAt", "description", "id", "name", "price", "schedule") SELECT "active", "branchId", "businessId", "capacity", "createdAt", "description", "id", "name", "price", "schedule" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_businessId_idx" ON "Activity"("businessId");
CREATE INDEX "Activity_branchId_idx" ON "Activity"("branchId");
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "salary" REAL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("active", "branchId", "businessId", "createdAt", "email", "id", "name", "notes", "phone", "role", "salary", "startDate") SELECT "active", "branchId", "businessId", "createdAt", "email", "id", "name", "notes", "phone", "role", "salary", "startDate" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE INDEX "Employee_businessId_idx" ON "Employee"("businessId");
CREATE INDEX "Employee_branchId_idx" ON "Employee"("branchId");
CREATE TABLE "new_Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "amountDue" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bonificada" BOOLEAN NOT NULL DEFAULT false,
    "bonificadaHasta" DATETIME,
    CONSTRAINT "Enrollment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Enrollment" ("active", "activityId", "amountDue", "bonificada", "bonificadaHasta", "clientId", "discount", "id", "startDate") SELECT "active", "activityId", "amountDue", "bonificada", "bonificadaHasta", "clientId", "discount", "id", "startDate" FROM "Enrollment";
DROP TABLE "Enrollment";
ALTER TABLE "new_Enrollment" RENAME TO "Enrollment";
CREATE INDEX "Enrollment_activityId_idx" ON "Enrollment"("activityId");
CREATE INDEX "Enrollment_clientId_idx" ON "Enrollment"("clientId");
CREATE UNIQUE INDEX "Enrollment_clientId_activityId_key" ON "Enrollment"("clientId", "activityId");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cuotaId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT,
    CONSTRAINT "Payment_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "Cuota" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "date", "id", "method") SELECT "amount", "date", "id", "method" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_cuotaId_idx" ON "Payment"("cuotaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Cuota_enrollmentId_idx" ON "Cuota"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Cuota_enrollmentId_period_key" ON "Cuota"("enrollmentId", "period");
