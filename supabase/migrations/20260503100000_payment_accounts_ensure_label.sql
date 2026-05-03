-- Supabase/PostgREST error: "could not find the 'label' column of 'payment_accounts' in the schema cache"
-- when the table was created by an older schema and `CREATE TABLE IF NOT EXISTS` never added `label`.

ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS label text;

UPDATE public.payment_accounts
SET label = COALESCE(NULLIF(btrim(label), ''), NULLIF(btrim(provider), ''), 'Payment account')
WHERE label IS NULL OR btrim(label) = '';

UPDATE public.payment_accounts SET label = 'Payment account' WHERE label IS NULL;

ALTER TABLE public.payment_accounts ALTER COLUMN label SET DEFAULT '';
ALTER TABLE public.payment_accounts ALTER COLUMN label SET NOT NULL;
