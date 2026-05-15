-- Billable hours for the most recently confirmed hourly week (enables edit + fee recalculation).

ALTER TABLE public.task_pool_items
  ADD COLUMN IF NOT EXISTS hourly_last_billable_hours numeric(12,2) NULL;

COMMENT ON COLUMN public.task_pool_items.hourly_last_billable_hours IS 'Hours billed in the last confirmed JST weekly accrual; used to adjust withdrawn when fees change.';
