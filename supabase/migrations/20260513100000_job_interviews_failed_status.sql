-- Allow "failed" when the interview start time has passed without a terminal outcome.
-- RPC marks rows automatically (SECURITY DEFINER so it bypasses admin-only RLS on writes).

ALTER TABLE public.job_interviews
  DROP CONSTRAINT IF EXISTS job_interviews_status_check;

ALTER TABLE public.job_interviews
  ADD CONSTRAINT job_interviews_status_check CHECK (
    status IN ('scheduled', 'in_progress', 'completed', 'offer', 'rejected', 'withdrawn', 'failed')
  );

CREATE OR REPLACE FUNCTION public.mark_past_job_interviews_failed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.job_interviews
  SET status = 'failed',
      updated_at = now()
  WHERE scheduled_at < now()
    AND status IN ('scheduled', 'in_progress');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_past_job_interviews_failed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_past_job_interviews_failed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_past_job_interviews_failed() TO service_role;
