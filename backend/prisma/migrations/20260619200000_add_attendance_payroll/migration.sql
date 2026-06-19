-- Add payType and payFrequency to Employee
ALTER TABLE "Employee" ADD COLUMN "payType" TEXT NOT NULL DEFAULT 'hourly';
ALTER TABLE "Employee" ADD COLUMN "payFrequency" TEXT NOT NULL DEFAULT 'monthly';

-- Create Attendance table
CREATE TABLE "Attendance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "date" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'present',
  "hoursWorked" REAL NOT NULL DEFAULT 0,
  "notes" TEXT,
  "classScheduleId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attendance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Attendance_classScheduleId_fkey" FOREIGN KEY ("classScheduleId") REFERENCES "ClassSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Attendance_businessId_idx" ON "Attendance"("businessId");
CREATE INDEX "Attendance_employeeId_idx" ON "Attendance"("employeeId");

-- Create PayrollRecord table
CREATE TABLE "PayrollRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "periodStart" DATETIME NOT NULL,
  "periodEnd" DATETIME NOT NULL,
  "totalHours" REAL NOT NULL DEFAULT 0,
  "payRate" REAL NOT NULL,
  "payType" TEXT NOT NULL,
  "totalAmount" REAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paidAt" DATETIME,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollRecord_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PayrollRecord_businessId_idx" ON "PayrollRecord"("businessId");
CREATE INDEX "PayrollRecord_employeeId_idx" ON "PayrollRecord"("employeeId");
