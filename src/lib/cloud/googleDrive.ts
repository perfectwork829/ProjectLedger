import { supabase } from '@/lib/supabase';

export type GoogleDriveInvokeResult<T> = { data: T | null; error: Error | null };

export async function googleDriveOAuthUrl(redirectUri: string, state?: string) {
  return supabase.functions.invoke<{ url?: string; error?: string }>('cloud-storage-google', {
    body: { action: 'auth_url', redirect_uri: redirectUri, state },
  });
}

export async function googleDriveExchangeCode(code: string, redirectUri: string) {
  return supabase.functions.invoke<{ ok?: boolean; email?: string; error?: string }>('cloud-storage-google', {
    body: { action: 'exchange', code, redirect_uri: redirectUri },
  });
}

export async function googleDriveAccessToken() {
  return supabase.functions.invoke<{ access_token?: string; error?: string }>('cloud-storage-google', {
    body: { action: 'access_token' },
  });
}

export async function googleDriveDisconnect() {
  return supabase.functions.invoke<{ ok?: boolean; error?: string }>('cloud-storage-google', {
    body: { action: 'disconnect' },
  });
}

export async function fetchGoogleDriveConnectionRow() {
  return supabase
    .from('user_cloud_storage_connections')
    .select('account_email, provider')
    .eq('provider', 'google_drive')
    .maybeSingle();
}

/** Multipart upload to the user's Drive (drive.file scope). Returns a shareable view URL. */
export async function uploadFileToGoogleDrive(file: File, accessToken: string): Promise<string> {
  const metadata = { name: file.name };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );
  const j = (await res.json()) as { id?: string; webViewLink?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(j.error?.message || res.statusText || 'Drive upload failed');
  }
  if (j.webViewLink) return j.webViewLink;
  if (j.id) return `https://drive.google.com/file/d/${j.id}/view`;
  throw new Error('Drive did not return a link');
}
