-- Free task status: unpaid maintenance — no accruals while status is free.
ALTER TABLE public.task_pool_items DROP CONSTRAINT IF EXISTS task_pool_status_check;

ALTER TABLE public.task_pool_items
  ADD COLUMN IF NOT EXISTS free_at timestamptz;

ALTER TABLE public.task_pool_items
  ADD CONSTRAINT task_pool_status_check
  CHECK (status IN ('planning', 'active', 'blocked', 'qa', 'paused', 'free', 'completed', 'cancelled'));

COMMENT ON COLUMN public.task_pool_items.free_at IS 'When the task was last set to free maintenance (JST accruals stop from this instant).';
