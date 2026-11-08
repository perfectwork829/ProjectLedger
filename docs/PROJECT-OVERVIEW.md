# FreelancerHub / BenchHub — Project Overview

**Audience:** engineers taking over or reviewing this codebase  
**Scope:** architecture, stack, modules, integrations, and known risks  
**Last updated:** 2026-11-07  

> Product branding in-repo is **BenchHub** (`package.json` name `benchhub`; `index.html` title; README).  
> The workspace / folder name is **FreelancerHub**. Treat them as the same product.

---

## 1. Overall architecture

This is a **SPA + Supabase BaaS** app — not a classic Node/Express (or Nest) backend.

```
Browser (Vite + React SPA)
  ├─ @supabase/supabase-js  →  Auth / Postgres (RLS) / Storage
  └─ supabase.functions.invoke  →  Edge Functions (Deno)
         ├─ job-application-ai      → Google Gemini
         ├─ cloud-storage-google    → Google OAuth + Drive
         └─ cloud-storage-box       → Box OAuth + upload
```

| Layer | Role |
|--------|------|
| **Frontend** | Vite SPA (dev port `8080`). Most UI and business logic live in React. |
| **Data path** | Pages/libs call `supabase.from(...)` / `supabase.auth` / `supabase.storage` directly (`src/lib/supabase.ts`). |
| **Auth** | Supabase email/password; session via `AuthContext`; route gates via `ProtectedRoute`. |
| **Authorization** | Postgres RLS (`user_id = auth.uid()` or `is_app_admin()`), plus limited UI role checks. |
| **Edge functions** | Thin secret-holding proxies (OAuth client secrets, Gemini API key) — not a general application API layer. |

### Dual UX surfaces

Both share the same data model; RLS is the real tenancy boundary.

| Surface | Path | Intent |
|---------|------|--------|
| Dashboard | `/dashboard/*` | Day-to-day ops (often more view-oriented) |
| Manage / Admin | `/admin/*` | Full CRUD (non-admins still scoped to own rows by RLS; admins see all) |

> Note: a comment in `src/App.tsx` describes the dashboard as “read-only.” That is **not fully accurate** — e.g. Task Pool and Applied Jobs allow meaningful writes for owners.

### What is *not* present

- Separate Express/Nest/GraphQL BFF
- Live Stripe Checkout / payment processor API
- Transactional app email beyond Supabase Auth mail (local Inbucket in `supabase/config.toml`)

---

## 2. Frontend and backend technologies

### Frontend

| Area | Choice | Paths / notes |
|------|--------|----------------|
| Framework | React 18 + TypeScript | `src/` |
| Router | `react-router-dom` v6 | `src/App.tsx` |
| Build | Vite 5 + `@vitejs/plugin-react-swc` | `vite.config.ts` |
| Styling | Tailwind 3 + CSS variables | `tailwind.config.ts`, `src/index.css` |
| UI | shadcn-style Radix primitives | `src/components/ui/*` |
| Data fetching | TanStack React Query | Provider in `App.tsx`; many pages still use local `useEffect` + Supabase |
| Forms | `react-hook-form` + Zod | |
| Rich text | `react-quill-new` + `quill-table-better` | |
| Charts | Recharts | Applied Jobs analytics |
| Docs / PDF | `docx`, `mammoth`, `jspdf`, `html2canvas` | Job application / export flows |
| Tests | Vitest + Testing Library; Playwright present | `vitest.config.ts`, `playwright.config.ts` |
| Heritage | Lovable scaffolding | `lovable-tagger` in Vite |

### Backend / platform

| Area | Choice |
|------|--------|
| Hosted DB / API | Supabase |
| Local stack | Supabase CLI + Docker; Postgres **17**; Studio `54323`; API `54321` (`supabase/config.toml`) |
| Auth | Supabase Auth (email/password) |
| Roles | `user_roles.role ∈ {admin, moderator, user}` |
| Storage | Bucket `account-files` (**public**, ~50 MiB) |
| Edge runtime | Deno edge functions; `verify_jwt = true` for all three |

