import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = {
  action: 'auth_url' | 'exchange' | 'access_token' | 'disconnect' | 'list_folder_images';
  redirect_uri?: string;
  state?: string;
  code?: string;
  folder_url?: string;
  folder_id?: string;
};

const IMAGE_MIME_PREFIXES = ['image/'];

function extractFolderId(folderUrlOrId: string): string | null {
  const t = folderUrlOrId.trim();
  if (!t) return null;
  if (/^[a-zA-Z0-9_-]{10,}$/.test(t) && !t.includes('/')) return t;
  const m = t.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
  return m?.[1] ?? null;
}

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const { data: row, error: selErr } = await supabase
    .from('user_cloud_storage_connections')
    .select('id, access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google_drive')
    .maybeSingle();

  if (selErr || (!row?.refresh_token && !row?.access_token)) return null;

  const stillValid =
    row.access_token &&
    row.token_expires_at &&
    new Date(row.token_expires_at as string).getTime() > Date.now() + 60_000;

  if (stillValid) return row.access_token as string;

  if (!row.refresh_token) return null;

  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token as string,
    }),
  });
  const tj = await tr.json();
  if (!tr.ok) return null;

  const newAccess = tj.access_token as string;
  const newExpires = new Date(Date.now() + Number(tj.expires_in ?? 3600) * 1000).toISOString();

  await supabase
    .from('user_cloud_storage_connections')
    .update({
      access_token: newAccess,
      token_expires_at: newExpires,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  return newAccess;
}

type DriveListedFile = { id: string; name: string; mimeType?: string; image_url: string };

async function listDriveFolderImages(
  folderId: string,
  accessToken: string | null,
  apiKey: string | null,
): Promise<{ files: DriveListedFile[]; error?: string }> {
  const files: DriveListedFile[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,modifiedTime)');
    url.searchParams.set('pageSize', '200');
    url.searchParams.set('orderBy', 'name');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    if (apiKey && !accessToken) url.searchParams.set('key', apiKey);

    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const listRes = await fetch(url.toString(), { headers });
    const listJson = await listRes.json();
    if (!listRes.ok) {
      return {
        files: [],
        error: (listJson.error?.message as string) || 'Could not list folder',
      };
    }

    for (const f of listJson.files ?? []) {
      const mime = (f.mimeType as string) || '';
      if (!IMAGE_MIME_PREFIXES.some((p) => mime.startsWith(p))) continue;
      const id = f.id as string;
      files.push({
        id,
        name: (f.name as string) || 'Image',
        mimeType: mime,
        image_url: `https://drive.google.com/uc?export=view&id=${id}`,
      });
    }
    pageToken = listJson.nextPageToken as string | undefined;
  } while (pageToken);

  return { files };
}

const SCRAPE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** List images from a publicly shared folder (Anyone with the link) — no API key or OAuth. */
async function scrapePublicFolderImages(folderId: string): Promise<DriveListedFile[]> {
  const pages = [
    `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`,
    `https://drive.google.com/drive/folders/${folderId}`,
  ];

  for (const pageUrl of pages) {
    try {
      const res = await fetch(pageUrl, { headers: { 'User-Agent': SCRAPE_UA } });
      if (!res.ok) continue;
      const html = await res.text();
      const parsed = parsePublicFolderHtml(html, folderId);
      if (parsed.length > 0) return parsed;
    } catch {
      /* try next page */
    }
  }
  return [];
}

