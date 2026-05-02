ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS project_source text;

CREATE INDEX IF NOT EXISTS idx_projects_project_source ON public.projects (project_source);