### Auth model (app)

- `src/contexts/AuthContext.tsx` — `signInWithPassword` / `signUp` / `signOut`; loads roles from `user_roles`
- `src/components/ProtectedRoute.tsx` — login required; only `/admin/roles` requires `admin` in the UI
- **Most `/admin/*` routes are reachable by any authenticated user**; RLS is the real boundary (admins see all tenants)

---

## 3. Main modules and responsibilities

### Auth & OAuth routes

| Route | Page | Domain |
|-------|------|--------|
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth pages | Account |
| `/oauth/google-drive/callback` | `OAuthGoogleDriveCallback.tsx` | Drive connect |
| `/oauth/box/callback` | `OAuthBoxCallback.tsx` | Box connect |
| `/` → `/dashboard` | redirect | — |

### Dashboard (`FrontendLayout`)

| Route | Page | Responsibility |
|-------|------|----------------|
| `/dashboard` | `DashboardOverview.tsx` | Cross-module KPIs |
| `/dashboard/projects` | `Projects.tsx` | Project list/detail |
| `/dashboard/clients` | `Clients.tsx` | Client browse |
| `/dashboard/accounts` | `FreelancingAccounts.tsx` | Marketplace/tool accounts |
| `/dashboard/payments` | `Payments.tsx` | Ledger view |
| `/dashboard/tasks` | `TaskPool.tsx` | Task pool / leads; kanban; limited owner edits |
| `/dashboard/personnel` | `Personnel.tsx` | Team/developer roster |
| `/dashboard/applied-jobs/*` | Applied Jobs hub | Job-search CRM |
| `/dashboard/useful-links` | `UsefulLinks.tsx` | Internal help / knowledge base |
| Legacy `/dashboard/job-interviews*` | redirects | → applied-jobs interviews |

### Applied Jobs nested routes (`AppliedJobsLayout`)

| Route | Page | Domain |
|-------|------|--------|
| `.../applied-jobs` | `AppliedJobsOverview.tsx` | Targets, recent apps, upcoming interviews |
| `.../record`, `.../record/:id` | `AppliedJobsRecord.tsx` | Create/edit application; AI cover letter/resume |
| `.../analytics` | `AppliedJobsAnalytics.tsx` | Charts |
| `.../interviews`, `.../interviews/:id` | Interviews pages | Pipeline + detail |
| `.../settings` | `AppliedJobsSettings.tsx` | Per-user job-search prefs |

### Admin / Manage (`AdminLayout`)

| Route | Page | Notes |
|-------|------|--------|
| `/admin` → `/admin/tasks` | — | Default manage home |
| `/admin/roles` | `AdminRoles.tsx` | **admin-only** UI |
| `/admin/accounts` | `AdminAccounts.tsx` | Full freelancing-account CRUD |
| `/admin/payments` | `AdminPayments.tsx` | Manual ledger + task finance confirmations |
| `/admin/projects` | `AdminProjects.tsx` | Full project CRUD |
| `/admin/clients` | `AdminClients.tsx` | Full client CRUD |
| `/admin/tasks` | `AdminTaskPool.tsx` | Largest module: pool CRUD, finance, accrual, promote-to-project, kanban |
| `/admin/personnel` | `AdminPersonnel.tsx` | Personnel CRUD + profile blocks |
| `/admin/applied-jobs/*` | Same hub; admin interviews page | |
| `/admin/useful-links` | `AdminUsefulLinks.tsx` | Help article CRUD |
| `/admin/settings` | `AdminSettings.tsx` | Google Drive connection card |

### Domain → libs → tables

