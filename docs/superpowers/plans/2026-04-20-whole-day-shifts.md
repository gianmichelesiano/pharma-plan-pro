# Whole-Day Shifts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse FULL_DAY / MORNING / AFTERNOON / SATURDAY_ROTATING into a single whole-day shift unit across DB, planning engine, and frontend.

**Architecture:** Drop `shift_type` enum and every `slot` column. One shift record per `(employee, date)`. Weekly pattern = one row per `(employee, weekday)`. Coverage rule = one row per `(weekday, role, time_window)`. Frontend renders one cell per day. Dev DB is wiped; no runtime migration required.

**Tech Stack:** Postgres (Supabase Cloud), Supabase Edge Functions (Deno/TypeScript), React + Vite + TypeScript, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-04-20-whole-day-shifts-design.md`

---

## Task 1: Edit base migrations to final shape

**Files:**
- Modify: `supabase/migrations/20260417100001_enums.sql`
- Modify: `supabase/migrations/20260417100003_weekly_patterns.sql`
- Modify: `supabase/migrations/20260417100004_shifts.sql`
- Modify: `supabase/migrations/20260417100008_coverage_rules.sql`

- [ ] **Step 1: Remove `shift_type` enum definition**

Edit `20260417100001_enums.sql`, delete lines 16-20 (the `create type shift_type ...` block). File ends after `absence_status` enum.

- [ ] **Step 2: Rewrite `weekly_patterns.sql`**

Replace full content of `20260417100003_weekly_patterns.sql` with:

```sql
-- Base working pattern per employee, per weekday. Whole-day.
-- weekday: 0 = Mon, 1 = Tue, ..., 6 = Sun (ISO: Mon-first).
create table weekly_patterns (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (employee_id, weekday)
);

create index weekly_patterns_employee_idx on weekly_patterns (employee_id);
create index weekly_patterns_weekday_idx on weekly_patterns (weekday);
```

- [ ] **Step 3: Rewrite `shifts.sql`**

Replace full content of `20260417100004_shifts.sql` with:

```sql
-- Concrete planned shift for one employee on one date. Whole-day only.
create table shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  shift_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, shift_date)
);

create index shifts_date_idx on shifts (shift_date);
create index shifts_employee_idx on shifts (employee_id);

create trigger shifts_set_updated_at
before update on shifts
for each row execute function set_updated_at();
```

- [ ] **Step 4: Rewrite `coverage_rules.sql`**

Replace full content of `20260417100008_coverage_rules.sql` with:

```sql
create table coverage_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  role employee_role not null,
  min_required smallint not null check (min_required >= 0),
  time_window text not null default 'all_day',
  note text,
  unique (weekday, role, time_window)
);
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260417100001_enums.sql supabase/migrations/20260417100003_weekly_patterns.sql supabase/migrations/20260417100004_shifts.sql supabase/migrations/20260417100008_coverage_rules.sql
git commit -m "refactor(db): whole-day schema for enums, patterns, shifts, coverage_rules"
```

---

## Task 2: Rewrite planning engine migration

**Files:**
- Modify: `supabase/migrations/20260420100009_planning_engine.sql`

- [ ] **Step 1: Strip `shift_type` from `planning_draft_shifts`**

In `20260420100009_planning_engine.sql`, replace the `planning_draft_shifts` table definition (lines 19-32) with:

```sql
create table planning_draft_shifts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references planning_runs(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  shift_date date not null,
  source text not null default 'baseline' check (source in ('baseline', 'repair', 'manual', 'suggestion')),
  legacy_code text,
  created_at timestamptz not null default now(),
  unique (run_id, employee_id, shift_date)
);

create index planning_draft_shifts_run_idx on planning_draft_shifts (run_id, shift_date);
create index planning_draft_shifts_emp_idx on planning_draft_shifts (employee_id, shift_date);
```

- [ ] **Step 2: Strip `slot` from `planning_issues`**

Replace the `planning_issues` table block (lines 34-48) with:

```sql
create table planning_issues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references planning_runs(id) on delete cascade,
  issue_date date not null,
  role employee_role,
  severity text not null default 'warning' check (severity in ('warning', 'critical')),
  code text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index planning_issues_run_idx on planning_issues (run_id, issue_date);
```

- [ ] **Step 3: Strip `slot` from `planning_suggestions`**

Open the rest of `20260420100009_planning_engine.sql`. For the `planning_suggestions` table, remove any `slot` column and its check constraint. If the table has a unique/index that references `slot`, remove `slot` from that constraint. Leave all other columns intact.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420100009_planning_engine.sql
git commit -m "refactor(db): whole-day schema in planning engine tables"
```

---

## Task 3: Rewrite seed

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Remove `slot` column from `weekly_patterns` inserts**

