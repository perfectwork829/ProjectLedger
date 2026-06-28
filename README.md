# BenchHub

Freelance operations app (tasks, projects, clients, payments, personnel, and more).

## Supabase backup & recovery

| Guide | Description |
|-------|-------------|
| [DISASTER-RECOVERY.md](docs/DISASTER-RECOVERY.md) | Full restore runbook |
| [Backup guide](docs/guides/backup-supabase.md) | `npm run backup:supabase` |
| [Env config guide](docs/guides/env-based-supabase-config.md) | Cloud vs local frontend |
| [Local Supabase guide](docs/guides/local-supabase-development.md) | Docker local stack |

Quick backup:

```powershell
copy .env.backup.example .env.backup
# Set SUPABASE_DB_PASSWORD and SUPABASE_SERVICE_ROLE_KEY in .env.backup
winget install PostgreSQL.PostgreSQL.17
npm run backup:supabase
```

See [Backup guide](docs/guides/backup-supabase.md) for details.
