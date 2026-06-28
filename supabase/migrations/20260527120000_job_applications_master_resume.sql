ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS master_resume_text text;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS master_resume_url text;
