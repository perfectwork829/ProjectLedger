-- Fixed-price contracts payable by milestone: gross amounts + confirmation timestamps in JSON.

ALTER TABLE public.task_pool_items
  ADD COLUMN IF NOT EXISTS milestones_json jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.task_pool_items.milestones_json IS
  'When fixed_budget_mode = milestone: [{ id, title, amount, confirmed_at }]. budget_amount should equal sum(amount).';