In `supabase/seed.sql`, find `insert into weekly_patterns`. Rewrite the column list as `(employee_id, weekday, active)` and deduplicate rows so there is exactly one row per `(employee, weekday)` where the employee works that day. Drop all `SATURDAY_ROTATING` rows (modeled as direct `shifts` inserts instead). For rows that had both MORNING and AFTERNOON, keep one.

- [ ] **Step 2: Remove `slot` column from `coverage_rules` inserts**

In the same file, find `insert into coverage_rules`. Rewrite column list as `(weekday, role, min_required, time_window)` and deduplicate rows so there is one row per `(weekday, role, time_window)`. When multiple slots had different `min_required` for the same weekday+role, use the maximum.

- [ ] **Step 3: Drop any `shifts` / `shift_type` seed entries**

If `supabase/seed.sql` contains `insert into shifts`, rewrite the column list as `(employee_id, shift_date, note)` and remove `shift_type`, `start_time`, `end_time` values.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "refactor(seed): whole-day patterns and coverage rules"
```

---

## Task 4: Reset DB and verify schema

**Files:**
- Read only.

- [ ] **Step 1: Run `supabase db reset`**

Run: `supabase db reset --linked`
Expected: All migrations apply without errors. Seed loads.

- [ ] **Step 2: Verify no `shift_type` / `slot` columns remain**

Run:
```bash
supabase db query "select column_name, table_name from information_schema.columns where column_name in ('shift_type','slot') and table_schema='public';"
```
Expected: zero rows.

- [ ] **Step 3: Verify `shift_type` enum gone**

Run:
```bash
supabase db query "select typname from pg_type where typname='shift_type';"
```
Expected: zero rows.

- [ ] **Step 4: No commit**

Verification step; nothing to commit.

---

## Task 5: Update planning-engine edge function

**Files:**
- Modify: `supabase/functions/planning-engine/index.ts`

- [ ] **Step 1: Remove `ShiftType` type and slot helpers**

Delete the following from the top of the file:
- `type ShiftType = "MORNING" | "AFTERNOON" | "FULL_DAY";`
- Pattern/rule/shift interfaces' `slot` and `shift_type` fields
- Functions `shiftFromSlot` and `hasSlotAvailability`

- [ ] **Step 2: Rewrite pattern fetch and baseline generation**

Replace the `weekly_patterns` select with:
```ts
.select("employee_id, weekday, active")
```

Replace the baseline generation loop (around lines 200-250 in current file) with:

```ts
for (const emp of activeEmployees) {
  const patterns = patternMap.get(emp.id) ?? [];
  const worksToday = patterns.some((p) => p.weekday === weekday && p.active);
  if (!worksToday) continue;
  draftShifts.push({
    run_id: runId,
    employee_id: emp.id,
    shift_date: date,
    source: "baseline",
    legacy_code: "1",
  });
}
```

- [ ] **Step 3: Rewrite coverage check**

Replace the per-slot coverage loop with:

```ts
for (const rule of coverageRules.filter((r) => r.weekday === weekday)) {
  const assigned = dayShifts.filter((s) => {
    const emp = employeeMap.get(s.employee_id);
    return emp?.role === rule.role;
  }).length;
  if (assigned < rule.min_required) {
    issues.push({
      run_id: runId,
      issue_date: date,
      role: rule.role,
      severity: "critical",
      code: "COVERAGE_SHORTAGE",
      message: `Need ${rule.min_required} ${rule.role}(s), have ${assigned}`,
      details: { required: rule.min_required, assigned },
    });
  }
}
```

Replace the `coverage_rules` select with:
```ts
.select("weekday, role, min_required, time_window")
```

- [ ] **Step 4: Remove `shift_type` from all select/insert statements**

Find every `.select(...)` or `.insert(...)` on `shifts` or `planning_draft_shifts` that references `shift_type`; drop that field. Example: `.select("id, employee_id, shift_date, source, legacy_code, ...")`.

- [ ] **Step 5: Rewrite manual-shift webhook handler**

In the handler around line 630 (accepts manual shift payload), replace the shift-type validation block with:

```ts
if (!employeeId || !shiftDate) {
  return new Response("employee_id and shift_date required", { status: 400 });
}
await supabase.from("planning_draft_shifts").insert({
  run_id: runId,
  employee_id: employeeId,
  shift_date: shiftDate,
  source: "manual",
  legacy_code: "1",
});
```

- [ ] **Step 6: Typecheck edge function**

Run: `cd supabase/functions/planning-engine && deno check index.ts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/planning-engine/index.ts
git commit -m "refactor(planning-engine): whole-day shift model"
```

---

## Task 6: Regenerate frontend DB types

**Files:**
- Modify: `frontend/src/lib/database.types.ts`

- [ ] **Step 1: Regenerate types**

Run: `supabase gen types typescript --linked > frontend/src/lib/database.types.ts`
Expected: file updates, no `shift_type` enum, no `slot` columns.

- [ ] **Step 2: Verify**

Run: `grep -E "shift_type|\"slot\"|SATURDAY_ROTATING" frontend/src/lib/database.types.ts`
Expected: zero output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/database.types.ts
git commit -m "chore(types): regenerate DB types for whole-day schema"
```

