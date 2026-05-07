ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS profile_blocks_json jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.personnel.profile_blocks_json IS
  'Repeatable developer_for_job profile blocks: [{ title, overview, skills[], achievements[], experience[] }]';