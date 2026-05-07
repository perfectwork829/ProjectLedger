import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JsonBody = {
  action: 'auth_url' | 'exchange' | 'access_token' | 'disconnect';
  redirect_uri?: string;
  state?: string;
  code?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const clientId = Deno.env.get('BOX_CLIENT_ID') ?? '';
    const clientSecret = Deno.env.get('BOX_CLIENT_SECRET') ?? '';

    // Upload is multipart (to avoid CORS and keep tokens off the client).
    if (action === 'upload') {
      if (!clientId || !clientSecret) return json({ error: 'Server missing Box OAuth env' }, 500);

      const ct = req.headers.get('content-type') || '';
      if (!ct.includes('multipart/form-data')) return json({ error: 'Expected multipart/form-data' }, 400);

      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return json({ error: 'file required' }, 400);

      const parentId = String(form.get('parent_id') || '0');

      const access = await getAccessTokenForUser({ supabase, userId: user.id, clientId, clientSecret });
      if (!access) return json({ error: 'Not connected' }, 400);

      // Upload file
      const uploadForm = new FormData();
      uploadForm.append(
        'attributes',
        new Blob(
          [
            JSON.stringify({
              name: file.name,
              parent: { id: parentId },
            }),
          ],
          { type: 'application/json' },
        ),
      );
      uploadForm.append('file', file, file.name);

      const upRes = await fetch('https://upload.box.com/api/2.0/files/content', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}` },
        body: uploadForm,
      });

      const upJson = await upRes.json();
      if (!upRes.ok) {
        return json({ error: upJson?.message || 'Box upload failed' }, 400);
      }

      const fileId = upJson?.entries?.[0]?.id as string | undefined;
      if (!fileId) return json({ error: 'Box upload did not return file id' }, 400);

      // Create public shared link
      const shareRes = await fetch(`https://api.box.com/2.0/files/${fileId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shared_link: { access: 'open' } }),
      });
      const shareJson = await shareRes.json();
      if (!shareRes.ok) {
        return json({ error: shareJson?.message || 'Box share link failed' }, 400);
      }

      const sharedUrl = shareJson?.shared_link?.url as string | undefined;
      if (!sharedUrl) return json({ error: 'Box did not return share URL' }, 400);

      return json({ url: sharedUrl, file_id: fileId });
    }

    const body = (await req.json()) as JsonBody;

    if (body.action === 'auth_url') {
      if (!clientId) return json({ error: 'Server missing BOX_CLIENT_ID' }, 500);
      const redirectUri = body.redirect_uri?.trim();
      if (!redirectUri) return json({ error: 'redirect_uri required' }, 400);

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
      });
      if (body.state) params.set('state', body.state);

      return json({ url: `https://account.box.com/api/oauth2/authorize?${params.toString()}` });
    }

    if (body.action === 'exchange') {
      if (!clientId || !clientSecret) return json({ error: 'Server missing Box OAuth env' }, 500);
      const redirectUri = body.redirect_uri?.trim();
      const code = body.code?.trim();
      if (!redirectUri || !code) return json({ error: 'code and redirect_uri required' }, 400);

      const tokenRes = await fetch('https://api.box.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        return json({ error: tokenJson?.error_description || tokenJson?.error || 'Token exchange failed' }, 400);
      }

      const accessToken = tokenJson.access_token as string;
      const refreshToken = (tokenJson.refresh_token as string) || null;
      const expiresIn = Number(tokenJson.expires_in ?? 3600);
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      let email: string | null = null;
      const meRes = await fetch('https://api.box.com/2.0/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        email = (me?.login as string) || null;
      }

      const { error: upErr } = await supabase.from('user_cloud_storage_connections').upsert(
        {
          user_id: user.id,
          provider: 'box',
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          account_email: email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      );
      if (upErr) return json({ error: upErr.message }, 400);

      return json({ ok: true, email });
    }

    if (body.action === 'access_token') {
      if (!clientId || !clientSecret) return json({ error: 'Server missing Box OAuth env' }, 500);

      const token = await getAccessTokenForUser({ supabase, userId: user.id, clientId, clientSecret });
      if (!token) return json({ error: 'Not connected' }, 400);
      return json({ access_token: token });
    }

    if (body.action === 'disconnect') {
      await supabase.from('user_cloud_storage_connections').delete().eq('user_id', user.id).eq('provider', 'box');
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

async function getAccessTokenForUser(input: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  clientId: string;
  clientSecret: string;
}): Promise<string | null> {
  const { data: row, error } = await input.supabase
    .from('user_cloud_storage_connections')
    .select('id, access_token, refresh_token, token_expires_at')
    .eq('user_id', input.userId)
    .eq('provider', 'box')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row?.access_token && !row?.refresh_token) return null;

  const stillValid =
    row.access_token &&
    row.token_expires_at &&
    new Date(row.token_expires_at as string).getTime() > Date.now() + 60_000;

  if (stillValid) return row.access_token as string;
  if (!row.refresh_token) return null;

  const tr = await fetch('https://api.box.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token as string,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    }),
  });
  const tj = await tr.json();
  if (!tr.ok) {
    throw new Error(tj?.error_description || tj?.error || 'Refresh failed');
  }

  const newAccess = tj.access_token as string;
  const newRefresh = (tj.refresh_token as string) || (row.refresh_token as string);
  const newExpires = new Date(Date.now() + Number(tj.expires_in ?? 3600) * 1000).toISOString();

  await input.supabase
    .from('user_cloud_storage_connections')
    .update({
      access_token: newAccess,
      refresh_token: newRefresh,
      token_expires_at: newExpires,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  return newAccess;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}