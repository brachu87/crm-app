-- AlterTable
ALTER TABLE "Client" ADD COLUMN "birthday" DATETIME;
ALTER TABLE "Client" ADD COLUMN "emergencyContact" TEXT;
ALTER TABLE "Client" ADD COLUMN "emergencyPhone" TEXT;
ALTER TABLE "Client" ADD COLUMN "medicalNotes" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "amountDue" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Enrollment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Enrollment" ("active", "activityId", "amountDue", "clientId", "dueDate", "id", "paymentStatus", "startDate") SELECT "active", "activityId", "amountDue", "clientId", "dueDate", "id", "paymentStatus", "startDate" FROM "Enrollment";
DROP TABLE "Enrollment";
ALTER TABLE "new_Enrollment" RENAME TO "Enrollment";
CREATE INDEX "Enrollment_activityId_idx" ON "Enrollment"("activityId");
CREATE INDEX "Enrollment_clientId_idx" ON "Enrollment"("clientId");
CREATE UNIQUE INDEX "Enrollment_clientId_activityId_key" ON "Enrollment"("clientId", "activityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
