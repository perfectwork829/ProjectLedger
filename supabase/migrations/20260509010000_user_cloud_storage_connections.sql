-- Per-user OAuth tokens for cloud storage providers (Google Drive first; extend later).

CREATE TABLE IF NOT EXISTS public.user_cloud_storage_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  account_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_cloud_storage_connections_provider_check CHECK (
    provider IN (
      'google_drive',
      'mega',
      'box',
      'dropbox',
      'pcloud',
      'filen',
      'koofr',
      'icedrive',
      'sync_com',
      'proton_drive',
      'icloud_drive'
    )
  ),
  CONSTRAINT user_cloud_storage_connections_user_provider_unique UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_cloud_storage_connections_user ON public.user_cloud_storage_connections(user_id);

ALTER TABLE public.user_cloud_storage_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_cloud_storage_connections' AND policyname = 'user_cloud_storage_connections_select_own'
  ) THEN
    CREATE POLICY user_cloud_storage_connections_select_own ON public.user_cloud_storage_connections
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_cloud_storage_connections' AND policyname = 'user_cloud_storage_connections_upsert_own'
  ) THEN
    CREATE POLICY user_cloud_storage_connections_upsert_own ON public.user_cloud_storage_connections
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_cloud_storage_connections' AND policyname = 'user_cloud_storage_connections_update_own'
  ) THEN
    CREATE POLICY user_cloud_storage_connections_update_own ON public.user_cloud_storage_connections
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_cloud_storage_connections' AND policyname = 'user_cloud_storage_connections_delete_own'
  ) THEN
    CREATE POLICY user_cloud_storage_connections_delete_own ON public.user_cloud_storage_connections
      FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