| Domain | Key libs (`src/lib/`) | Core tables |
|--------|------------------------|-------------|
| Task pool | `taskPool.ts`, `taskPoolFinance.ts`, `taskPoolAccrual*`, `taskPoolStatusTransitions.ts` | `task_pool_items`, screenshots, source_files, chat, subtasks, `task_pool_accrual_periods` |
| Projects | `projects.ts` | `projects`, `project_*` (+ promote RPC) |
| Clients | `clientSearch.ts` | `clients` |
| Personnel | `personnelProfileBlocks.ts`, `identityDocuments.ts` | `personnel` |
| Freelancing accounts | `accountPlatforms.ts` | `freelancing_accounts` |
| Payments | `payments.ts`, `paymentAccounts.ts`, `paymentAccountModel.ts` | `payment_entries`, `payment_accounts` |
| Job interviews | `jobInterviews.ts`, stages/pipeline/seed libs | `job_interviews`, stages, screenshots |
| Job applications | `jobApplications.ts`, `jobApplicationAi.ts`, parse/docs/cover letter | `job_applications`, `job_application_settings` |
| Cloud | `cloud/googleDrive.ts`, `cloud/box.ts`, `driveFolderList.ts` | `user_cloud_storage_connections` |
| Help | `usefulLinksCategories.ts` | `useful_links` |

**Richest domain:** task pool → finance/accrual → promote-to-project (`promote_task_pool_to_project`).

**Unused leftovers (not wired in `App.tsx`):** `src/pages/Index.tsx` (Lovable placeholder), `PlaceholderPage.tsx`.

---

## 4. API integrations and database

### External integrations

| Integration | How | Status |
|-------------|-----|--------|
| **Supabase Auth / DB / Storage** | Direct client | Primary backend |
| **Google Drive** | Edge `cloud-storage-google` + OAuth callbacks; folder image listing; client-side upload with returned access token | **Active** |
| **Box** | Edge `cloud-storage-box` (auth + multipart upload + public share link) | **Partially wired** (callback/upload exist; Settings UI focuses on Drive) |
| **Gemini AI** | Edge `job-application-ai` → Generative Language API (default model `gemini-2.5-flash-lite`) | **Active** for cover letter / tailored resume |
| **Stripe** | Enum/label on payment accounts only | **Not** a live Stripe API |
| **Email** | Supabase Auth email; local Inbucket | No SendGrid/Resend app mailer |
| **Dropbox / OneDrive / Mega / …** | Storage-type enums + URL helpers | Mostly **URL storage**, not OAuth |

### Environment templates

