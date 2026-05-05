-- Track when the task/offer was actually received (e.g., Upwork offer date).
ALTER TABLE public.task_pool_items
  ADD COLUMN IF NOT EXISTS task_received_at timestamptz;

-- Backfill existing rows from created_at for consistent filtering/summaries.
UPDATE public.task_pool_items
SET task_received_at = created_at
WHERE task_received_at IS NULL;

ALTER TABLE public.task_pool_items
  ALTER COLUMN task_received_at SET DEFAULT now();
