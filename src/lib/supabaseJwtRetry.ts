import { supabase } from '@/lib/supabase';

export function isJwtExpiredErrorMessage(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = String(message).toLowerCase();
  return m.includes('jwt expired') || m.includes('invalid jwt');
}

/**
 * After an idle tab, the access JWT can be past `expires_at` while the refresh token is still valid.
 * Proactively refresh before important Supabase calls so mutations (e.g. pipeline inserts) do not fail.
 */
export async function ensureSupabaseAccessTokenFresh(): Promise<{ ok: boolean; errorMessage?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.expires_at) return { ok: true };
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at > now + 90) return { ok: true };
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return { ok: false, errorMessage: error.message };
  if (!data.session) return { ok: false, errorMessage: 'No session after refresh' };
  return { ok: true };
}

type MutationResult = { error: { message: string } | null };

/**
 * Ensures a fresh access token, runs `fn`, and on JWT-expired errors refreshes once and retries.
 */
export async function withSupabaseJwtRetry(fn: () => Promise<MutationResult>): Promise<MutationResult> {
  const fresh = await ensureSupabaseAccessTokenFresh();
  if (!fresh.ok) return { error: { message: fresh.errorMessage || 'Session refresh failed' } };
  let result = await fn();
  if (result.error && isJwtExpiredErrorMessage(result.error.message)) {
    const { error: refErr } = await supabase.auth.refreshSession();
    if (!refErr) result = await fn();
  }
  return result;
}
