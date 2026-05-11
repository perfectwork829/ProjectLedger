-- Manual order within the same priority band (lower = earlier in list).

ALTER TABLE public.task_pool_items
  ADD COLUMN IF NOT EXISTS priority_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS task_pool_items_priority_order_idx
  ON public.task_pool_items (priority, priority_order);
