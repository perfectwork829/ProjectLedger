-- Optional caller (personnel) per interview for dashboard/admin display and links.

ALTER TABLE public.job_interviews
  ADD COLUMN IF NOT EXISTS caller_personnel_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_interviews_caller_personnel ON public.job_interviews (caller_personnel_id);

COMMENT ON COLUMN public.job_interviews.caller_personnel_id IS 'Personnel with role caller associated with this interview (optional).';
