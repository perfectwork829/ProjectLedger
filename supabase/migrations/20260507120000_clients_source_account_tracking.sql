-- Track where a client came from and which specific account was used.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS source_account_id uuid,
  ADD COLUMN IF NOT EXISTS source_account_label text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_source_account_id_fkey'
      AND conrelid = 'public.clients'::regclass
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_source_account_id_fkey
      FOREIGN KEY (source_account_id)
      REFERENCES public.freelancing_accounts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_source_account_id ON public.clients(source_account_id);
