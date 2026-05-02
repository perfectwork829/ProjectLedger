ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS main_stack text;

CREATE INDEX IF NOT EXISTS idx_projects_main_stack ON public.projects (main_stack);
