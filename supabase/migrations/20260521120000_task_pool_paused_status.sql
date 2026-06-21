-- Paused task status: client hold — no new accruals while paused.
ALTER TABLE public.task_pool_items DROP CONSTRAINT IF EXISTS task_pool_status_check;

ALTER TABLE public.task_pool_items
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

ALTER TABLE public.task_pool_items
  ADD CONSTRAINT task_pool_status_check
  CHECK (status IN ('planning', 'active', 'blocked', 'qa', 'paused', 'completed', 'cancelled'));

COMMENT ON COLUMN public.task_pool_items.paused_at IS 'When the task was last set to paused (JST accruals stop from this instant).';
