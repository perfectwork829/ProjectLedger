# Env-based Supabase config guide

Switch the BenchHub frontend between **cloud Supabase** and **local Supabase** without changing code.

## How it works

`src/lib/supabase.ts` reads Vite environment variables at build time:

```typescript
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
```

If env vars are unset, the app falls back to the production cloud project (`udxgnisxhcnhzrndnmdc`). Existing deployments keep working without any env configuration.

## Setup

### 1. Create local env file

```powershell
copy .env.example .env.local
```

Vite loads `.env.local` automatically in development. The file is gitignored.

### 2. Cloud (default — production-like dev)

`.env.local`:

```env
VITE_SUPABASE_URL=https://udxgnisxhcnhzrndnmdc.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from Supabase Dashboard → Settings → API>
```

The anon key is also in `.env.example` (safe to expose — RLS protects data).

### 3. Local Supabase

After `supabase start`, the CLI prints local URLs and keys. Update `.env.local`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start output>
```

Restart the dev server after changing env:

```powershell
npm run dev
```

## Environment files reference

| File | Committed | Purpose |
|------|-----------|---------|
| `.env.example` | Yes | Template for frontend vars |
| `.env.local` | No | Your active frontend config |
| `.env.backup.example` | Yes | Template for backup script |
| `.env.backup` | No | Service role key for backups |
| `supabase/.env.local.example` | Yes | Template for edge function secrets |
| `supabase/.env.local` | No | Secrets for `supabase functions serve` |

## Production / hosting deployment

Set the same variables in your hosting provider (Vercel, Netlify, Lovable, etc.):

```
VITE_SUPABASE_URL=https://udxgnisxhcnhzrndnmdc.supabase.co
VITE_SUPABASE_ANON_KEY=<production anon key>
```

Rebuild/redeploy after changing env vars — Vite inlines them at build time.

## Switching between cloud and local

| Goal | Action |
|------|--------|
| Use cloud | Set cloud URL/key in `.env.local`, or delete `.env.local` to use code defaults |
| Use local | Run `supabase start`, set local URL/key in `.env.local`, restart `npm run dev` |
| Disaster mode | Local keys + restore DB from backup ([local guide](local-supabase-development.md)) |

## Verify which backend is active

Open browser DevTools → Network. API requests should go to:

- Cloud: `https://udxgnisxhcnhzrndnmdc.supabase.co/...`
- Local: `http://127.0.0.1:54321/...`

On dev startup, if env vars are missing, the console shows:

```
[supabase] Using built-in cloud defaults. Copy .env.example to .env.local to point at local Supabase.
```

## Security notes

- **Anon key** — public, safe in frontend; RLS enforces access control
- **Service role key** — never use in frontend; only in `.env.backup` for backup script
- Do not commit `.env.local`, `.env.backup`, or `supabase/.env.local`

## Related

- [local-supabase-development.md](local-supabase-development.md) — start local stack and get keys
- [backup-supabase.md](backup-supabase.md) — `.env.backup` for backups
- [DISASTER-RECOVERY.md](../DISASTER-RECOVERY.md) — full recovery runbook
