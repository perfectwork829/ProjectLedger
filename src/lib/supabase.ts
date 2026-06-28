import { createClient } from '@supabase/supabase-js';

/** Cloud defaults — override with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local */
const DEFAULT_SUPABASE_URL = 'https://udxgnisxhcnhzrndnmdc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGduaXN4aGNuaHpybmRubWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDc1ODgsImV4cCI6MjA4OTc4MzU4OH0.D7UWU3739hYk1k-JjjNxpwgp6mzVb8uRWCCj1812i5c';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  if (import.meta.env.DEV) {
    console.info(
      '[supabase] Using built-in cloud defaults. Copy .env.example to .env.local to point at local Supabase.',
    );
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
