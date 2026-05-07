-- Task pool: fixed recurring + hourly accrual fields, multi links, payment entry linkage.
-- Withdrawn amount is managed by the application (trigger removed).

ALTER TABLE public.task_pool_items
  ADD COLUMN IF NOT EXISTS fixed_budget_mode text NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS recurring_cadence text NULL,
  ADD COLUMN IF NOT EXISTS next_payment_due_at date NULL,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS weekly_hours_cap numeric(12,2) NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS hourly_last_ack_week_monday date NULL,
  ADD COLUMN IF NOT EXISTS github_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_storage_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS initial_document_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.task_pool_items
SET github_links = jsonb_build_array(jsonb_build_object('label', 'GitHub', 'url', github_url))
WHERE github_url IS NOT NULL AND btrim(github_url) <> '' AND github_links = '[]'::jsonb;

UPDATE public.task_pool_items
SET source_storage_urls = jsonb_build_array(jsonb_build_object('label', 'Storage', 'url', source_storage_url))
WHERE source_storage_url IS NOT NULL AND btrim(source_storage_url) <> '' AND source_storage_urls = '[]'::jsonb;

UPDATE public.task_pool_items
SET initial_document_urls = jsonb_build_array(jsonb_build_object('label', 'Document', 'url', initial_document_url))
WHERE initial_document_url IS NOT NULL AND btrim(initial_document_url) <> '' AND initial_document_urls = '[]'::jsonb;

ALTER TABLE public.payment_entries DROP CONSTRAINT IF EXISTS payment_entries_source_kind_check;
ALTER TABLE public.payment_entries
  ADD CONSTRAINT payment_entries_source_kind_check
  CHECK (source_kind IN ('manual', 'task_auto'));

ALTER TABLE public.payment_entries
  ADD COLUMN IF NOT EXISTS pool_item_id uuid REFERENCES public.task_pool_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_entries_pool_item ON public.payment_entries(pool_item_id);

DROP TRIGGER IF EXISTS trg_task_pool_items_compute_withdrawn_amount ON public.task_pool_items;
DROP FUNCTION IF EXISTS public.task_pool_items_compute_withdrawn_amount();
