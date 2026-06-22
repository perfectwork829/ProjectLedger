import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = {
  action:
    | 'auth_url'
    | 'exchange'
    | 'access_token'
    | 'disconnect'
    | 'list_folder_images'
    | 'drive_file_image';
  redirect_uri?: string;
  state?: string;
  code?: string;
  folder_url?: string;
  folder_id?: string;
  file_id?: string;
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

type DriveListItem = {
  id: string;
  name: string;
  mimeType: string;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i;
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';
const MAX_FOLDER_DEPTH = 10;
const MAX_SCREENSHOT_IMAGES = 500;

function isImageDriveFile(mime: string, name: string): boolean {
  if (IMAGE_MIME_PREFIXES.some((p) => mime.startsWith(p))) return true;
  if (mime === 'application/octet-stream' && IMAGE_EXT.test(name)) return true;
  return false;
}

async function fetchDriveFolderItems(
  folderId: string,
  accessToken: string | null,
  apiKey: string | null,
): Promise<{ items: DriveListItem[]; error?: string }> {
  const items: DriveListItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,shortcutDetails)');
    url.searchParams.set('pageSize', '200');
    url.searchParams.set('orderBy', 'folder,name');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    if (apiKey && !accessToken) url.searchParams.set('key', apiKey);

    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const listRes = await fetch(url.toString(), { headers });
    const listJson = await listRes.json();
    if (!listRes.ok) {
      const msg = (listJson.error?.message as string) || 'Could not list folder';
      const reason = listJson.error?.errors?.[0]?.reason as string | undefined;
      return {
        items: [],
        error: reason ? `${msg} (${reason})` : msg,
      };
    }

    for (const f of listJson.files ?? []) {
      const id = (f.id as string) || '';
      if (!id) continue;
      items.push({
        id,
        name: (f.name as string) || 'Item',
        mimeType: (f.mimeType as string) || '',
        shortcutDetails: f.shortcutDetails as DriveListItem['shortcutDetails'],
      });
    }
    pageToken = listJson.nextPageToken as string | undefined;
  } while (pageToken);

  return { items };
}

/** List images in a folder and all nested subfolders (PNG/JPG, etc.). */
async function listDriveFolderImages(
  rootFolderId: string,
  accessToken: string | null,
  apiKey: string | null,
): Promise<{ files: DriveListedFile[]; totalCount: number; error?: string }> {
  const files: DriveListedFile[] = [];
  let totalCount = 0;
  let firstError: string | undefined;

  const queue: { folderId: string; depth: number; pathPrefix: string }[] = [
    { folderId: rootFolderId, depth: 0, pathPrefix: '' },
  ];
  const visited = new Set<string>();

  while (queue.length > 0 && files.length < MAX_SCREENSHOT_IMAGES) {
    const { folderId, depth, pathPrefix } = queue.shift()!;
    if (visited.has(folderId)) continue;
    visited.add(folderId);

    const { items, error } = await fetchDriveFolderItems(folderId, accessToken, apiKey);
    if (error && !firstError) firstError = error;
    if (error) continue;

    for (const item of items) {
      totalCount += 1;
      const mime = item.mimeType;
      const name = item.name;

      if (mime === FOLDER_MIME) {
        if (depth < MAX_FOLDER_DEPTH) {
          queue.push({
            folderId: item.id,
            depth: depth + 1,
            pathPrefix: `${pathPrefix}${name}/`,
          });
        }
        continue;
      }

      if (mime === SHORTCUT_MIME) {
        const targetId = item.shortcutDetails?.targetId;
        const targetMime = item.shortcutDetails?.targetMimeType || '';
        if (!targetId) continue;
        if (targetMime === FOLDER_MIME && depth < MAX_FOLDER_DEPTH) {
          queue.push({
            folderId: targetId,
            depth: depth + 1,
            pathPrefix: `${pathPrefix}${name}/`,
          });
          continue;
        }
        if (isImageDriveFile(targetMime, name)) {
          files.push({
            id: targetId,
            name: pathPrefix ? `${pathPrefix}${name}` : name,
            mimeType: targetMime,
            image_url: `https://drive.google.com/uc?export=view&id=${targetId}`,
          });
        }
        continue;
      }

      if (isImageDriveFile(mime, name)) {
        files.push({
          id: item.id,
          name: pathPrefix ? `${pathPrefix}${name}` : name,
          mimeType: mime,
          image_url: `https://drive.google.com/uc?export=view&id=${item.id}`,
        });
      }
    }
  }

  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  if (files.length === 0 && firstError) {
    return { files: [], totalCount, error: firstError };
  }
  return { files, totalCount };
}

