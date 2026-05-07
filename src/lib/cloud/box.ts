import { SUPABASE_URL, supabase } from '@/lib/supabase';

export async function boxOAuthUrl(redirectUri: string, state?: string) {
  return supabase.functions.invoke<{ url?: string; error?: string }>('cloud-storage-box', {
    body: { action: 'auth_url', redirect_uri: redirectUri, state },
  });
}

export async function boxExchangeCode(code: string, redirectUri: string) {
  return supabase.functions.invoke<{ ok?: boolean; email?: string; error?: string }>('cloud-storage-box', {
    body: { action: 'exchange', code, redirect_uri: redirectUri },
  });
}

export async function boxDisconnect() {
  return supabase.functions.invoke<{ ok?: boolean; error?: string }>('cloud-storage-box', {
    body: { action: 'disconnect' },
  });
}

export async function fetchBoxConnectionRow() {
  return supabase
    .from('user_cloud_storage_connections')
    .select('account_email, provider')
    .eq('provider', 'box')
    .maybeSingle();
}

export async function uploadFileToBox(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const session = await supabase.auth.getSession();
  const jwt = session.data.session?.access_token;
  if (!jwt) throw new Error('Not authenticated');

  const fnUrl = `${SUPABASE_URL}/functions/v1/cloud-storage-box?action=upload`;
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const j = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) throw new Error(j.error || 'Box upload failed');
  if (!j.url) throw new Error(j.error || 'Box did not return url');
  return j.url;
}