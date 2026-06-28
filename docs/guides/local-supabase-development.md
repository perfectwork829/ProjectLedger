# Local Supabase development guide

Run the full Supabase stack (Postgres, Auth, Storage, Edge Functions) on your machine with Docker.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Supabase CLI](https://supabase.com/docs/guides/cli):
  ```powershell
  npm install -g supabase
  ```

## Quick start

From the repo root:

```powershell
# 1. Start local stack (first run downloads Docker images)
npm run supabase:start

# 2. Apply all migrations (schema)
npm run supabase:reset

# 3. Point frontend at local Supabase
copy .env.example .env.local
# Edit .env.local — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from step 1 output

# 4. Run the app
npm install
npm run dev
```

App: http://127.0.0.1:8080  
Studio: http://127.0.0.1:54323  
Inbucket (test email): http://127.0.0.1:54324

## What `supabase/config.toml` configures

The committed `supabase/config.toml` defines:

| Setting | Value | Notes |
|---------|-------|-------|
| API port | `54321` | Frontend connects here |
| DB port | `54322` | Direct Postgres access |
| Studio port | `54323` | Local admin UI |
| Postgres version | `17` | Matches cloud project |
| Storage bucket | `account-files` (public) | Used by file uploads |
| Auth site URL | `http://127.0.0.1:8080` | Matches Vite dev server |
| Edge functions | `job-application-ai`, `cloud-storage-google`, `cloud-storage-box` | JWT verification enabled |

## NPM scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run supabase:start` | `supabase start` | Start Docker stack |
| `npm run supabase:stop` | `supabase stop` | Stop containers |
| `npm run supabase:reset` | `supabase db reset` | Re-apply migrations (+ seed if added) |
| `npm run supabase:functions` | `supabase functions serve` | Run edge functions locally |

## Edge functions locally

1. Copy secrets template:
   ```powershell
   copy supabase\.env.local.example supabase\.env.local
   ```
2. Fill in `GEMINI_API_KEY`, Google/Box OAuth credentials as needed
3. In a second terminal:
   ```powershell
   npm run supabase:functions
   ```

Functions are served at `http://127.0.0.1:54321/functions/v1/<function-name>`.

AI and cloud storage features require valid external API keys — local Supabase does not replace Gemini or Google/Box.

## Restore a backup into local DB

After `supabase start` and `supabase db reset`:

```powershell
# Default local Postgres password is "postgres"
$env:PGPASSWORD = "postgres"
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f backups\<timestamp>\db-data-only.sql
```

Or use full dump if schema is also missing:

```powershell
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f backups\<timestamp>\db-full.sql
```

### Restore storage files

1. Open Studio → http://127.0.0.1:54323 → Storage → `account-files`
2. Upload files from `backups\<timestamp>\storage-files\` preserving folder structure

Or use the Supabase CLI if available for your version.

## Create a local admin user

1. Studio → Authentication → Add user (email + password)
2. Copy the user's UUID
3. Studio → SQL Editor:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('<user-uuid>', 'admin')
   ON CONFLICT DO NOTHING;
   ```

Adjust if your `user_roles` table has a different unique constraint.

## Link to cloud project (optional)

For pushing migrations or pulling remote schema:

```powershell
supabase login
supabase link --project-ref udxgnisxhcnhzrndnmdc
```

Linking cloud does not affect local `supabase start` — they are independent.

## Common issues

### Docker not running

```
Error: Cannot connect to the Docker daemon
```

Start Docker Desktop and retry `supabase start`.

### Port already in use

Stop other Supabase instances or change ports in `supabase/config.toml`.

### Migrations fail

Run `supabase db reset` for a clean slate. Fix migration SQL locally before pushing to cloud.

### Auth redirect errors

Ensure `site_url` and `additional_redirect_urls` in `config.toml` match where Vite runs (`http://127.0.0.1:8080`).

### Storage upload fails locally

Confirm bucket exists: Studio → Storage. `config.toml` defines `account-files` — restart stack after config changes:

```powershell
npm run supabase:stop
npm run supabase:start
```

## Stop local stack

```powershell
npm run supabase:stop
```

## Related

- [env-based-supabase-config.md](env-based-supabase-config.md) — point frontend at local URLs
- [backup-supabase.md](backup-supabase.md) — create backups to restore here
- [DISASTER-RECOVERY.md](../DISASTER-RECOVERY.md) — full disaster recovery runbook
