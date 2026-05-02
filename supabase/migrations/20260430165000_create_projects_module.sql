CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  skillset_csv text,
  tags_csv text,
  status text NOT NULL DEFAULT 'planning',
  priority text NOT NULL DEFAULT 'medium',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name_override text,
  client_country text,
  client_timezone text,
  account_id uuid REFERENCES public.freelancing_accounts(id) ON DELETE SET NULL,
  chat_history text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  initial_document_url text,
  source_storage_type text NOT NULL DEFAULT 'drive',
  source_storage_url text,
  deadline timestamptz,
  budget_type text NOT NULL DEFAULT 'fixed',
  budget_amount numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  github_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_status_check CHECK (status IN ('planning', 'active', 'blocked', 'qa', 'completed', 'cancelled')),
  CONSTRAINT projects_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT projects_budget_type_check CHECK (budget_type IN ('fixed', 'hourly')),
  CONSTRAINT projects_storage_type_check CHECK (source_storage_type IN ('drive', 'dropbox', 'onedrive', 'other'))
);

CREATE TABLE IF NOT EXISTS public.project_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  attachments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_personnel_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  deadline timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_tasks_status_check CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
  CONSTRAINT project_tasks_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON public.projects (deadline);
CREATE INDEX IF NOT EXISTS idx_project_screenshots_project_id ON public.project_screenshots (project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_chat_project_id ON public.project_chat_messages (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks (project_id, created_at DESC);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='projects_select_authenticated'
  ) THEN
    CREATE POLICY projects_select_authenticated ON public.projects
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='projects_admin_write'
  ) THEN
    CREATE POLICY projects_admin_write ON public.projects
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_screenshots' AND policyname='project_screenshots_select_authenticated'
  ) THEN
    CREATE POLICY project_screenshots_select_authenticated ON public.project_screenshots
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_screenshots' AND policyname='project_screenshots_admin_write'
  ) THEN
    CREATE POLICY project_screenshots_admin_write ON public.project_screenshots
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_chat_messages' AND policyname='project_chat_select_authenticated'
  ) THEN
    CREATE POLICY project_chat_select_authenticated ON public.project_chat_messages
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_chat_messages' AND policyname='project_chat_insert_authenticated'
  ) THEN
    CREATE POLICY project_chat_insert_authenticated ON public.project_chat_messages
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = author_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_chat_messages' AND policyname='project_chat_admin_delete'
  ) THEN
    CREATE POLICY project_chat_admin_delete ON public.project_chat_messages
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_tasks' AND policyname='project_tasks_select_authenticated'
  ) THEN
    CREATE POLICY project_tasks_select_authenticated ON public.project_tasks
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_tasks' AND policyname='project_tasks_insert_authenticated'
  ) THEN
    CREATE POLICY project_tasks_insert_authenticated ON public.project_tasks
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_tasks' AND policyname='project_tasks_update_authenticated'
  ) THEN
    CREATE POLICY project_tasks_update_authenticated ON public.project_tasks
      FOR UPDATE TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_tasks' AND policyname='project_tasks_admin_delete'
  ) THEN
    CREATE POLICY project_tasks_admin_delete ON public.project_tasks
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
      );
  END IF;
END $$;