function parsePublicFolderHtml(html: string, folderId: string): DriveListedFile[] {
  const byId = new Map<string, DriveListedFile>();

  const add = (id: string, name?: string) => {
    if (!id || id === folderId || id.length < 20) return;
    if (byId.has(id)) return;
    byId.set(id, {
      id,
      name: name?.trim() || 'Screenshot',
      image_url: `https://drive.google.com/uc?export=view&id=${id}`,
    });
  };

  // JSON blobs with image mime types
  for (const m of html.matchAll(
    /\["([a-zA-Z0-9_-]{25,})","([^"]*)"[^\]]*?"image\/(png|jpe?g|gif|webp|bmp|svg\+xml|heic|heif)"/gi,
  )) {
    add(m[1], m[2]);
  }

  // /file/d/ID/view links (common in embedded folder grid)
  for (const m of html.matchAll(/\/file\/d\/([a-zA-Z0-9_-]{25,})(?:\/view)?/g)) {
    add(m[1]);
  }

  // uc?export=view&id= links
  for (const m of html.matchAll(/[?&]id=([a-zA-Z0-9_-]{25,})/g)) {
    add(m[1]);
  }

  // data-id attributes in grid tiles
  for (const m of html.matchAll(/data-id="([a-zA-Z0-9_-]{25,})"/g)) {
    add(m[1]);
  }

  return [...byId.values()];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(jwt);
    if (userErr || !user) {
      return json(
        { error: userErr?.message || 'Unauthorized — sign in to the app and try again' },
        401,
      );
    }

    const body = (await req.json()) as Body;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

    if (body.action === 'auth_url') {
      if (!clientId) {
        return json({ error: 'Server missing GOOGLE_CLIENT_ID' }, 500);
      }
      const redirectUri = body.redirect_uri?.trim();
      if (!redirectUri) {
        return json({ error: 'redirect_uri required' }, 400);
      }
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope:
          'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email openid',
        access_type: 'offline',
        prompt: 'consent',
      });
      if (body.state) params.set('state', body.state);
      const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return json({ url });
    }

    if (body.action === 'exchange') {
      if (!clientId || !clientSecret) {
        return json({ error: 'Server missing Google OAuth env' }, 500);
      }
      const redirectUri = body.redirect_uri?.trim();
      const code = body.code?.trim();
      if (!redirectUri || !code) {
        return json({ error: 'code and redirect_uri required' }, 400);
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        return json({ error: tokenJson.error_description || tokenJson.error || 'Token exchange failed' }, 400);
      }

      const accessToken = tokenJson.access_token as string;
      const refreshToken = (tokenJson.refresh_token as string) || null;
      const expiresIn = Number(tokenJson.expires_in ?? 3600);
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      let email: string | null = null;
      const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (ui.ok) {
        const uj = await ui.json();
        email = (uj.email as string) || null;
      }

      const { error: upErr } = await supabase.from('user_cloud_storage_connections').upsert(
        {
          user_id: user.id,
          provider: 'google_drive',
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          account_email: email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      );
      if (upErr) {
        return json({ error: upErr.message }, 400);
      }

      return json({ ok: true, email });
    }

    if (body.action === 'access_token') {
      if (!clientId || !clientSecret) {
        return json({ error: 'Server missing Google OAuth env' }, 500);
      }

      const token = await getValidAccessToken(supabase, user.id, clientId, clientSecret);
      if (!token) {
        return json({ error: 'Not connected or session expired; reconnect Google Drive' }, 400);
      }
      return json({ access_token: token });
    }

    if (body.action === 'list_folder_images') {
      const folderId =
        body.folder_id?.trim() || extractFolderId(body.folder_url?.trim() ?? '');
      if (!folderId) {
        return json({ error: 'folder_url or folder_id required' }, 400);
      }

      // 1) Public shared folder — no API key or Drive connect required
      const scraped = await scrapePublicFolderImages(folderId);
      if (scraped.length > 0) return json({ files: scraped });

      const apiKey = Deno.env.get('GOOGLE_API_KEY')?.trim() || null;
      if (apiKey) {
        const publicList = await listDriveFolderImages(folderId, null, apiKey);
        if (!publicList.error && publicList.files.length > 0) return json({ files: publicList.files });
      }

      let accessToken: string | null = null;
      if (clientId && clientSecret) {
        accessToken = await getValidAccessToken(supabase, user.id, clientId, clientSecret);
      }
      if (accessToken) {
        const oauthList = await listDriveFolderImages(folderId, accessToken, null);
        if (!oauthList.error && oauthList.files.length > 0) return json({ files: oauthList.files });
      }

      return json(
        {
          error:
            'No images found in this folder. Use a /drive/folders/… link, set the folder and every image to Anyone with the link, and use PNG/JPG files (not Google Docs).',
        },
        400,
      );
    }

    if (body.action === 'disconnect') {
      await supabase.from('user_cloud_storage_connections').delete().eq('user_id', user.id).eq('provider', 'google_drive');
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
