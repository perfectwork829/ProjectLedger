-- Extra fields for non-marketplace accounts (Gmail, Teams, etc.)
ALTER TABLE freelancing_accounts ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE freelancing_accounts ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE freelancing_accounts ADD COLUMN IF NOT EXISTS backup_codes text;
ALTER TABLE freelancing_accounts ADD COLUMN IF NOT EXISTS authenticator_enabled boolean DEFAULT false;
ALTER TABLE freelancing_accounts ADD COLUMN IF NOT EXISTS screenshot_urls jsonb DEFAULT '[]'::jsonb;