const SCRAPE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** List images from a publicly shared folder tree (Anyone with the link) — no API key or OAuth. */
async function scrapePublicFolderImages(rootFolderId: string): Promise<DriveListedFile[]> {
  const byId = new Map<string, DriveListedFile>();
  const visited = new Set<string>();
  let queue = [rootFolderId];

  for (let depth = 0; depth < MAX_FOLDER_DEPTH && queue.length > 0 && byId.size < MAX_SCREENSHOT_IMAGES; depth += 1) {
    const nextQueue: string[] = [];

    for (const folderId of queue) {
      if (visited.has(folderId)) continue;
      visited.add(folderId);

      const pages = [
        `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`,
        `https://drive.google.com/embeddedfolderview?id=${folderId}#list`,
        `https://drive.google.com/drive/folders/${folderId}`,
        `https://drive.google.com/drive/folders/${folderId}?usp=sharing`,
      ];

      for (const pageUrl of pages) {
        try {
          const res = await fetch(pageUrl, { headers: { 'User-Agent': SCRAPE_UA } });
          if (!res.ok) continue;
          const html = await res.text();
          for (const img of parsePublicFolderHtml(html, folderId)) {
            if (!byId.has(img.id)) byId.set(img.id, img);
          }
          for (const subId of extractSubfolderIdsFromHtml(html, folderId)) {
            if (!visited.has(subId)) nextQueue.push(subId);
          }
          if (html.length > 0) break;
        } catch {
          /* try next page */
        }
      }
    }

    queue = nextQueue;
  }

  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

function extractSubfolderIdsFromHtml(html: string, parentFolderId: string): string[] {
  const ids = new Set<string>();
  for (const m of html.matchAll(/\/folders\/([a-zA-Z0-9_-]{10,})/g)) {
    const id = m[1];
    if (id && id !== parentFolderId) ids.add(id);
  }
  return [...ids];
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

  // Drive grid JSON: "id","name",...,"image/png"
  for (const m of html.matchAll(/"([a-zA-Z0-9_-]{25,})","([^"]{0,200})"/g)) {
    const id = m[1];
    const name = m[2];
    if (name && IMAGE_EXT.test(name)) add(id, name);
  }

  return [...byId.values()];
}

