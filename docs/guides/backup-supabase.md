# Backup Supabase guide

Automated backups for the BenchHub Supabase project (`udxgnisxhcnhzrndnmdc`).

## What gets backed up

Each run creates a timestamped folder under `backups/`:

```
backups/2026-06-28_143000/
  backup-meta.json          # project ref, bucket, timestamp
  db-full.sql               # schema + data (public, auth, storage)
  db-data-only.sql          # data only (smaller, good for restore)
  storage-manifest.json     # inventory of account-files objects
  storage-manifest.csv      # same data, spreadsheet-friendly
  storage-files/            # only when -DownloadStorage is used
```

The `backups/` folder is gitignored — store copies on encrypted cloud storage or a NAS.

## Prerequisites (recommended — no Docker)

1. **Copy env file:**
   ```powershell
   copy .env.backup.example .env.backup
   ```

2. **Set database password** in `.env.backup`:
   ```env
   SUPABASE_DB_PASSWORD=your-database-password
   ```
   From Supabase Dashboard → **Settings → Database → Database password**.

3. **Install `pg_dump`** (PostgreSQL client tools, one-time):
   ```powershell
   winget install PostgreSQL.PostgreSQL.17
   ```
   Open a **new** terminal after install so `pg_dump` is on PATH.

4. **Optional — storage manifest:** set `SUPABASE_SERVICE_ROLE_KEY` in `.env.backup`  
   (Dashboard → Settings → API → `service_role` secret).

Never commit `.env.backup`.

## Run a backup

```powershell
npm run backup:supabase
```

### Include storage file downloads

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-supabase.ps1 -DownloadStorage
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.backup`.

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SUPABASE_DB_PASSWORD` | For DB backup (no Docker) | — | Direct connection to `db.<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | For storage | — | List/download storage objects |
| `SUPABASE_URL` | For storage | derived from project ref | Storage API base URL |
| `SUPABASE_PROJECT_REF` | Optional | `udxgnisxhcnhzrndnmdc` | Hostname for DB connection |
| `SUPABASE_DB_URL` | Optional | — | Full URI instead of password |
| `SUPABASE_STORAGE_BUCKET` | Optional | `account-files` | Bucket to inventory |

## Alternative: Docker + Supabase CLI

If you prefer not to install PostgreSQL client tools:

1. Start **Docker Desktop**
2. `supabase login`
3. `supabase link --project-ref udxgnisxhcnhzrndnmdc`
4. `npm run backup:supabase` (uses linked project via Docker)

Note: the Supabase CLI on Windows always uses Docker for `db dump`, even with `--db-url`.

## Troubleshooting

### `Database backup requires credentials or Docker`

Set `SUPABASE_DB_PASSWORD` in `.env.backup` and install `pg_dump` (see Prerequisites).

### `pg_dump not found`

Install client tools and open a new terminal:

```powershell
winget install PostgreSQL.PostgreSQL.17
```

Or verify: `where.exe pg_dump`

### `could not translate host name` / DNS error

The direct host `db.<ref>.supabase.co` is **IPv6-only** on many projects. Windows networks without IPv6 cannot reach it.

**Fix (pick one):**

1. **Run `supabase link`** (if not already) — the script auto-uses the pooler from `supabase/.temp/pooler-url`
2. **Set pooler host** in `.env.backup`:
   ```env
   SUPABASE_DB_POOLER_HOST=aws-1-us-east-2.pooler.supabase.com
   ```
   (Copy from Dashboard → Settings → Database → Connection string → **Session pooler** → URI host)
3. **Set full pooler URI** as `SUPABASE_DB_URL` (Session pooler, not Direct)

### `pg_dump failed` / authentication

- Confirm `SUPABASE_DB_PASSWORD` is correct (reset in Dashboard if needed)
- Ensure your IP is allowed: Dashboard → Settings → Database → Network restrictions

### Storage manifest skipped

DB dumps still succeed. Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.backup`.

### Permission denied running script

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Or use `npm run backup:supabase`.

## Recommended schedule

| When | Command |
|------|---------|
| Every week | `npm run backup:supabase` |
| End of month | add `-DownloadStorage` |
| Before migrations | full backup, verify file sizes |

Copy the latest `backups/<timestamp>/` folder to external storage after each run.

## Restore pointers

- **Database:** see [DISASTER-RECOVERY.md](../DISASTER-RECOVERY.md) — restore `db-data-only.sql` with `psql`
- **Storage:** upload files from `storage-files/` via Dashboard → Storage → `account-files`
- **Manifest only:** use `public_url` column in CSV to verify which files existed at backup time

## Related

- [DISASTER-RECOVERY.md](../DISASTER-RECOVERY.md) — full restore runbook
- [local-supabase-development.md](local-supabase-development.md) — test restores locally
- Script source: `scripts/backup-supabase.ps1`
