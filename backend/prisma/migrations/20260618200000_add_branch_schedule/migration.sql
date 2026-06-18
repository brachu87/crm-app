-- Branch table
CREATE TABLE "Branch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ActivityEmployee junction
CREATE TABLE "ActivityEmployee" (
  "activityId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  PRIMARY KEY ("activityId", "employeeId"),
  CONSTRAINT "ActivityEmployee_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ActivityEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ClassSchedule table
CREATE TABLE "ClassSchedule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "activityId" TEXT NOT NULL,
  "employeeId" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "maxCapacity" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassSchedule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassSchedule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ClassSchedule_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClassSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Add branchId to Employee
ALTER TABLE "Employee" ADD COLUMN "branchId" TEXT REFERENCES "Branch" ("id") ON DELETE SET NULL;

-- Add branchId to Activity
ALTER TABLE "Activity" ADD COLUMN "branchId" TEXT REFERENCES "Branch" ("id") ON DELETE SET NULL;

-- Indexes
CREATE INDEX "Branch_businessId_idx" ON "Branch"("businessId");
CREATE INDEX "ClassSchedule_businessId_idx" ON "ClassSchedule"("businessId");
CREATE INDEX "ClassSchedule_branchId_idx" ON "ClassSchedule"("branchId");
CREATE INDEX "ClassSchedule_activityId_idx" ON "ClassSchedule"("activityId");
CREATE INDEX "Employee_branchId_idx" ON "Employee"("branchId");
CREATE INDEX "Activity_branchId_idx" ON "Activity"("branchId");
