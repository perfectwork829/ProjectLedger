-- Job application tracking (Applied Job System)

-- Ensure admin helper exists (also defined in multi_tenant_rls migration).
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  job_title text NOT NULL DEFAULT '',
  employment_types text[] NOT NULL DEFAULT '{}',
  compensation text,
  location text,
  source_platform text,
  job_link text,
  job_description text,
  cover_letter text,
  tailored_resume_text text,
  application_status text NOT NULL DEFAULT 'applied',
  applied_at timestamptz NOT NULL DEFAULT now(),
  raw_posting_paste text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_applications_status_check CHECK (
    application_status IN (
      'applied',
      'under_review',
      'interview_scheduled',
      'interview_completed',
      'technical_assessment',
      'offer_received',
      'rejected',
      'withdrawn',
      'hired'
    )
  )
);

CREATE INDEX idx_job_applications_user_applied ON public.job_applications (user_id, applied_at DESC);
CREATE INDEX idx_job_applications_company ON public.job_applications (user_id, lower(company_name));
CREATE INDEX idx_job_applications_status ON public.job_applications (user_id, application_status);

CREATE TABLE public.job_application_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'America/New_York',
  weekly_target integer NOT NULL DEFAULT 25,
  retention_days integer NOT NULL DEFAULT 90,
  cover_letter_sentences integer NOT NULL DEFAULT 7,
  cover_letter_name text,
  cover_letter_prefix text NOT NULL DEFAULT 'Dear hiring manager',
  cover_letter_infix text NOT NULL DEFAULT 'Kind Regards',
  master_resume_text text,
  application_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  theme text NOT NULL DEFAULT 'light',
  font_family text NOT NULL DEFAULT 'sans',
  font_size text NOT NULL DEFAULT 'medium',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_interviews
  ADD COLUMN IF NOT EXISTS job_application_id uuid REFERENCES public.job_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_interviews_application ON public.job_interviews (job_application_id);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_application_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_applications_select ON public.job_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY job_applications_insert ON public.job_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY job_applications_update ON public.job_applications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY job_applications_delete ON public.job_applications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY job_application_settings_select ON public.job_application_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY job_application_settings_insert ON public.job_application_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY job_application_settings_update ON public.job_application_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());
