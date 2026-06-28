# Backup Supabase guide

Automated backups for the BenchHub Supabase project (`udxgnisxhcnhzrndnmdc`).

## What gets backed up

Each run creates a timestamped folder under `backups/`:

```
backups/2026-06-28_143000/
  backup-meta.json          # project ref, bucket, timestamp
  db-full.sql               # schema + data
  db-data-only.sql          # data only (smaller, good for restore)
  storage-manifest.json     # inventory of account-files objects
  storage-manifest.csv      # same data, spreadsheet-friendly
  storage-files/            # only when -DownloadStorage is used
```

The `backups/` folder is gitignored — store copies on encrypted cloud storage or a NAS.

## Prerequisites

1. **Supabase CLI** — install globally:
   ```powershell
   npm install -g supabase
   ```
2. **Login and link** (one-time):
   ```powershell
   supabase login
   supabase link --project-ref udxgnisxhcnhzrndnmdc
   ```
3. **Service role key** (for storage manifest) — copy `.env.backup.example` to `.env.backup`:
   ```powershell
   copy .env.backup.example .env.backup
   ```
   Edit `.env.backup` and set `SUPABASE_SERVICE_ROLE_KEY` from  
   Dashboard → Project Settings → API → `service_role` (secret).

   Never commit `.env.backup`.

## Run a backup

From the repo root:

```powershell
npm run backup:supabase
```

Or directly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-supabase.ps1
```

### Include storage file downloads

Downloads every object listed in the manifest (can be large):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-supabase.ps1 -DownloadStorage
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.backup`.

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | For storage | — | List/download storage objects |
| `SUPABASE_URL` | For storage | derived from project ref | Storage API base URL |
| `SUPABASE_PROJECT_REF` | Optional | read from `supabase link` | Metadata |
| `SUPABASE_STORAGE_BUCKET` | Optional | `account-files` | Bucket to inventory |

Set these in `.env.backup` (preferred) or as shell environment variables.

## Troubleshooting

### `supabase db dump failed`

- Run `supabase login` and confirm you are linked: check `supabase/.temp/project-ref`
- Ensure your Supabase account has access to project `udxgnisxhcnhzrndnmdc`
- Try `supabase db dump -f test.sql` manually to see the error

### Storage manifest skipped

The script warns and continues if `SUPABASE_SERVICE_ROLE_KEY` is missing. DB dumps still succeed.

CLI fallback to list files:

```powershell
supabase storage ls --experimental -r account-files
```

### Permission denied running script

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Or use `npm run backup:supabase` which passes `-ExecutionPolicy Bypass`.

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
