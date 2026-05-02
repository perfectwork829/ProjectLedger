import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://udxgnisxhcnhzrndnmdc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGduaXN4aGNuaHpybmRubWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDc1ODgsImV4cCI6MjA4OTc4MzU4OH0.D7UWU3739hYk1k-JjjNxpwgp6mzVb8uRWCCj1812i5c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
