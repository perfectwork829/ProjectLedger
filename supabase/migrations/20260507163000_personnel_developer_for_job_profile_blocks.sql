-- Structured developer-for-job profile blocks (repeatable items).
ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS profile_titles_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_overviews_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_skills_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_achievements_json jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.personnel.profile_titles_json IS 'Repeatable titles for developer_for_job profile.';
COMMENT ON COLUMN public.personnel.profile_overviews_json IS 'Repeatable overview items for developer_for_job profile.';
COMMENT ON COLUMN public.personnel.profile_skills_json IS 'Repeatable skills for developer_for_job profile.';
COMMENT ON COLUMN public.personnel.profile_achievements_json IS 'Repeatable achievements for developer_for_job profile.';