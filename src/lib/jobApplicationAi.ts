import { SUPABASE_ANON_KEY, supabase } from '@/lib/supabase';
import { ensureSupabaseAccessTokenFresh } from '@/lib/supabaseJwtRetry';

export type JobApplicationAiAction = 'cover_letter' | 'tailored_resume';

export type JobApplicationAiInput = {
  action: JobApplicationAiAction;
  company_name: string;
  job_title: string;
  job_description: string;
  master_resume_text: string;
  cover_letter_name?: string | null;
  cover_letter_prefix?: string;
  cover_letter_infix?: string;
  cover_letter_sentences?: number;
  location?: string;
  compensation?: string;
};

async function requireUserAccessToken(): Promise<string> {
  const fresh = await ensureSupabaseAccessTokenFresh();
  if (!fresh.ok) {
    throw new Error(fresh.errorMessage || 'Session expired. Sign out and sign in again.');
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('You must be signed in to generate with AI.');
  }
  return token;
}

export async function invokeJobApplicationAi(
  input: JobApplicationAiInput,
): Promise<{ text: string; model?: string }> {
  const token = await requireUserAccessToken();
  const res = await supabase.functions.invoke<{ text?: string; model?: string; error?: string }>(
    'job-application-ai',
    {
      body: input,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    },
  );

  if (res.error) {
    const ctx = res.error as Error & { context?: Response };
    let detail = res.error.message;
    if (ctx.context) {
      try {
        const j = (await ctx.context.clone().json()) as { error?: string };
        if (j?.error) detail = j.error;
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail || 'AI generation failed');
  }

  const data = res.data;
  if (!data?.text?.trim()) {
    throw new Error(data?.error || 'AI returned no text');
  }

  return { text: data.text.trim(), model: data.model };
}
