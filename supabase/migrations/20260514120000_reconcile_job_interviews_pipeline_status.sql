-- Reconcile stale interview status with the pipeline (matches app list logic).
-- 1) All stages completed but row still scheduled/in_progress -> completed
-- 2) Open step's effective time (stage scheduled_at or main slot) in the past -> failed

CREATE OR REPLACE FUNCTION public.mark_past_job_interviews_failed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_completed integer;
  n_failed integer;
BEGIN
  UPDATE public.job_interviews ji
  SET status = 'completed',
      updated_at = now()
  WHERE ji.status IN ('scheduled', 'in_progress')
    AND EXISTS (SELECT 1 FROM public.job_interview_stages s WHERE s.interview_id = ji.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.job_interview_stages s
      WHERE s.interview_id = ji.id
        AND s.completed_at IS NULL
    );

  GET DIAGNOSTICS n_completed = ROW_COUNT;

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

  GET DIAGNOSTICS n_failed = ROW_COUNT;
  RETURN n_completed + n_failed;
END;
$$;
