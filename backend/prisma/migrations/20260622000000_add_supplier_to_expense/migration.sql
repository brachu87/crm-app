ALTER TABLE "Expense" ADD COLUMN "supplierId" TEXT REFERENCES "Supplier"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Expense_supplierId_idx" ON "Expense"("supplierId");
