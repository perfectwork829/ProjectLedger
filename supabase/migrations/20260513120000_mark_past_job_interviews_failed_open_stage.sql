-- Align auto-fail with list UI: use the first incomplete stage's scheduled_at when set, else the main interview slot.
-- Skip interviews that have stages but none open (e.g. pipeline already completed).

CREATE OR REPLACE FUNCTION public.mark_past_job_interviews_failed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.job_interviews ji
  SET status = 'failed',
      updated_at = now()
  WHERE ji.status IN ('scheduled', 'in_progress')
    AND (
      (
        NOT EXISTS (SELECT 1 FROM public.job_interview_stages s WHERE s.interview_id = ji.id)
        AND ji.scheduled_at < now()
      )
      OR
      (
        EXISTS (
          SELECT 1
          FROM public.job_interview_stages s
          WHERE s.interview_id = ji.id
            AND s.completed_at IS NULL
        )
        AND COALESCE(
          (
            SELECT s.scheduled_at
            FROM public.job_interview_stages s
            WHERE s.interview_id = ji.id
              AND s.completed_at IS NULL
            ORDER BY s.sort_order ASC NULLS LAST
            LIMIT 1
          ),
          ji.scheduled_at
        ) < now()
      )
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