| File | Purpose |
|------|---------|
| `.env.example` | Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_GOOGLE_DRIVE_API_KEY` |
| `supabase/.env.local.example` | Edge functions: `GEMINI_*`, `GOOGLE_CLIENT_*`, `BOX_CLIENT_*` |
| `.env.backup.example` | Backup script credentials |

Copy examples to gitignored local files before running. Production function secrets are set via `supabase secrets` (see AI function error text / ops docs).

### Edge functions (`supabase/functions/`)

| Function | JWT | Purpose |
|----------|-----|---------|
| `job-application-ai` | yes | Authenticated Gemini generation |
| `cloud-storage-google` | yes | OAuth URL/exchange, token refresh, list folder images, proxy file image |
| `cloud-storage-box` | yes | OAuth + server-side upload/share |

CORS on functions: `Access-Control-Allow-Origin: *` (mitigated by JWT requirement).

### Schema highlights (~44 migrations under `supabase/migrations/`)

**Created in-repo:** projects (+ children), task pool (+ children + accrual), payment_entries/accounts, job_interviews (+ stages/screenshots), job_applications (+ settings), useful_links, user_cloud_storage_connections, profiles/user_roles (in RLS migration).

**Assumed pre-existing (ALTER only — no `CREATE TABLE` in this repo’s migrations):**

- `clients`
- `personnel`
- `freelancing_accounts`

Fresh `supabase db reset` on an empty DB **will fail or leave CRM tables missing** unless those tables exist from a remote dump / earlier Lovable schema.

**Task pool evolution:** statuses (including paused/free), Trello-like subtask columns, finance fields (fees, withdrawn, milestones), accrual periods, README / important notes, promote-to-project RPC.

**Multi-tenant RLS** (`20260523120000_multi_tenant_rls.sql`):

- Helpers: `is_app_admin()`, `can_access_pool_item`, `can_access_project`, `can_access_job_interview`, `can_access_payment_entry`
- Pattern: own rows + admin override; child rows via parent access
- New users get `profiles` + default `user` role via trigger `handle_new_user_profile`

**Storage:** public `account-files` used by image galleries and job-application uploads.

---

## 5. Repository structure

```
FreelancerHub/
├── src/                      # React SPA
│   ├── components/           # UI + feature components (incl. ui/, appliedJobs/)
│   ├── contexts/             # AuthContext
│   ├── hooks/
│   ├── lib/                  # Domain helpers + Supabase/cloud clients
│   ├── pages/                # Route pages (incl. appliedJobs/)
│   ├── App.tsx               # Routes
│   └── main.tsx
├── supabase/
│   ├── migrations/           # Schema evolution
│   ├── functions/            # job-application-ai, cloud-storage-google, cloud-storage-box
│   └── config.toml
├── docs/
│   ├── PROJECT-OVERVIEW.md   # This file
│   ├── DISASTER-RECOVERY.md
│   └── guides/               # backup, env config, local Supabase
├── scripts/                  # backup-supabase.ps1, verify-gemini-job-ai.mjs
├── tools/, public/, backups/
├── package.json              # name: benchhub
├── .env.example
└── README.md
```

### Useful npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm test` | Vitest |
| `npm run supabase:start` / `stop` / `reset` | Local Supabase |
| `npm run supabase:functions` | Serve edge functions with `supabase/.env.local` |
| `npm run backup:supabase` | DB backup (PowerShell) |
| `npm run verify:gemini-job-ai` | Smoke-check Gemini job AI |

### Ops docs (start here for environments)

| Guide | Description |
|-------|-------------|
| [DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md) | Full restore runbook |
| [Backup guide](./guides/backup-supabase.md) | `npm run backup:supabase` |
| [Env config guide](./guides/env-based-supabase-config.md) | Cloud vs local frontend |
| [Local Supabase guide](./guides/local-supabase-development.md) | Docker local stack |

---

## 6. Potential technical issues (handover risks)

### Security

1. **OAuth tokens in a client-readable table** — `user_cloud_storage_connections` stores `access_token` / `refresh_token` with SELECT-own RLS. XSS or a malicious client script can read them. Prefer vault / service-role-only storage; avoid returning refresh tokens to the browser.
2. **Hardcoded production anon URL/key** in `src/lib/supabase.ts` and `.env.example` — unset env falls back to the cloud project.
3. **Public storage bucket** — resumes/screenshots get public URLs (unguessable paths only).
4. **Admin UI ≠ admin-only** — only Roles is role-gated in the UI; other `/admin` pages rely on RLS. Non-admins can open Manage UI and mutate **their own** rows (may be intentional).
5. **`moderator` role** is assignable but largely unused in route guards / RLS (only `admin` is special).
6. **Box shared links** may be created with open access — files can become publicly shareable by design.
7. **CORS `*`** on edge functions — mitigated by JWT, still broad.

### Env / ops

- Edge secrets (`GEMINI_API_KEY`, Google/Box OAuth) required for AI/Drive/Box; missing → failures with helpful messages when configured that way.
- Dual config docs under `docs/guides/` are solid; production secrets must be set via `supabase secrets`.

### Package / naming hygiene

- Both `package-lock.json` and `bun.lock` exist → **npm vs bun drift risk**. Prefer one package manager for the team.
- Folder name FreelancerHub vs package/brand **BenchHub**.
- Root file `components (1).json` looks like a stray export — candidate for cleanup.