---

## Task 7: Simplify `SchedulePage`

**Files:**
- Modify: `frontend/src/pages/SchedulePage.tsx`

- [ ] **Step 1: Delete slot types and constants**

Remove: `type ShiftType = ...`, `SLOT_HOURS`, `SLOT_LABEL` constants.

- [ ] **Step 2: Change shift insertion mutation**

Update the insert mutation (around line 93):
```ts
const { error } = await supabase
  .from("shifts")
  .insert({ employee_id: employeeId, shift_date: date });
```
Drop the `shiftType` parameter from the mutation function signature and from callers.

- [ ] **Step 3: Change shift index key**

Replace `const key = \`${shift.shift_date}-${shift.shift_type}\`;` with `const key = shift.shift_date;`. Update the `Map` type accordingly to `Map<string, Shift[]>`.

- [ ] **Step 4: Rewrite day-cell render**

Around line 241, replace the slot-by-slot rendering (the `slotTypes` array, the inner loop, the FULL_DAY merging) with a single cell per day:

```tsx
{days.map((day) => {
  const dayShifts = shiftsByDate.get(day) ?? [];
  return (
    <td key={day}>
      {dayShifts.map((s) => (
        <div key={s.id} className="shift-cell">
          {s.employee?.display_code}
        </div>
      ))}
    </td>
  );
})}
```

Remove the weekend/weekday branching and the Sunday empty-array special case (Sunday rows will naturally be empty when no patterns exist).

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/SchedulePage.tsx
git commit -m "refactor(schedule): single whole-day cell per day"
```

---

## Task 8: Simplify `PianificazionePage`

**Files:**
- Modify: `frontend/src/pages/PianificazionePage.tsx`

- [ ] **Step 1: Delete `ShiftType` union and `shiftLabel`**

Remove: `type ShiftType = ...;`, any `shiftLabel` function, any `shift_type` property in local row types.

- [ ] **Step 2: Update `toggleMutation` payload**

Change the mutation so it takes `{ employeeId, date }` only. Body:

```ts
const existing = await supabase
  .from("shifts")
  .select("id")
  .eq("employee_id", employeeId)
  .eq("shift_date", date)
  .maybeSingle();
if (existing.data) {
  const { error } = await supabase.from("shifts").delete().eq("id", existing.data.id);
  if (error) throw error;
} else {
  const { error } = await supabase
    .from("shifts")
    .insert({ employee_id: employeeId, shift_date: date });
  if (error) throw error;
}
```

- [ ] **Step 3: Update sort and render**

Remove `arr.sort((a, b) => a.shift_type.localeCompare(b.shift_type));` (sort by `employee_id` instead if needed).

Replace the badge render (around line 391):
```tsx
<span key={s.id} className="piano-badge">
  {s.employee?.display_code ?? "?"}
</span>
```

- [ ] **Step 4: Update toggle buttons**

Remove separate MORNING/AFTERNOON/FULL_DAY toggle buttons; render a single per-day toggle:

```tsx
<button onClick={() => toggleMutation.mutate({ employeeId: emp.id, date: day })}>
  {hasShift ? "✓" : "·"}
</button>
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/PianificazionePage.tsx
git commit -m "refactor(pianificazione): whole-day toggle per cell"
```

---

## Task 9: Simplify `AvailabilityPage`

**Files:**
- Modify: `frontend/src/pages/AvailabilityPage.tsx`

- [ ] **Step 1: Delete slot constants**

Remove: `WEEKDAY_SLOTS`, `SATURDAY_SLOTS`, `allCols` arrays and any slot-based iteration.

- [ ] **Step 2: Rewrite pattern map**

Change the indexing from `\`${p.weekday}-${p.slot}\`` to just `String(p.weekday)`:

```ts
const map: Record<string, boolean> = {};
patterns.forEach((p) => { map[String(p.weekday)] = p.active; });
```

- [ ] **Step 3: Rewrite table header**

Replace the header row with a single "Works" column per weekday:

```tsx
<tr>
  <th>{t.employee}</th>
  <th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th>
</tr>
```

- [ ] **Step 4: Rewrite body cells**

