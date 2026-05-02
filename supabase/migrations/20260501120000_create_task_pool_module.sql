-- Task pool (pre-project leads). Promoting to `projects` is done from the app when status = completed.

CREATE TABLE IF NOT EXISTS public.task_pool_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  skillset_csv text,
  tags_csv text,
  main_stack text,
  task_source text,
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
  status text NOT NULL DEFAULT 'planning',
  priority text NOT NULL DEFAULT 'medium',
  promoted_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_pool_status_check CHECK (status IN ('planning', 'active', 'blocked', 'qa', 'completed', 'cancelled')),
  CONSTRAINT task_pool_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT task_pool_budget_type_check CHECK (budget_type IN ('fixed', 'hourly')),
  CONSTRAINT task_pool_storage_type_check CHECK (source_storage_type IN ('drive', 'dropbox', 'onedrive', 'other'))
);

CREATE TABLE IF NOT EXISTS public.task_pool_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_item_id uuid NOT NULL REFERENCES public.task_pool_items(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_pool_source_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_item_id uuid NOT NULL REFERENCES public.task_pool_items(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_pool_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_item_id uuid NOT NULL REFERENCES public.task_pool_items(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  attachments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_pool_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_item_id uuid NOT NULL REFERENCES public.task_pool_items(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_personnel_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  deadline timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_pool_subtasks_status_check CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
  CONSTRAINT task_pool_subtasks_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_task_pool_items_created_at ON public.task_pool_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_pool_items_status ON public.task_pool_items (status);
CREATE INDEX IF NOT EXISTS idx_task_pool_items_main_stack ON public.task_pool_items (main_stack);
CREATE INDEX IF NOT EXISTS idx_task_pool_items_promoted ON public.task_pool_items (promoted_project_id);
CREATE INDEX IF NOT EXISTS idx_task_pool_screenshots_pool ON public.task_pool_screenshots (pool_item_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_task_pool_source_files_pool ON public.task_pool_source_files (pool_item_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_task_pool_chat_pool ON public.task_pool_chat_messages (pool_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_pool_subtasks_pool ON public.task_pool_subtasks (pool_item_id, created_at DESC);

ALTER TABLE public.task_pool_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_pool_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_pool_source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_pool_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_pool_subtasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_items' AND policyname='task_pool_items_select_authenticated'
  ) THEN
    CREATE POLICY task_pool_items_select_authenticated ON public.task_pool_items
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_items' AND policyname='task_pool_items_admin_all'
  ) THEN
    CREATE POLICY task_pool_items_admin_all ON public.task_pool_items
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_items' AND policyname='task_pool_items_insert_own'
  ) THEN
    CREATE POLICY task_pool_items_insert_own ON public.task_pool_items
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_items' AND policyname='task_pool_items_update_own_open'
  ) THEN
    CREATE POLICY task_pool_items_update_own_open ON public.task_pool_items
      FOR UPDATE TO authenticated
      USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
      WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_screenshots' AND policyname='task_pool_screenshots_select_authenticated'
  ) THEN
    CREATE POLICY task_pool_screenshots_select_authenticated ON public.task_pool_screenshots
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_screenshots' AND policyname='task_pool_screenshots_admin_write'
  ) THEN
    CREATE POLICY task_pool_screenshots_admin_write ON public.task_pool_screenshots
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_source_files' AND policyname='task_pool_source_files_select_authenticated'
  ) THEN
    CREATE POLICY task_pool_source_files_select_authenticated ON public.task_pool_source_files
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_source_files' AND policyname='task_pool_source_files_admin_write'
  ) THEN
    CREATE POLICY task_pool_source_files_admin_write ON public.task_pool_source_files
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_chat_messages' AND policyname='task_pool_chat_select_authenticated'
  ) THEN
    CREATE POLICY task_pool_chat_select_authenticated ON public.task_pool_chat_messages
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_chat_messages' AND policyname='task_pool_chat_insert_authenticated'
  ) THEN
    CREATE POLICY task_pool_chat_insert_authenticated ON public.task_pool_chat_messages
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = author_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_chat_messages' AND policyname='task_pool_chat_admin_delete'
  ) THEN
    CREATE POLICY task_pool_chat_admin_delete ON public.task_pool_chat_messages
      FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_subtasks' AND policyname='task_pool_subtasks_select_authenticated'
  ) THEN
    CREATE POLICY task_pool_subtasks_select_authenticated ON public.task_pool_subtasks
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_subtasks' AND policyname='task_pool_subtasks_insert_authenticated'
  ) THEN
    CREATE POLICY task_pool_subtasks_insert_authenticated ON public.task_pool_subtasks
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_subtasks' AND policyname='task_pool_subtasks_update_authenticated'
  ) THEN
    CREATE POLICY task_pool_subtasks_update_authenticated ON public.task_pool_subtasks
      FOR UPDATE TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_pool_subtasks' AND policyname='task_pool_subtasks_admin_delete'
  ) THEN
    CREATE POLICY task_pool_subtasks_admin_delete ON public.task_pool_subtasks
      FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      );
  END IF;
END $$;
