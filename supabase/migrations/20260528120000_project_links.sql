-- Client-shareable project / demo links (skill-tagged portfolio), with screenshots.

CREATE TABLE IF NOT EXISTS public.project_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  overview text,
  -- Free-form skill / category tags (defaults suggested in UI).
  skill_tags text[] NOT NULL DEFAULT '{}'::text[],
  -- own_project = real work (optionally linked to projects / task pool);
  -- external = example sourced elsewhere (source_note required in app).
  source_type text NOT NULL DEFAULT 'own_project'
    CHECK (source_type IN ('own_project', 'external')),
  source_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  source_pool_item_id uuid REFERENCES public.task_pool_items(id) ON DELETE SET NULL,
  source_note text,
  -- Public image URLs (account-files or external).
  screenshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_links_user_id_idx ON public.project_links (user_id);
CREATE INDEX IF NOT EXISTS project_links_skill_tags_gin ON public.project_links USING gin (skill_tags);
CREATE INDEX IF NOT EXISTS project_links_source_project_idx ON public.project_links (source_project_id)
  WHERE source_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_links_source_pool_idx ON public.project_links (source_pool_item_id)
  WHERE source_pool_item_id IS NOT NULL;

ALTER TABLE public.project_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_links_tenant_select ON public.project_links;
DROP POLICY IF EXISTS project_links_tenant_insert ON public.project_links;
DROP POLICY IF EXISTS project_links_tenant_update ON public.project_links;
DROP POLICY IF EXISTS project_links_tenant_delete ON public.project_links;

CREATE POLICY project_links_tenant_select ON public.project_links
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY project_links_tenant_insert ON public.project_links
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY project_links_tenant_update ON public.project_links
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

CREATE POLICY project_links_tenant_delete ON public.project_links
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

COMMENT ON TABLE public.project_links IS
  'Shareable demo/live/store links for clients, tagged by skill; optional screenshots and source attribution.';
