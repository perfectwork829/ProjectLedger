-- Multi-tenant isolation: each user sees/edits own rows; admins see/edit all.
-- Pattern: user_id = auth.uid() OR public.is_app_admin()
-- Child rows inherit access from parent task/project/interview.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION public.is_row_owner(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_user_id IS NOT NULL AND p_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_access_pool_item(p_pool_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_pool_items t
    WHERE t.id = p_pool_item_id
      AND (t.user_id = auth.uid() OR public.is_app_admin())
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_pool_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_pool_item(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND (p.user_id = auth.uid() OR public.is_app_admin())
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_job_interview(p_interview_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_interviews j
    WHERE j.id = p_interview_id
      AND (j.user_id = auth.uid() OR public.is_app_admin())
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_job_interview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_job_interview(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_payment_entry(p_user_id uuid, p_pool_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_app_admin()
    OR public.is_row_owner(p_user_id)
    OR (
      p_pool_item_id IS NOT NULL
      AND public.can_access_pool_item(p_pool_item_id)
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_payment_entry(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_payment_entry(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- user_roles + profiles (bootstrap if missing from remote)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Legacy CRM tables: ensure user_id + RLS
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.personnel') IS NOT NULL THEN
    ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.freelancing_accounts') IS NOT NULL THEN
    ALTER TABLE public.freelancing_accounts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE public.freelancing_accounts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Backfill orphan rows to the first admin (or earliest auth user).
DO $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT ur.user_id INTO v_owner
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  ORDER BY ur.created_at NULLS LAST, ur.user_id
  LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT u.id INTO v_owner FROM auth.users u ORDER BY u.created_at LIMIT 1;
  END IF;

  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.clients') IS NOT NULL THEN
    UPDATE public.clients SET user_id = v_owner WHERE user_id IS NULL;
  END IF;
  IF to_regclass('public.personnel') IS NOT NULL THEN
    UPDATE public.personnel SET user_id = v_owner WHERE user_id IS NULL;
  END IF;
  IF to_regclass('public.freelancing_accounts') IS NOT NULL THEN
    UPDATE public.freelancing_accounts SET user_id = v_owner WHERE user_id IS NULL;
  END IF;
  IF to_regclass('public.task_pool_items') IS NOT NULL THEN
    UPDATE public.task_pool_items SET user_id = v_owner WHERE user_id IS NULL;
  END IF;
  IF to_regclass('public.projects') IS NOT NULL THEN
    UPDATE public.projects SET user_id = v_owner WHERE user_id IS NULL;
  END IF;
  IF to_regclass('public.payment_entries') IS NOT NULL THEN
    UPDATE public.payment_entries SET user_id = v_owner WHERE user_id IS NULL;
  END IF;
  IF to_regclass('public.job_interviews') IS NOT NULL THEN
    UPDATE public.job_interviews SET user_id = v_owner WHERE user_id IS NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Drop old permissive / overlapping policies
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(ARRAY[
        'clients', 'personnel', 'freelancing_accounts',
        'projects', 'project_screenshots', 'project_chat_messages', 'project_tasks',
        'task_pool_items', 'task_pool_screenshots', 'task_pool_source_files',
        'task_pool_chat_messages', 'task_pool_subtasks', 'task_pool_accrual_periods',
        'payment_entries', 'payment_accounts',
        'job_interviews', 'job_interview_stages', 'job_interview_profile_screenshots',
        'useful_links', 'user_roles', 'profiles'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------

CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY user_roles_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

CREATE POLICY user_roles_admin_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE POLICY user_roles_admin_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_app_admin());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- clients, personnel, freelancing_accounts
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN
    EXECUTE $p$
      CREATE POLICY clients_tenant_select ON public.clients
        FOR SELECT TO authenticated
        USING (user_id = auth.uid() OR public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY clients_tenant_insert ON public.clients
        FOR INSERT TO authenticated
        WITH CHECK (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY clients_tenant_update ON public.clients
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid() OR public.is_app_admin())
        WITH CHECK (user_id = auth.uid() OR public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY clients_tenant_delete ON public.clients
        FOR DELETE TO authenticated
        USING (user_id = auth.uid() OR public.is_app_admin())
    $p$;
  END IF;

  IF to_regclass('public.personnel') IS NOT NULL THEN
    EXECUTE $p$
      CREATE POLICY personnel_tenant_select ON public.personnel
        FOR SELECT TO authenticated
        USING (user_id = auth.uid() OR public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY personnel_tenant_insert ON public.personnel
        FOR INSERT TO authenticated
        WITH CHECK (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY personnel_tenant_update ON public.personnel
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid() OR public.is_app_admin())
        WITH CHECK (user_id = auth.uid() OR public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY personnel_tenant_delete ON public.personnel
        FOR DELETE TO authenticated
        USING (user_id = auth.uid() OR public.is_app_admin())
    $p$;
  END IF;

  IF to_regclass('public.freelancing_accounts') IS NOT NULL THEN
    EXECUTE $p$
      CREATE POLICY freelancing_accounts_tenant_select ON public.freelancing_accounts
        FOR SELECT TO authenticated
        USING (user_id = auth.uid() OR public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY freelancing_accounts_tenant_insert ON public.freelancing_accounts
        FOR INSERT TO authenticated
        WITH CHECK (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY freelancing_accounts_tenant_update ON public.freelancing_accounts
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid() OR public.is_app_admin())
        WITH CHECK (user_id = auth.uid() OR public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY freelancing_accounts_tenant_delete ON public.freelancing_accounts
        FOR DELETE TO authenticated
        USING (user_id = auth.uid() OR public.is_app_admin())
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- projects + children
-- ---------------------------------------------------------------------------

CREATE POLICY projects_tenant_select ON public.projects
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY projects_tenant_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY projects_tenant_update ON public.projects
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY projects_tenant_delete ON public.projects
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY project_screenshots_tenant_select ON public.project_screenshots
  FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY project_screenshots_tenant_write ON public.project_screenshots
  FOR ALL TO authenticated
  USING (public.can_access_project(project_id))
  WITH CHECK (public.can_access_project(project_id));

CREATE POLICY project_chat_tenant_select ON public.project_chat_messages
  FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY project_chat_tenant_insert ON public.project_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND public.can_access_project(project_id)
  );

CREATE POLICY project_chat_tenant_update ON public.project_chat_messages
  FOR UPDATE TO authenticated
  USING (public.can_access_project(project_id))
  WITH CHECK (public.can_access_project(project_id));

CREATE POLICY project_chat_tenant_delete ON public.project_chat_messages
  FOR DELETE TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY project_tasks_tenant_select ON public.project_tasks
  FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY project_tasks_tenant_insert ON public.project_tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_project(project_id));

CREATE POLICY project_tasks_tenant_update ON public.project_tasks
  FOR UPDATE TO authenticated
  USING (public.can_access_project(project_id))
  WITH CHECK (public.can_access_project(project_id));

CREATE POLICY project_tasks_tenant_delete ON public.project_tasks
  FOR DELETE TO authenticated
  USING (public.can_access_project(project_id));

-- ---------------------------------------------------------------------------
-- task pool + children
-- ---------------------------------------------------------------------------

CREATE POLICY task_pool_items_tenant_select ON public.task_pool_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY task_pool_items_tenant_insert ON public.task_pool_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY task_pool_items_tenant_update ON public.task_pool_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY task_pool_items_tenant_delete ON public.task_pool_items
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY task_pool_screenshots_tenant_select ON public.task_pool_screenshots
  FOR SELECT TO authenticated
  USING (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_screenshots_tenant_write ON public.task_pool_screenshots
  FOR ALL TO authenticated
  USING (public.can_access_pool_item(pool_item_id))
  WITH CHECK (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_source_files_tenant_select ON public.task_pool_source_files
  FOR SELECT TO authenticated
  USING (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_source_files_tenant_write ON public.task_pool_source_files
  FOR ALL TO authenticated
  USING (public.can_access_pool_item(pool_item_id))
  WITH CHECK (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_chat_tenant_select ON public.task_pool_chat_messages
  FOR SELECT TO authenticated
  USING (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_chat_tenant_insert ON public.task_pool_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND public.can_access_pool_item(pool_item_id)
  );

CREATE POLICY task_pool_chat_tenant_update ON public.task_pool_chat_messages
  FOR UPDATE TO authenticated
  USING (public.can_access_pool_item(pool_item_id))
  WITH CHECK (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_chat_tenant_delete ON public.task_pool_chat_messages
  FOR DELETE TO authenticated
  USING (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_subtasks_tenant_select ON public.task_pool_subtasks
  FOR SELECT TO authenticated
  USING (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_subtasks_tenant_insert ON public.task_pool_subtasks
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_subtasks_tenant_update ON public.task_pool_subtasks
  FOR UPDATE TO authenticated
  USING (public.can_access_pool_item(pool_item_id))
  WITH CHECK (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_subtasks_tenant_delete ON public.task_pool_subtasks
  FOR DELETE TO authenticated
  USING (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_accrual_periods_tenant_select ON public.task_pool_accrual_periods
  FOR SELECT TO authenticated
  USING (public.can_access_pool_item(pool_item_id));

CREATE POLICY task_pool_accrual_periods_tenant_write ON public.task_pool_accrual_periods
  FOR ALL TO authenticated
  USING (public.can_access_pool_item(pool_item_id))
  WITH CHECK (public.can_access_pool_item(pool_item_id));

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

CREATE POLICY payment_entries_tenant_select ON public.payment_entries
  FOR SELECT TO authenticated
  USING (public.can_access_payment_entry(user_id, pool_item_id));

CREATE POLICY payment_entries_tenant_insert ON public.payment_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_payment_entry(COALESCE(user_id, auth.uid()), pool_item_id)
    AND (user_id IS NULL OR user_id = auth.uid() OR public.is_app_admin())
  );

CREATE POLICY payment_entries_tenant_update ON public.payment_entries
  FOR UPDATE TO authenticated
  USING (public.can_access_payment_entry(user_id, pool_item_id))
  WITH CHECK (public.can_access_payment_entry(user_id, pool_item_id));

CREATE POLICY payment_entries_tenant_delete ON public.payment_entries
  FOR DELETE TO authenticated
  USING (public.can_access_payment_entry(user_id, pool_item_id));

CREATE POLICY payment_accounts_tenant_select ON public.payment_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY payment_accounts_tenant_insert ON public.payment_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY payment_accounts_tenant_update ON public.payment_accounts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY payment_accounts_tenant_delete ON public.payment_accounts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

-- ---------------------------------------------------------------------------
-- job interviews + children
-- ---------------------------------------------------------------------------

CREATE POLICY job_interviews_tenant_select ON public.job_interviews
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY job_interviews_tenant_insert ON public.job_interviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY job_interviews_tenant_update ON public.job_interviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY job_interviews_tenant_delete ON public.job_interviews
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY job_interview_stages_tenant_select ON public.job_interview_stages
  FOR SELECT TO authenticated
  USING (public.can_access_job_interview(interview_id));

CREATE POLICY job_interview_stages_tenant_write ON public.job_interview_stages
  FOR ALL TO authenticated
  USING (public.can_access_job_interview(interview_id))
  WITH CHECK (public.can_access_job_interview(interview_id));

CREATE POLICY job_interview_screenshots_tenant_select ON public.job_interview_profile_screenshots
  FOR SELECT TO authenticated
  USING (public.can_access_job_interview(interview_id));

CREATE POLICY job_interview_screenshots_tenant_write ON public.job_interview_profile_screenshots
  FOR ALL TO authenticated
  USING (public.can_access_job_interview(interview_id))
  WITH CHECK (public.can_access_job_interview(interview_id));

-- ---------------------------------------------------------------------------
-- useful_links (own rows; admin sees all)
-- ---------------------------------------------------------------------------

CREATE POLICY useful_links_tenant_select ON public.useful_links
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY useful_links_tenant_insert ON public.useful_links
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY useful_links_tenant_update ON public.useful_links
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY useful_links_tenant_delete ON public.useful_links
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup (idempotent)
-- ---------------------------------------------------------------------------

INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = now();

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();