Each cell renders a single checkbox bound to `map[String(weekday)]`. On change, upsert `{ employee_id, weekday, active }` into `weekly_patterns`.

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AvailabilityPage.tsx
git commit -m "refactor(availability): whole-day toggle per weekday"
```

---

## Task 10: Simplify `RulesPage`

**Files:**
- Modify: `frontend/src/pages/RulesPage.tsx`

- [ ] **Step 1: Remove slot from rule key definitions**

Find the local `defs` array (around line 40-60). Change each `def` so it has `{ weekday, label }` only — drop `slot`. Deduplicate so there is one def per weekday.

- [ ] **Step 2: Update key and filters**

Replace `const key = \`${def.weekday}-${def.slot}\`;` (appears twice) with `const key = String(def.weekday);`.

Update filters:
```ts
(r) => r.weekday === def.weekday && r.role === "pharmacist"
(r) => r.weekday === def.weekday && r.role !== "pharmacist"
```

- [ ] **Step 3: Update upsert payloads**

Remove `slot: def.slot` from both upsert objects.

- [ ] **Step 4: Update table header**

Remove `<th>{t.slotHeader}</th>` from the header row.

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/RulesPage.tsx
git commit -m "refactor(rules): whole-day coverage rules"
```

---

## Task 11: Clean up translations and shell

**Files:**
- Modify: `frontend/src/i18n/translations.ts`
- Modify: `frontend/src/components/AppShell.tsx`

- [ ] **Step 1: Delete slot/shift-type labels from translations**

Open `frontend/src/i18n/translations.ts`. Remove any keys matching: `shiftType`, `slot`, `MORNING`, `AFTERNOON`, `FULL_DAY`, `SATURDAY_ROTATING`, `slotHeader`, `am`, `pm`. Remove the same keys from every language object (it, en, de, fr if present).

- [ ] **Step 2: Remove references in `AppShell.tsx`**

Open `frontend/src/components/AppShell.tsx`. Remove any component that displays slot/shift-type labels. Compile errors will tell you exactly which lines.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/translations.ts frontend/src/components/AppShell.tsx
git commit -m "refactor(i18n): remove slot/shift-type labels"
```

---

## Task 12: Clean up CSS

**Files:**
- Modify: `frontend/src/styles/app.css`

- [ ] **Step 1: Remove slot-specific classes**

Search for and remove the following classes (full rule blocks, not just the selector):
- `.slot-stack`
- `.slot-morning`, `.slot-afternoon`, `.slot-full-day` (any variant)
- `.piano-badge-morning`, `.piano-badge-afternoon`, `.piano-badge-full_day`
- `.shift-full-day`, `.shift-morning`, `.shift-afternoon`

- [ ] **Step 2: Add single `.shift-cell` rule**

Add to the file:

```css
.shift-cell {
  display: inline-block;
  padding: 2px 6px;
  margin: 1px;
  border-radius: 4px;
  background: var(--color-sage-100, #e7efe5);
  font-size: 0.85rem;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/app.css
git commit -m "style: whole-day shift cell class"
```

---

## Task 13: Training page sanity check

**Files:**
- Read only: `frontend/src/pages/TrainingPage.tsx`

- [ ] **Step 1: Verify no slot references**

Run: `grep -nE "slot|shift_type|MORNING|AFTERNOON|FULL_DAY|SATURDAY_ROTATING" frontend/src/pages/TrainingPage.tsx`
Expected: zero output. (Prior scan showed none; re-verify.)

- [ ] **Step 2: No commit**

---

## Task 14: Final verification

**Files:**
- Read only.

- [ ] **Step 1: Full-repo grep for stale references**

Run:
```bash
grep -rnE "shift_type|SATURDAY_ROTATING|FULL_DAY|'MORNING'|\"MORNING\"|'AFTERNOON'|\"AFTERNOON\"" frontend/src supabase
```
Expected: zero output outside of `docs/` and migration history comments. If matches remain, fix them and add to the relevant task's commit.

- [ ] **Step 2: Build frontend**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: DB reset + seed**

Run: `supabase db reset --linked`
Expected: success.

- [ ] **Step 4: Smoke-test planning engine**

Run: `supabase functions invoke planning-engine --body '{"year":2026,"month":5,"action":"generate"}'`
Expected: HTTP 200 with a run ID in response.

- [ ] **Step 5: Smoke-test UI**

Run: `cd frontend && npm run dev`
Open `http://localhost:5173`. Visit each of `SchedulePage`, `PianificazionePage`, `AvailabilityPage`, `RulesPage`. Verify:
- No console errors.
- One cell per `(employee, day)`.
- No AM/PM labels anywhere.
- Toggle on `PianificazionePage` creates/deletes a shift.

- [ ] **Step 6: Final commit (if needed)**

If any follow-up fixes were made during verification, commit with message:

```bash
git commit -m "fix: stale slot references caught in verification"
```

---

## Out of Scope

- Custom shift hours (removed entirely).
- Automated Saturday rotation (modeled only via concrete `shifts` rows; rotation logic lives in seed/manual edits).
- Historical data migration.
