-- Birthday and structured identity document image URLs (gallery per type)
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS birthday date;

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS identity_documents jsonb DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS identity_documents jsonb DEFAULT '{}'::jsonb;
