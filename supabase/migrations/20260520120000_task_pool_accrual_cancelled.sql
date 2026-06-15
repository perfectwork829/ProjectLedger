-- Allow skipping an accrual period without confirming payment (removed from confirm list).

ALTER TABLE public.task_pool_accrual_periods
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_task_pool_accrual_periods_cancelled
  ON public.task_pool_accrual_periods (pool_item_id, cancelled_at)
  WHERE cancelled_at IS NOT NULL;
