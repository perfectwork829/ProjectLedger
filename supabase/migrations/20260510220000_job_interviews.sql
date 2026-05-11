-- Job interview tracking (scheduling in developer timezone; display in viewer timezone in app).

CREATE TABLE public.job_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  developer_personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  recruiter_personnel_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  interview_timezone text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  job_source text,
  job_posting_url text,
  job_title text NOT NULL DEFAULT '',
  description text,
  resume_url text,
  status text NOT NULL DEFAULT 'scheduled',
  next_followup_at timestamptz,
  followup_notes text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_interviews_status_check CHECK (
    status IN ('scheduled', 'in_progress', 'completed', 'offer', 'rejected', 'withdrawn')
  )
);

CREATE INDEX idx_job_interviews_scheduled_at ON public.job_interviews (scheduled_at DESC);
CREATE INDEX idx_job_interviews_developer ON public.job_interviews (developer_personnel_id);
CREATE INDEX idx_job_interviews_user ON public.job_interviews (user_id);

COMMENT ON COLUMN public.job_interviews.interview_timezone IS 'IANA zone used when booking; wall clock = scheduled_at displayed in this zone.';
COMMENT ON COLUMN public.job_interviews.scheduled_at IS 'Absolute instant (UTC) for the interview start.';

CREATE TABLE public.job_interview_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.job_interviews(id) ON DELETE CASCADE,
  stage_type text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz,
  interview_timezone text,
  completed_at timestamptz,
  outcome text,
  notes text,
  next_step_expected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_interview_stages_interview ON public.job_interview_stages (interview_id, sort_order);

ALTER TABLE public.job_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_interview_stages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_interviews' AND policyname = 'job_interviews_select_authenticated'
  ) THEN
    CREATE POLICY job_interviews_select_authenticated ON public.job_interviews
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_interviews' AND policyname = 'job_interviews_admin_write'
  ) THEN
    CREATE POLICY job_interviews_admin_write ON public.job_interviews
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_interview_stages' AND policyname = 'job_interview_stages_select_authenticated'
  ) THEN
    CREATE POLICY job_interview_stages_select_authenticated ON public.job_interview_stages
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_interview_stages' AND policyname = 'job_interview_stages_admin_write'
  ) THEN
    CREATE POLICY job_interview_stages_admin_write ON public.job_interview_stages
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;
END $$;
