-- Task pool finance tracking and auto withdrawn amount calculation.

ALTER TABLE public.task_pool_items
  ADD COLUMN IF NOT EXISTS upwork_connection_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS convert_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upwork_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdraw_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawn_amount numeric(12,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.task_pool_items_compute_withdrawn_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_real_budget numeric(12,2);
BEGIN
  v_real_budget := COALESCE(NEW.budget_amount, 0);
  NEW.withdrawn_amount := v_real_budget
    - (
      COALESCE(NEW.upwork_connection_fee, 0)
      + COALESCE(NEW.convert_fee, 0)
      + COALESCE(NEW.transfer_fee, 0)
      + COALESCE(NEW.upwork_fee, 0)
      + COALESCE(NEW.withdraw_fee, 0)
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_pool_items_compute_withdrawn_amount ON public.task_pool_items;

CREATE TRIGGER trg_task_pool_items_compute_withdrawn_amount
BEFORE INSERT OR UPDATE OF budget_amount, upwork_connection_fee, convert_fee, transfer_fee, upwork_fee, withdraw_fee
ON public.task_pool_items
FOR EACH ROW
EXECUTE FUNCTION public.task_pool_items_compute_withdrawn_amount();

-- Backfill existing rows.
UPDATE public.task_pool_items
SET withdrawn_amount = COALESCE(budget_amount, 0)
  - (
    COALESCE(upwork_connection_fee, 0)
    + COALESCE(convert_fee, 0)
    + COALESCE(transfer_fee, 0)
    + COALESCE(upwork_fee, 0)
    + COALESCE(withdraw_fee, 0)
  );
