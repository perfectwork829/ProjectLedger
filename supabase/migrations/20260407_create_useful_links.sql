CREATE TABLE public.useful_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  purpose text,
  description text,
  how_to_use text,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.useful_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own useful_links" ON public.useful_links FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own useful_links" ON public.useful_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own useful_links" ON public.useful_links FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own useful_links" ON public.useful_links FOR DELETE TO authenticated USING (auth.uid() = user_id);
