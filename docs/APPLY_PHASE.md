# Apply Phase — one-time Cloud bring-up

This file documents the one-time setup to bring the repo online against Supabase Cloud. After these steps, daily dev is just `./scripts/start.sh`.

The MVP code is complete (tagged `v0.1.0-pre-apply`). The remote Cloud project has NOT yet been linked, migrations have NOT been pushed, and the seed has NOT been run. Work through the steps below in order.

Project ref: **`zwbuiccyxebgfwlguscl`**
Dashboard: <https://supabase.com/dashboard/project/zwbuiccyxebgfwlguscl>

---

## 1. `supabase login`

```bash
supabase login
```

This opens a browser window and exchanges an access token that the CLI stores under `~/.supabase/`. You need this before `supabase link` can talk to the Cloud API.

If you already ran `supabase login` on this machine recently, you can skip this step.

---

## 2. `supabase link --project-ref zwbuiccyxebgfwlguscl`

```bash
cd /Users/gianmichele/Development/Personal/pharma-plan-pro
supabase link --project-ref zwbuiccyxebgfwlguscl
```

The CLI will prompt for the **database password** (not the dashboard password). You can find or reset it at:

Dashboard → **Settings → Database → Connection string / Reset database password**
<https://supabase.com/dashboard/project/zwbuiccyxebgfwlguscl/settings/database>

Successful link writes `supabase/.temp/project-ref` and caches credentials. `./scripts/start.sh` checks for this marker.

---

## 3. `supabase db push`

```bash
supabase db push
```

Applies all 8 migrations in `supabase/migrations/` to the remote Cloud database in order:

1. `20260417_0001_enums.sql`
2. `20260417_0002_employees.sql`
3. `20260417_0003_weekly_patterns.sql`
4. `20260417_0004_shifts.sql`
5. `20260417_0005_absences.sql`
6. `20260417_0006_training.sql`
7. `20260417_0007_daily_notes.sql`
8. `20260417_0008_coverage_rules.sql`

Confirm with `y` when prompted.

---

## 4. Seed

Two options:

**Option A — psql (from shell):**

```bash
psql "postgres://postgres:<DB_PASSWORD>@db.zwbuiccyxebgfwlguscl.supabase.co:5432/postgres" \
  -f supabase/seed.sql
```

Replace `<DB_PASSWORD>` with the DB password from Step 2. URL-encode it if it contains special characters.

**Option B — Dashboard SQL editor (no psql needed):**

1. Open <https://supabase.com/dashboard/project/zwbuiccyxebgfwlguscl/sql/new>
2. Paste the full content of `supabase/seed.sql`
3. Click **Run**

### Expected row counts after seeding

| Table                      | Rows |
|----------------------------|------|
| `plan_employees`           | 19   |
| `plan_weekly_patterns`     | 67   |
| `plan_training_courses`    | 18   |
| `plan_training_participants` | 27 |

Verify in the Dashboard **Table editor** or with:

```sql
select
  (select count(*) from plan_employees)             as employees,
  (select count(*) from plan_weekly_patterns)       as weekly_patterns,
  (select count(*) from plan_training_courses)      as training_courses,
  (select count(*) from plan_training_participants) as training_participants;
```

---

## 5. Regenerate TypeScript types (recommended)

```bash
supabase gen types typescript --linked > frontend/src/lib/database.types.ts
```

Replaces the hand-written placeholder with the canonical generated types. Re-run this after every migration.

Then re-run typecheck to make sure nothing drifted:

```bash
cd frontend && npm run typecheck
```

---

## 6. Create the admin user

1. Open <https://supabase.com/dashboard/project/zwbuiccyxebgfwlguscl/auth/users>
2. Click **Add user → Create new user**
3. Fill in:
   - **Email:** `admin@tpz.local`
   - **Password:** `TestPass123!`
   - **Auto Confirm User:** tick the box (otherwise a confirmation email is required)
4. Click **Create user**

This is the account you'll log in with during the UI smoke checklist (Step 8). Rotate the password to something real once you're past the MVP smoke.

---

## 7. Run the dev server

```bash
./scripts/start.sh
```

Opens http://localhost:5173. The script verifies the CLI is installed, the project is linked, `frontend/node_modules` exists, and `frontend/.env.local` is populated.

---

## 8. UI smoke checklist

Run through this table in the browser, in order. This is copied verbatim from the plan (Task 16 Step 1).

| # | Action | Expected |
|---|--------|----------|
| 1 | Open http://localhost:5173 | Redirect to /login |
| 2 | Sign in admin@tpz.local | Land on dashboard |
| 3 | Dashboard card "Active employees" | Shows 17 (all except SI + MW are `terminated` in seed — if showing 19, check seed) |
| 4 | Open /employees, filter "only active" | 17 rows |
| 5 | Uncheck filter | 19 rows |
| 6 | Edit KR, change % to 95, save | Row updates, no error |
| 7 | Create new employee ZZ / Test / User / pha | Appears in list |
| 8 | Delete ZZ via active toggle — deactivate, check filter | Disappears when filter active |
| 9 | /absences — add absence for KR 2026-07-15 to 2026-07-31 VACATION | Row appears with "KR Katja Renette" |
| 10 | Delete absence | Gone |
| 11 | /shifts — navigate to April 2026 | Grid renders, 6 weeks visible |
| 12 | Click cell 2026-04-15, add shift LH FULL_DAY | Shift appears in cell |
| 13 | Reload page | Shift persists |
| 14 | Delete shift | Gone |
| 15 | Language switcher EN → DE → IT | Nav labels translate |
| 16 | Sign out | Back to /login |

If all 16 rows pass, cut the final tag:

```bash
cd /Users/gianmichele/Development/Personal/pharma-plan-pro
git tag -a v0.1.0 -m "MVP: employees + absences + shifts on Supabase — smoke verified"
git push --tags
```

---

## 9. Optional: reset DB without touching auth users

If you want to wipe the planning data and re-seed while keeping the `admin@tpz.local` user intact, run in the SQL editor:

```sql
truncate table
  plan_training_participants,
  plan_training_courses,
  plan_weekly_patterns,
  plan_absences,
  plan_shifts,
  plan_employees
restart identity cascade;
```

Then re-run the seed (Step 4). Auth users live in the `auth.users` table and are untouched.

---

## 10. Security reminder — rotate the service_role key

The `service_role` key was shared in chat during planning. It bypasses Row-Level Security and must be treated as a secret.

**Rotate it now:** Dashboard → **Settings → API → Reset `service_role` secret**
<https://supabase.com/dashboard/project/zwbuiccyxebgfwlguscl/settings/api>

The MVP frontend only uses the `anon` public key (`VITE_SUPABASE_ANON_KEY` in `frontend/.env.local`), so rotating `service_role` will not break the app. If you later build a backend worker or migration tool that needs `service_role`, store it in a password manager or CI secret store — never commit it and never paste it into a chat transcript.
