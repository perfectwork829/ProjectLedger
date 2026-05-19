-- Accrual periods: expected payment windows per task (hourly weeks, installments, fixed project, milestones).

ALTER TABLE public.task_pool_items
  ADD COLUMN IF NOT EXISTS finished_at timestamptz NULL;

CREATE TABLE IF NOT EXISTS public.task_pool_accrual_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_item_id uuid NOT NULL REFERENCES public.task_pool_items(id) ON DELETE CASCADE,
  period_kind text NOT NULL,
  period_key text NOT NULL,
  label text NOT NULL DEFAULT '',
  week_monday date NULL,
  period_end_ymd date NOT NULL,
  due_confirm_on date NOT NULL,
  tracked_hours numeric(12,2) NULL,
  billable_hours numeric(12,2) NULL,
  payment_received boolean NULL,
  gross_amount numeric(12,2) NULL,
  net_amount numeric(12,2) NULL,
  milestone_id text NULL,
  confirmed_at timestamptz NULL,
  payment_entry_id uuid REFERENCES public.payment_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_pool_accrual_periods_kind_check CHECK (
    period_kind IN ('hourly_week', 'recurring', 'fixed_project', 'milestone')
  ),
  CONSTRAINT task_pool_accrual_periods_pool_key_unique UNIQUE (pool_item_id, period_kind, period_key)
);

CREATE INDEX IF NOT EXISTS idx_task_pool_accrual_periods_pool ON public.task_pool_accrual_periods (pool_item_id);
CREATE INDEX IF NOT EXISTS idx_task_pool_accrual_periods_due ON public.task_pool_accrual_periods (due_confirm_on, confirmed_at);

ALTER TABLE public.task_pool_accrual_periods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_pool_accrual_periods' AND policyname = 'task_pool_accrual_periods_select_authenticated'
  ) THEN
    CREATE POLICY task_pool_accrual_periods_select_authenticated ON public.task_pool_accrual_periods
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_pool_accrual_periods' AND policyname = 'task_pool_accrual_periods_admin_write'
  ) THEN
    CREATE POLICY task_pool_accrual_periods_admin_write ON public.task_pool_accrual_periods
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;
END $$;
