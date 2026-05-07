import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Body = {
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
    if (!authHeader) {
      return json({ error: 'Missing Authorization' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return json({ error: 'Unauthorized' }, 401);
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
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email openid',
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

      const { data: row, error: selErr } = await supabase
        .from('user_cloud_storage_connections')
        .select('id, access_token, refresh_token, token_expires_at')
        .eq('user_id', user.id)
        .eq('provider', 'google_drive')
        .maybeSingle();

      if (selErr) {
        return json({ error: selErr.message }, 400);
      }
      if (!row?.refresh_token && !row?.access_token) {
        return json({ error: 'Not connected' }, 400);
      }

      const stillValid =
        row.access_token &&
        row.token_expires_at &&
        new Date(row.token_expires_at as string).getTime() > Date.now() + 60_000;

      if (stillValid) {
        return json({ access_token: row.access_token });
      }

      if (!row.refresh_token) {
        return json({ error: 'Session expired; reconnect Google Drive' }, 400);
      }

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
      if (!tr.ok) {
        return json({ error: tj.error_description || tj.error || 'Refresh failed' }, 400);
      }

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

      return json({ access_token: newAccess });
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