### Incomplete / inconsistent features

- App comment “Frontend read-only” vs editable Task Pool / Applied Jobs.
- Box OAuth + upload without Settings parity with Drive.
- Stripe/Dropbox/etc. as **labels/URLs**, not live APIs.
- Applied Jobs Settings theme/font fields may be stored without a clear global theme system.
- `Index.tsx` / `PlaceholderPage` dead code.
- Many storage providers enumerated in DB checks but only Drive (+ partial Box) implemented.

### Schema / migration risks

- **Missing CREATE for clients/personnel/freelancing_accounts** → local reset / new environments fragile; obtain a base dump from production or add CREATE migrations before onboarding a greenfield DB.
- Early policies were permissive (`USING (true)`); later multi-tenant migration drops/recreates — **order-dependent**.
- Duplicate same-timestamp migrations exist under `20260507170000_*` — usually OK if filenames differ lexicographically, but noisy.
- Promote RPC rewritten across several migrations — apply the **full** migration chain.

### Tech debt / coupling

- Very large page components (`AdminTaskPool.tsx`, `AdminAccounts.tsx`, `AdminPersonnel.tsx`) mix UI + finance + persistence.
- Finance logic duplicated across overview/payments/task pool (`payments.ts`, `taskPoolFinance.ts`, accrual services).
- React Query provider present but inconsistent adoption.
- Domain tables tightly coupled: task pool ↔ clients ↔ accounts ↔ payment_entries ↔ projects.
- JWT retry helpers (`supabaseJwtRetry.ts`) paper over session edge cases across cloud invokes.

---

## 7. Must-read files for a new owner

| Purpose | Path |
|---------|------|
| Routes | `src/App.tsx` |
| Entry | `src/main.tsx` |
| Supabase client | `src/lib/supabase.ts` |
| Auth | `src/contexts/AuthContext.tsx` |
| Route guards | `src/components/ProtectedRoute.tsx` |
| Local Supabase | `supabase/config.toml` |
| Tenant RLS | `supabase/migrations/20260523120000_multi_tenant_rls.sql` |
| Edge AI / Drive / Box | `supabase/functions/*/index.ts` |
| Deps / scripts | `package.json` |
| Ops docs | `docs/` |

---

## 8. Bottom line

**BenchHub** is a freelance operations platform: task/lead pipeline with finance and accrual, projects, clients, personnel, marketplace accounts, payments, and an Applied Jobs CRM with Gemini assist.

Architecture: **Vite/React SPA → Supabase (Auth + Postgres RLS + Storage)**, plus **three JWT-gated edge functions** for Gemini and cloud OAuth.

Deepest domain: **task pool + finance/accrual + promote-to-project**.

Highest-priority risks for the next owner:

1. Client-readable OAuth tokens  
2. Dual lockfiles (npm vs bun)  
3. CRM base tables (`clients` / `personnel` / `freelancing_accounts`) absent from migration CREATE  
4. Admin routes that are not admin-gated in the UI (RLS is the real gate)

---

## Suggested first week for a new engineer

1. Read this overview + [env config](./guides/env-based-supabase-config.md) + [local Supabase](./guides/local-supabase-development.md).  
2. Copy `.env.example` → `.env.local` and `supabase/.env.local.example` → `supabase/.env.local`; decide cloud vs local.  
3. Run `npm install` (or agree on bun), `npm run dev`, and optionally `npm run supabase:start` + `npm run supabase:functions`.  
4. Walk the happy path: login → Task Pool (admin) → Payments → Applied Jobs AI (needs Gemini secret).  
5. Skim `20260523120000_multi_tenant_rls.sql` and the three edge function entrypoints before changing auth or cloud storage.  
6. Confirm how to obtain a DB dump that includes `clients` / `personnel` / `freelancing_accounts` before relying on `supabase db reset` alone.
