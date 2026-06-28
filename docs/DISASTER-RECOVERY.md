# Disaster recovery runbook

Use this when Supabase cloud is unavailable, data was lost, or you need to run BenchHub entirely on your machine.

## What is protected where

| Asset | In git | Backed up by script | Notes |
|-------|--------|---------------------|-------|
| Schema (tables, RLS, functions) | `supabase/migrations/` | `db-full.sql` | Migrations are the source of truth for structure |
| Row data | No | `db-full.sql`, `db-data-only.sql` | Run weekly or before major changes |
| Storage files (`account-files`) | No | `storage-manifest.json` (+ optional download) | Resumes, screenshots, uploads |
| Edge function code | `supabase/functions/` | — | Redeploy after recovery |
| Edge function secrets | No | Document in password manager | Gemini, Google, Box keys |
| Auth users | No | Included in DB dump | May need password reset after restore |

**Cloud project:** `udxgnisxhcnhzrndnmdc` (ProjectLedger)

## Guides

| Task | Guide |
|------|-------|
| Schedule backups | [guides/backup-supabase.md](guides/backup-supabase.md) |
| Switch cloud ↔ local frontend | [guides/env-based-supabase-config.md](guides/env-based-supabase-config.md) |
| Run local Supabase with Docker | [guides/local-supabase-development.md](guides/local-supabase-development.md) |
| Full restore procedure | This document — [Recovery scenarios](#recovery-scenarios) below |

## Prerequisites (one-time)

1. [Supabase CLI](https://supabase.com/docs/guides/cli) installed
2. [Docker Desktop](https://www.docker.com/products/docker-desktop/) running (for local stack)
3. Project linked: `supabase link --project-ref udxgnisxhcnhzrndnmdc`
4. `.env.backup` created from `.env.backup.example` (service role key for storage backup)
5. Regular backups stored **outside** this repo (encrypted cloud drive, NAS, etc.)

## Recovery scenarios

### Scenario A — Cloud is down temporarily

Run locally while waiting for Supabase to recover:

1. Follow [local-supabase-development.md](guides/local-supabase-development.md)
2. Restore latest `db-data-only.sql` into local Postgres
3. Point frontend at local Supabase via `.env.local` ([env guide](guides/env-based-supabase-config.md))
4. Restore storage files from latest backup into local `account-files` bucket (Studio → Storage)

External APIs (Gemini, Google Drive, Box) still need internet and valid keys in `supabase/.env.local`.

### Scenario B — Data lost on cloud, project still exists

1. **Stop the app** to prevent writes during restore
2. Open Supabase Dashboard → SQL Editor (or use CLI)
3. Reset schema from migrations if needed: `supabase db push` (from a clean link) or run migrations manually
4. Restore data:
   ```powershell
   # Get connection string from Dashboard → Settings → Database
   psql "<connection-string>" -f backups\<latest>\db-data-only.sql
   ```
5. Re-upload storage files from `backups\<latest>\storage-files\` (if you used `-DownloadStorage`) via Dashboard → Storage → `account-files`
6. Re-set edge function secrets: `supabase secrets list` then `supabase secrets set ...`
7. Redeploy functions: `supabase functions deploy job-application-ai` (and google/box if needed)
8. Verify login, one CRUD page per module, file upload, and AI cover letter

### Scenario C — Entire Supabase project deleted

1. Create a **new** Supabase project in the dashboard
2. Update `.env.example`, `.env.local`, and hosting env vars with new URL + anon key
3. `supabase link --project-ref <new-ref>`
4. `supabase db push` — applies all migrations from git
5. Restore latest `db-data-only.sql` or `db-full.sql`
6. Create `account-files` bucket (public) if not created by migration — or use local `config.toml` bucket definition as reference
7. Upload storage backup files
8. Set all secrets and deploy edge functions
9. Update `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in production hosting

### Scenario D — Fresh machine, no cloud access

1. Clone this repo
2. `supabase start` + `supabase db reset`
3. Restore latest backup SQL into local DB (`127.0.0.1:54322`)
4. Copy `.env.local` from secure backup (or recreate from `.env.example` with local keys)
5. `npm install && npm run dev`

## Post-restore verification checklist

- [ ] Sign in with a known user (or create admin + assign `user_roles`)
- [ ] Dashboard loads without console errors
- [ ] Task pool, projects, clients, payments list data
- [ ] Upload a file — appears in Storage and UI
- [ ] Job application AI cover letter (needs `GEMINI_API_KEY`)
- [ ] Google Drive / Box connect (needs OAuth secrets)

## Secrets inventory (fill in your password manager)

| Secret | Used by |
|--------|---------|
| `GEMINI_API_KEY` | `job-application-ai` |
| `GEMINI_MODEL` | optional override |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `cloud-storage-google` |
| `GOOGLE_API_KEY` | optional public Drive files |
| `BOX_CLIENT_ID` / `BOX_CLIENT_SECRET` | `cloud-storage-box` |
| `SUPABASE_SERVICE_ROLE_KEY` | backup script only (never in frontend) |

List cloud secrets:

```powershell
supabase secrets list --project-ref udxgnisxhcnhzrndnmdc
```

## Backup schedule (recommended)

| Frequency | Action |
|-----------|--------|
| Weekly | `npm run backup:supabase` |
| Before schema changes | Full backup + test restore on local |
| Monthly | `-DownloadStorage` full backup to external drive |
| Always | Keep migrations committed to git |

## Support files in this repo

```
scripts/backup-supabase.ps1     # automated backup
supabase/config.toml            # local stack definition
supabase/migrations/            # schema source of truth
supabase/functions/             # edge function source
.env.example                    # frontend env template
.env.backup.example             # backup script env template
supabase/.env.local.example     # local edge function secrets
```
