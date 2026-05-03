-- Remove "things_to_do" from task pool subtask board; migrate existing rows to "todo".

UPDATE public.task_pool_subtasks
SET status = 'todo',
    updated_at = now()
WHERE status = 'things_to_do';

ALTER TABLE public.task_pool_subtasks DROP CONSTRAINT IF EXISTS task_pool_subtasks_status_check;

ALTER TABLE public.task_pool_subtasks
  ADD CONSTRAINT task_pool_subtasks_status_check
  CHECK (status IN ('todo', 'doing', 'done', 'bug_list', 'cancelled'));

-- Keep promotion mapping in sync (no things_to_do branch; ELSE -> todo).
CREATE OR REPLACE FUNCTION public.promote_task_pool_to_project(p_pool_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.task_pool_items%ROWTYPE;
  v_project_id uuid;
  v_meta jsonb;
  v_files jsonb;
BEGIN
  SELECT * INTO r FROM public.task_pool_items WHERE id = p_pool_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_pool item not found';
  END IF;

  IF r.promoted_project_id IS NOT NULL THEN
    RETURN r.promoted_project_id;
  END IF;

  IF r.status <> 'completed' THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ) AND (r.user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'promotion not permitted';
  END IF;

  SELECT COALESCE(
    (SELECT jsonb_agg(f.file_url ORDER BY f.sort_order)
     FROM public.task_pool_source_files f
     WHERE f.pool_item_id = r.id),
    '[]'::jsonb
  )
  INTO v_files;

  v_meta := COALESCE(r.metadata_json, '{}'::jsonb)
    || jsonb_build_object(
      'promoted_from_task_pool_id', to_jsonb(r.id),
      'promoted_at', to_jsonb(now()),
      'source_file_urls', v_files
    );

  INSERT INTO public.projects (
    user_id,
    name,
    description,
    project_source,
    main_stack,
    skillset_csv,
    tags_csv,
    status,
    priority,
    client_id,
    client_name_override,
    client_country,
    client_timezone,
    account_id,
    chat_history,
    metadata_json,
    initial_document_url,
    source_storage_type,
    source_storage_url,
    deadline,
    budget_type,
    budget_amount,
    currency,
    github_url,
    updated_at
  ) VALUES (
    r.user_id,
    r.name,
    r.description,
    r.task_source,
    r.main_stack,
    r.skillset_csv,
    r.tags_csv,
    'active',
    r.priority,
    r.client_id,
    r.client_name_override,
    r.client_country,
    r.client_timezone,
    r.account_id,
    r.chat_history,
    v_meta,
    r.initial_document_url,
    r.source_storage_type,
    COALESCE(NULLIF(trim(r.source_storage_url), ''), 'https://drive.google.com/'),
    r.deadline,
    r.budget_type,
    r.budget_amount,
    r.currency,
    r.github_url,
    now()
  )
  RETURNING id INTO v_project_id;

  INSERT INTO public.project_screenshots (project_id, image_url, caption, sort_order)
  SELECT v_project_id, s.image_url, s.caption, s.sort_order
  FROM public.task_pool_screenshots s
  WHERE s.pool_item_id = r.id;

  INSERT INTO public.project_chat_messages (project_id, author_user_id, message, attachments_json, created_at)
  SELECT v_project_id, c.author_user_id, c.message, c.attachments_json, c.created_at
  FROM public.task_pool_chat_messages c
  WHERE c.pool_item_id = r.id;

  INSERT INTO public.project_tasks (
    project_id,
    title,
    description,
    assignee_personnel_id,
    status,
    priority,
    deadline,
    created_by,
    created_at,
    updated_at
  )
  SELECT
    v_project_id,
    t.title,
    t.description,
    t.assignee_personnel_id,
    CASE t.status
      WHEN 'todo' THEN 'todo'
      WHEN 'doing' THEN 'in_progress'
      WHEN 'done' THEN 'done'
      WHEN 'bug_list' THEN 'blocked'
      ELSE 'todo'
    END,
    t.priority,
    t.deadline,
    t.created_by,
    t.created_at,
    t.updated_at
  FROM public.task_pool_subtasks t
  WHERE t.pool_item_id = r.id
    AND t.status <> 'cancelled';

  UPDATE public.task_pool_items
  SET promoted_project_id = v_project_id,
      promoted_at = now(),
      updated_at = now()
  WHERE id = r.id;

  RETURN v_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_task_pool_to_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_task_pool_to_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_task_pool_to_project(uuid) TO service_role;
