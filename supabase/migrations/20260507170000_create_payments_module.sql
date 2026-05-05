-- Payments module: manual incoming/outgoing ledger; task-derived rows are computed in app.

CREATE TABLE IF NOT EXISTS public.payment_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('incoming', 'outgoing')),
  category text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  note text NULL,
  source_kind text NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_entries_occurred_at ON public.payment_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_entries_type ON public.payment_entries(entry_type, occurred_at DESC);

ALTER TABLE public.payment_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_entries' AND policyname = 'payment_entries_select_authenticated'
  ) THEN
    CREATE POLICY payment_entries_select_authenticated ON public.payment_entries
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_entries' AND policyname = 'payment_entries_admin_insert'
  ) THEN
    CREATE POLICY payment_entries_admin_insert ON public.payment_entries
      FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_entries' AND policyname = 'payment_entries_admin_update'
  ) THEN
    CREATE POLICY payment_entries_admin_update ON public.payment_entries
      FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payment_entries' AND policyname = 'payment_entries_admin_delete'
  ) THEN
    CREATE POLICY payment_entries_admin_delete ON public.payment_entries
      FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
  END IF;
END $$;
