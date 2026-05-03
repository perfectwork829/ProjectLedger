-- Payment accounts: richer profile fields, Drive link for ID, no password storage.
-- Status: good | disabled (migrates legacy active/inactive).

CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  label text NOT NULL,
  account_identifier text,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'good',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tables that already existed before this migration do not get columns from CREATE TABLE IF NOT EXISTS; ensure core columns.
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS label text;
UPDATE public.payment_accounts
SET label = COALESCE(NULLIF(btrim(label), ''), NULLIF(btrim(provider), ''), 'Payment account')
WHERE label IS NULL OR btrim(label) = '';
UPDATE public.payment_accounts SET label = 'Payment account' WHERE label IS NULL;
ALTER TABLE public.payment_accounts ALTER COLUMN label SET DEFAULT '';
ALTER TABLE public.payment_accounts ALTER COLUMN label SET NOT NULL;

ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS payment_details text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS backup_info text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS zip text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS id_card_drive_url text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS connected_phone text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS purchase_way text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS credentials_note text;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

-- Legacy tables may exist without `status` (CREATE TABLE IF NOT EXISTS above is skipped).
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS status text;

UPDATE public.payment_accounts SET status = 'good' WHERE status IS NULL OR trim(status) = '';

UPDATE public.payment_accounts SET status = 'good' WHERE lower(status) = 'active';
UPDATE public.payment_accounts SET status = 'disabled' WHERE lower(status) = 'inactive';
UPDATE public.payment_accounts SET status = 'good' WHERE status NOT IN ('good', 'disabled');

ALTER TABLE public.payment_accounts ALTER COLUMN status SET DEFAULT 'good';
ALTER TABLE public.payment_accounts ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_accounts_purchase_way_check'
  ) THEN
    ALTER TABLE public.payment_accounts
      ADD CONSTRAINT payment_accounts_purchase_way_check
      CHECK (purchase_way IS NULL OR purchase_way IN ('broker', 'real_man'));
  END IF;
END $$;

ALTER TABLE public.payment_accounts DROP CONSTRAINT IF EXISTS payment_accounts_status_check;
ALTER TABLE public.payment_accounts ADD CONSTRAINT payment_accounts_status_check
  CHECK (status IN ('good', 'disabled'));

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_accounts' AND policyname = 'payment_accounts_select_own_or_admin'
  ) THEN
    CREATE POLICY payment_accounts_select_own_or_admin ON public.payment_accounts
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_accounts' AND policyname = 'payment_accounts_insert_own_or_admin'
  ) THEN
    CREATE POLICY payment_accounts_insert_own_or_admin ON public.payment_accounts
      FOR INSERT TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_accounts' AND policyname = 'payment_accounts_update_own_or_admin'
  ) THEN
    CREATE POLICY payment_accounts_update_own_or_admin ON public.payment_accounts
      FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      )
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_accounts' AND policyname = 'payment_accounts_delete_own_or_admin'
  ) THEN
    CREATE POLICY payment_accounts_delete_own_or_admin ON public.payment_accounts
      FOR DELETE TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;
END $$;
