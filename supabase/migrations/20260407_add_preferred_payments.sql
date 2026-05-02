ALTER TABLE personnel ADD COLUMN IF NOT EXISTS preferred_payments text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_payments text;
