-- Add ARS currency support to recurring expenses
ALTER TABLE recurring_expenses ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE recurring_expenses ADD COLUMN amount_ars NUMERIC(14,2) DEFAULT NULL;