function buildFolderListError(attempts: string[], oauthConfigured: boolean, oauthConnected: boolean): string {
  const lines = [
    'Could not load screenshots from this Drive folder.',
    '',
    ...attempts.map((a) => `• ${a}`),
    '',
    'Fix checklist:',
    '1. In Google Drive → Share → set the folder to "Anyone with the link" (Viewer).',
    '2. Upload PNG or JPG files (not Google Docs/Sheets).',
    '3. In Google Cloud Console, enable the Google Drive API for the project that owns your API key.',
    '4. If using GOOGLE_API_KEY: restrict it to Drive API only — do NOT restrict by HTTP referrer (Supabase runs server-side).',
    '5. Redeploy the edge function after adding secrets: npx supabase functions deploy cloud-storage-google',
  ];
  if (oauthConfigured) {
    lines.push(
      oauthConnected
        ? '6. Your Google account is connected but could not read this folder — use the account that owns the folder, or make the folder public.'
        : '6. Or connect Google Drive once: Admin → Settings → Connect Google Drive.',
    );
  } else {
    lines.push('6. Or set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and connect Google Drive for private folders.');
  }
  return lines.join('\n');
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
          'openid email profile https://www.googleapis.com/auth/drive.readonly',
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

      const attempts: string[] = [];

      // 1) Public shared folder — no API key or Drive connect required
      const scraped = await scrapePublicFolderImages(folderId);
      if (scraped.length > 0) return json({ files: scraped });
      attempts.push('Public preview scrape found no images (folder may not be shared publicly).');

      const apiKey = Deno.env.get('GOOGLE_API_KEY')?.trim() || null;
      if (apiKey) {
        const publicList = await listDriveFolderImages(folderId, null, apiKey);
        if (publicList.error) {
          attempts.push(`Google API key: ${publicList.error}`);
        } else if (publicList.files.length > 0) {
          return json({ files: publicList.files });
        } else if (publicList.totalCount > 0) {
          attempts.push(
            `Google API key: folder tree has ${publicList.totalCount} file(s) but none are PNG/JPG images.`,
          );
        } else {
          attempts.push(
            'Google API key: folder appears empty or is not publicly accessible with this key.',
          );
        }
      } else {
        attempts.push('GOOGLE_API_KEY is not set on the cloud-storage-google edge function.');
      }

      let accessToken: string | null = null;
      const oauthConfigured = !!(clientId && clientSecret);
      let oauthConnected = false;
      if (oauthConfigured) {
        accessToken = await getValidAccessToken(supabase, user.id, clientId, clientSecret);
        oauthConnected = !!accessToken;
      }
      if (accessToken) {
        const oauthList = await listDriveFolderImages(folderId, accessToken, null);
        if (oauthList.error) {
          attempts.push(`Connected Google account: ${oauthList.error}`);
        } else if (oauthList.files.length > 0) {
          return json({ files: oauthList.files });
        } else if (oauthList.totalCount > 0) {
          attempts.push(
            `Connected Google account: folder tree has ${oauthList.totalCount} file(s) but none are PNG/JPG images.`,
          );
        } else {
          attempts.push('Connected Google account: no files in this folder tree (check folder link).');
        }
      } else if (oauthConfigured) {
        attempts.push('Google Drive is not connected for your user account.');
      }

      return json(
        {
          error: buildFolderListError(attempts, oauthConfigured, oauthConnected),
        },
        400,
      );
    }

    if (body.action === 'drive_file_image') {
      const fileId = body.file_id?.trim();
      if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
        return json({ error: 'file_id required' }, 400);
      }

      const apiKey = Deno.env.get('GOOGLE_API_KEY')?.trim() || null;
      let accessToken: string | null = null;
      if (clientId && clientSecret) {
        accessToken = await getValidAccessToken(supabase, user.id, clientId, clientSecret);
      }

      const authAttempts: { token: string | null; key: string | null }[] = [];
      if (accessToken) authAttempts.push({ token: accessToken, key: null });
      if (apiKey) authAttempts.push({ token: null, key: apiKey });

      if (authAttempts.length === 0) {
        return json(
          { error: 'Connect Google Drive in Admin → Settings, or set GOOGLE_API_KEY for public files.' },
          401,
        );
      }

      let lastError = 'Could not load image';

      for (const auth of authAttempts) {
        const metaUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
        metaUrl.searchParams.set('fields', 'mimeType,name,trashed');
        if (auth.key && !auth.token) metaUrl.searchParams.set('key', auth.key);

        const metaHeaders: Record<string, string> = {};
        if (auth.token) metaHeaders.Authorization = `Bearer ${auth.token}`;

        const metaRes = await fetch(metaUrl.toString(), { headers: metaHeaders });
        const metaJson = await metaRes.json();
        if (!metaRes.ok) {
          lastError = (metaJson.error?.message as string) || 'File not found or no access';
          continue;
        }
        if (metaJson.trashed) {
          return json({ error: 'File is in trash' }, 404);
        }

        const mime = (metaJson.mimeType as string) || '';
        if (!isImageDriveFile(mime, (metaJson.name as string) || '')) {
          return json({ error: 'Not an image file' }, 400);
        }

        const mediaUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
        mediaUrl.searchParams.set('alt', 'media');
        if (auth.key && !auth.token) mediaUrl.searchParams.set('key', auth.key);

        const mediaRes = await fetch(mediaUrl.toString(), { headers: metaHeaders });
        if (!mediaRes.ok) {
          lastError = 'Could not download image bytes';
          continue;
        }

        const bytes = await mediaRes.arrayBuffer();
        const contentType =
          mediaRes.headers.get('content-type')?.split(';')[0]?.trim() ||
          (mime.startsWith('image/') ? mime : 'image/png');

        return new Response(bytes, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Cache-Control': 'private, max-age=300',
          },
        });
      }

      return json({ error: lastError }, 403);
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
