# BenchHub

Freelance operations app (tasks, projects, clients, payments, personnel, and more).

## Supabase backup & recovery

| Guide | Description |
|-------|-------------|
| [DISASTER-RECOVERY.md](docs/DISASTER-RECOVERY.md) | Full restore runbook |
| [Backup guide](docs/guides/backup-supabase.md) | `npm run backup:supabase` |
| [Env config guide](docs/guides/env-based-supabase-config.md) | Cloud vs local frontend |
| [Local Supabase guide](docs/guides/local-supabase-development.md) | Docker local stack |

Quick backup (after `supabase login` + `supabase link`):

```powershell
copy .env.backup.example .env.backup
# Set SUPABASE_SERVICE_ROLE_KEY in .env.backup
npm run backup:supabase
```
