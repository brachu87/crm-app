-- Make serviceId nullable
PRAGMA foreign_keys=OFF;

CREATE TABLE "_Appointment_new" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "businessId"    TEXT NOT NULL,
  "serviceId"     TEXT,
  "clientId"      TEXT NOT NULL,
  "employeeId"    TEXT,
  "branchId"      TEXT,
  "description"   TEXT,
  "date"          TEXT NOT NULL,
  "startTime"     TEXT NOT NULL DEFAULT '',
  "endTime"       TEXT NOT NULL DEFAULT '',
  "price"         REAL NOT NULL DEFAULT 0,
  "status"        TEXT NOT NULL DEFAULT 'scheduled',
  "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
  "paidAt"        DATETIME,
  "notes"         TEXT,
  "isQuickWork"   BOOLEAN NOT NULL DEFAULT 0,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appointment_businessId_fkey"  FOREIGN KEY ("businessId")  REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Appointment_serviceId_fkey"   FOREIGN KEY ("serviceId")   REFERENCES "Service"("id")  ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Appointment_clientId_fkey"    FOREIGN KEY ("clientId")    REFERENCES "Client"("id")   ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Appointment_employeeId_fkey"  FOREIGN KEY ("employeeId")  REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Appointment_branchId_fkey"    FOREIGN KEY ("branchId")    REFERENCES "Branch"("id")   ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "_Appointment_new"
  ("id","businessId","serviceId","clientId","employeeId","branchId","date","startTime","endTime","price","status","paymentStatus","paidAt","notes","createdAt","updatedAt")
SELECT "id","businessId","serviceId","clientId","employeeId","branchId","date","startTime","endTime","price","status","paymentStatus","paidAt","notes","createdAt","updatedAt"
FROM "Appointment";

DROP TABLE "Appointment";
ALTER TABLE "_Appointment_new" RENAME TO "Appointment";

CREATE INDEX "Appointment_businessId_idx"  ON "Appointment"("businessId");
CREATE INDEX "Appointment_serviceId_idx"   ON "Appointment"("serviceId");
CREATE INDEX "Appointment_clientId_idx"    ON "Appointment"("clientId");
CREATE INDEX "Appointment_employeeId_idx"  ON "Appointment"("employeeId");

PRAGMA foreign_keys=ON;
