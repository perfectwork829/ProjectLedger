-- Expand allowed cloud storage providers and add project-level multi-link fields.

ALTER TABLE public.task_pool_items
  DROP CONSTRAINT IF EXISTS task_pool_storage_type_check;

ALTER TABLE public.task_pool_items
  ADD CONSTRAINT task_pool_storage_type_check CHECK (
    source_storage_type IN (
      'drive',
      'google_drive',
      'mega',
      'pcloud',
      'box',
      'filen',
      'koofr',
      'icedrive',
      'sync_com',
      'proton_drive',
      'icloud_drive',
      'dropbox',
      'onedrive',
      'other'
    )
  );

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_storage_type_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_storage_type_check CHECK (
    source_storage_type IN (
      'drive',
      'google_drive',
      'mega',
      'pcloud',
      'box',
      'filen',
      'koofr',
      'icedrive',
      'sync_com',
      'proton_drive',
      'icloud_drive',
      'dropbox',
      'onedrive',
      'other'
    )
  );

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS github_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_storage_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS initial_document_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.projects
SET github_links = jsonb_build_array(jsonb_build_object('label', 'GitHub', 'url', github_url))
WHERE github_url IS NOT NULL AND btrim(github_url) <> '' AND github_links = '[]'::jsonb;

UPDATE public.projects
SET source_storage_urls = jsonb_build_array(jsonb_build_object('label', 'Storage', 'url', source_storage_url))
WHERE source_storage_url IS NOT NULL AND btrim(source_storage_url) <> '' AND source_storage_urls = '[]'::jsonb;

UPDATE public.projects
SET initial_document_urls = jsonb_build_array(jsonb_build_object('label', 'Document', 'url', initial_document_url))
WHERE initial_document_url IS NOT NULL AND btrim(initial_document_url) <> '' AND initial_document_urls = '[]'::jsonb;
