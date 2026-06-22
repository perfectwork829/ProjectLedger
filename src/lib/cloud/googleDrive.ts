import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '@/lib/supabase';
import { ensureSupabaseAccessTokenFresh } from '@/lib/supabaseJwtRetry';

export type GoogleDriveInvokeResult<T> = { data: T | null; error: Error | null };

type InvokeBody = Record<string, unknown>;

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
    throw new Error('You must be signed in to use Google Drive.');
  }
  return token;
}

/** Invoke cloud-storage-google with a fresh user JWT (avoids 401 from expired/missing auth). */
async function invokeGoogleDrive<T>(body: InvokeBody) {
  const token = await requireUserAccessToken();
  const res = await supabase.functions.invoke<T>('cloud-storage-google', {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (res.error) {
    const ctx = res.error as Error & { context?: Response };
    const status = ctx.context?.status;
    let detail = res.error.message;
    if (ctx.context) {
      try {
        const j = (await ctx.context.clone().json()) as { error?: string };
        if (j?.error) detail = j.error;
      } catch {
        /* ignore */
      }
    }
    if (status === 401 || /unauthorized/i.test(detail)) {
      throw new Error(
        `${detail} Sign out and sign in again. If it persists, redeploy the cloud-storage-google edge function.`,
      );
    }
    throw new Error(detail || 'Google Drive request failed');
  }

  const data = res.data as { error?: string } | null;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(data.error);
  }

  return res;
}

export async function googleDriveOAuthUrl(redirectUri: string, state?: string) {
  return invokeGoogleDrive<{ url?: string; error?: string }>({
    action: 'auth_url',
    redirect_uri: redirectUri,
    state,
  });
}

export async function googleDriveExchangeCode(code: string, redirectUri: string) {
  return invokeGoogleDrive<{ ok?: boolean; email?: string; error?: string }>({
    action: 'exchange',
    code,
    redirect_uri: redirectUri,
  });
}

export async function googleDriveAccessToken() {
  return invokeGoogleDrive<{ access_token?: string; error?: string }>({
    action: 'access_token',
  });
}

export async function googleDriveDisconnect() {
  return invokeGoogleDrive<{ ok?: boolean; error?: string }>({
    action: 'disconnect',
  });
}

export async function fetchGoogleDriveConnectionRow() {
  return supabase
    .from('user_cloud_storage_connections')
    .select('account_email, provider')
    .eq('provider', 'google_drive')
    .maybeSingle();
}

export type DriveFolderImage = {
  id: string;
  name: string;
  image_url: string;
};

/** Fallback: list folder via edge function (server GOOGLE_API_KEY or connected Drive). */
export async function googleDriveListFolderImagesViaEdge(folderUrlOrId: string): Promise<DriveFolderImage[]> {
  const res = await invokeGoogleDrive<{
    files?: DriveFolderImage[];
    error?: string;
  }>({
    action: 'list_folder_images',
    folder_url: folderUrlOrId.trim(),
  });
  return res.data?.files ?? [];
}

/** Fetch a Drive image via the edge proxy (OAuth or API key — works for private files). */
export async function fetchGoogleDriveFileImageBlob(fileId: string): Promise<Blob> {
  const token = await requireUserAccessToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cloud-storage-google`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'drive_file_image', file_id: fileId }),
  });

  if (!res.ok) {
    let detail = res.statusText || 'Could not load image';
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) detail = j.error;
    } catch {
      /* response may not be JSON */
    }
    throw new Error(detail);
  }

  return res.blob();
}

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
  if (!j.id) throw new Error('Drive did not return a file id');

  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${j.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch {
    /* Preview may still work if file was already shared */
  }

  if (file.type.startsWith('image/')) {
    return `https://drive.google.com/uc?export=view&id=${j.id}`;
  }
  if (j.webViewLink) return j.webViewLink;
  return `https://drive.google.com/file/d/${j.id}/view`;
}
