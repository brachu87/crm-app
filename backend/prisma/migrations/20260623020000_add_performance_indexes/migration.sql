CREATE INDEX IF NOT EXISTS "Cuota_paymentStatus_idx" ON "Cuota"("paymentStatus");
CREATE INDEX IF NOT EXISTS "Cuota_period_idx" ON "Cuota"("period");
CREATE INDEX IF NOT EXISTS "Cuota_dueDate_idx" ON "Cuota"("dueDate");
CREATE INDEX IF NOT EXISTS "Payment_date_idx" ON "Payment"("date");
