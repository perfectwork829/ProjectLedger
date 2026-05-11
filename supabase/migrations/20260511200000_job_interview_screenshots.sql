-- Shareable screenshots of developer-for-job profile tabs from an interview context.

CREATE TABLE IF NOT EXISTS public.job_interview_profile_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.job_interviews(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  tab_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_interview_screenshots_interview
  ON public.job_interview_profile_screenshots (interview_id, created_at DESC);

ALTER TABLE public.job_interview_profile_screenshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_interview_profile_screenshots'
      AND policyname = 'job_interview_profile_screenshots_select_authenticated'
  ) THEN
    CREATE POLICY job_interview_profile_screenshots_select_authenticated
      ON public.job_interview_profile_screenshots
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_interview_profile_screenshots'
      AND policyname = 'job_interview_profile_screenshots_admin_write'
  ) THEN
    CREATE POLICY job_interview_profile_screenshots_admin_write
      ON public.job_interview_profile_screenshots
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;
END $$;
