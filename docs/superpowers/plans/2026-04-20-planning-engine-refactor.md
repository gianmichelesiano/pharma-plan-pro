# Planning Engine Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current multi-table planning pipeline with a minimal monthly generator that writes directly to `shifts` (with a `source` column), preserves manual edits, and exposes coverage/conflict criticities via a Postgres RPC consumed by `/piano` and `/schedule`.

**Architecture:** Single edge-function action `generate` that computes `(employee, date)` pairs from patterns minus absences and writes `source='generated'` rows in `shifts` inside a transaction that deletes only prior generated rows in range. Criticities computed by `get_coverage_issues(start, end)` SQL function. Frontend: shared hook + badge component; `/piano` owns generation UI, both views show criticities.

**Tech Stack:** Postgres (Supabase Cloud), Supabase Edge Functions (Deno/TypeScript), React + Vite + TypeScript, TanStack Query, `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-04-20-planning-engine-refactor-design.md`

---

## Task 1: DB migration — drop obsolete tables, add `source`, add RPC

**Files:**
- Create: `supabase/migrations/20260420100010_planning_refactor.sql`

- [ ] **Step 1: Write migration**

```sql
-- 1) Drop obsolete planning tables
drop table if exists planning_legacy_code_map cascade;
drop table if exists planning_suggestions cascade;
drop table if exists planning_issues cascade;
drop table if exists planning_draft_shifts cascade;
drop table if exists planning_runs cascade;

-- 2) Add source column to shifts (manual is default; existing rows are manual)
alter table shifts
  add column source text not null default 'manual'
  check (source in ('generated', 'manual'));

create index shifts_source_idx on shifts (source);

-- 3) Coverage issues function
create or replace function get_coverage_issues(p_start date, p_end date)
returns table (
  issue_date date,
  kind text,
  role employee_role,
  required smallint,
  assigned smallint,
  employee_id uuid,
  severity text
)
language sql stable as $$
  with days as (
    select generate_series(p_start, p_end, interval '1 day')::date as d
  ),
  shortage as (
    select
      d.d as issue_date,
      'shortage'::text as kind,
      r.role,
      r.min_required as required,
      coalesce(sum(case when e.role = r.role then 1 else 0 end), 0)::smallint as assigned,
      null::uuid as employee_id,
      'critical'::text as severity
    from days d
    join coverage_rules r
      on r.weekday = ((extract(isodow from d.d)::int + 6) % 7)
      and r.time_window = 'all_day'
    left join shifts s on s.shift_date = d.d
    left join employees e on e.id = s.employee_id
    group by d.d, r.role, r.min_required
    having coalesce(sum(case when e.role = r.role then 1 else 0 end), 0) < r.min_required
  ),
  conflict as (
    select
      s.shift_date as issue_date,
      'conflict'::text as kind,
      null::employee_role as role,
      null::smallint as required,
      null::smallint as assigned,
      s.employee_id,
      'critical'::text as severity
    from shifts s
    join absences a on a.employee_id = s.employee_id
      and s.shift_date between a.start_date and a.end_date
      and a.status = 'approved'
    where s.shift_date between p_start and p_end
  )
  select * from shortage
  union all
  select * from conflict;
$$;
```

Note: `extract(isodow)` returns 1=Mon..7=Sun. Our `coverage_rules.weekday` uses 0=Mon..6=Sun, so we map via `(isodow + 6) % 7`.

- [ ] **Step 2: Run migration against cloud**

```bash
yes | supabase db reset --linked
```
Expected: all migrations apply; seed loads without error.

- [ ] **Step 3: Verify shifts.source exists and RPC callable**

```bash
supabase db query "select column_name from information_schema.columns where table_name='shifts' and column_name='source';"
supabase db query "select * from get_coverage_issues('2026-05-01','2026-05-31') limit 5;"
```
Expected: `source` listed; RPC returns rows or empty without error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420100010_planning_refactor.sql
git commit -m "feat(db): add shifts.source + get_coverage_issues RPC, drop old planning tables"
```

---

## Task 2: Regenerate frontend DB types

**Files:**
- Modify: `frontend/src/lib/database.types.ts`

- [ ] **Step 1: Regenerate**

```bash
supabase gen types typescript --linked 2>/dev/null > frontend/src/lib/database.types.ts
```

- [ ] **Step 2: Verify**

```bash
grep -E "planning_draft_shifts|planning_runs|planning_issues|planning_suggestions" frontend/src/lib/database.types.ts
```
Expected: zero output.
```bash
grep -E "\"source\"" frontend/src/lib/database.types.ts
```
Expected: at least one match (under `shifts`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/database.types.ts
git commit -m "chore(types): regenerate after planning refactor"
```

---

## Task 3: Rewrite planning-engine edge function

**Files:**
- Modify: `supabase/functions/planning-engine/index.ts`

- [ ] **Step 1: Replace file contents**

Full new file:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GenerateAction = { action: "generate"; year: number; month: number };

function monthBounds(year: number, month: number): { start: string; end: string } {
  const s = new Date(Date.UTC(year, month - 1, 1));
  const e = new Date(Date.UTC(year, month, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(s), end: iso(e) };
}

function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function weekdayMon0(iso: string): number {
  const d = new Date(iso + "T00:00:00Z").getUTCDay(); // Sun=0..Sat=6
  return (d + 6) % 7; // Mon=0..Sun=6
}

async function generate(
  supabase: ReturnType<typeof createClient>,
  year: number,
  month: number,
) {
  const { start, end } = monthBounds(year, month);
  const [empRes, patRes, absRes] = await Promise.all([
    supabase.from("employees").select("id, active").eq("active", true),
    supabase.from("weekly_patterns").select("employee_id, weekday, active").eq("active", true),
    supabase
      .from("absences")
      .select("employee_id, start_date, end_date, status")
      .eq("status", "approved")
      .lte("start_date", end)
      .gte("end_date", start),
  ]);
  if (empRes.error) throw empRes.error;
  if (patRes.error) throw patRes.error;
  if (absRes.error) throw absRes.error;

  const worksOn = new Map<string, Set<number>>();
  for (const p of patRes.data ?? []) {
    const set = worksOn.get(p.employee_id as string) ?? new Set<number>();
    set.add(p.weekday as number);
    worksOn.set(p.employee_id as string, set);
  }

  const absentOn = new Map<string, Set<string>>();
  for (const a of absRes.data ?? []) {
    const empId = a.employee_id as string;
    const from = new Date((a.start_date as string) + "T00:00:00Z");
    const to = new Date((a.end_date as string) + "T00:00:00Z");
    const clampFrom = from < new Date(start + "T00:00:00Z") ? new Date(start + "T00:00:00Z") : from;
    const clampTo = to > new Date(end + "T00:00:00Z") ? new Date(end + "T00:00:00Z") : to;
    const set = absentOn.get(empId) ?? new Set<string>();
    for (let d = new Date(clampFrom); d.getTime() <= clampTo.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
      set.add(d.toISOString().slice(0, 10));
    }
    absentOn.set(empId, set);
  }

  const rows: { employee_id: string; shift_date: string; source: string }[] = [];
  for (const date of eachDay(start, end)) {
    const wd = weekdayMon0(date);
    if (wd === 6) continue; // skip Sunday
    for (const emp of empRes.data ?? []) {
      const empId = emp.id as string;
      if (!worksOn.get(empId)?.has(wd)) continue;
      if (absentOn.get(empId)?.has(date)) continue;
      rows.push({ employee_id: empId, shift_date: date, source: "generated" });
    }
  }

  const del = await supabase
    .from("shifts")
    .delete()
    .eq("source", "generated")
    .gte("shift_date", start)
    .lte("shift_date", end);
  if (del.error) throw del.error;

  if (rows.length > 0) {
    const ins = await supabase.from("shifts").insert(rows);
    if (ins.error) throw ins.error;
  }

  return { generated: rows.length, start, end };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return new Response(JSON.stringify({ error: "missing env" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    const supabase = createClient(url, key);
    const body = (await req.json()) as GenerateAction;
    if (body.action !== "generate") {
      return new Response(JSON.stringify({ error: "unknown action" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    const result = await generate(supabase, body.year, body.month);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
```

- [ ] **Step 2: Deploy edge function**

```bash
supabase functions deploy planning-engine --no-verify-jwt
```
Expected: "Deployed Function planning-engine".

- [ ] **Step 3: Smoke test**

```bash
supabase functions invoke planning-engine --body '{"action":"generate","year":2026,"month":5}'
```
Expected: JSON `{ "generated": N, "start": "2026-05-01", "end": "2026-05-31" }` with `N > 0`.

Verify in DB:
```bash
supabase db query "select count(*) from shifts where source='generated' and shift_date between '2026-05-01' and '2026-05-31';"
```
Expected: matches `N`.

- [ ] **Step 4: Manual-preservation test**

```bash
supabase db query "insert into shifts (employee_id, shift_date, source) select id, '2026-05-15', 'manual' from employees where display_code='KR';"
supabase functions invoke planning-engine --body '{"action":"generate","year":2026,"month":5}'
supabase db query "select count(*) from shifts where shift_date='2026-05-15' and source='manual';"
```
Expected: the manual row still present (count >= 1).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/planning-engine/index.ts
git commit -m "refactor(planning-engine): single-action generator with source preservation"
```

---

## Task 4: Shared coverage hook + badge component

**Files:**
- Create: `frontend/src/lib/coverage.ts`
- Create: `frontend/src/components/CoverageBadges.tsx`

- [ ] **Step 1: Write `coverage.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type CoverageIssue = {
  issue_date: string;
  kind: "shortage" | "conflict";
  role: string | null;
  required: number | null;
  assigned: number | null;
  employee_id: string | null;
  severity: string;
};

export function useCoverageIssues(start: string, end: string) {
  return useQuery({
    queryKey: ["coverage_issues", start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_coverage_issues", {
        p_start: start,
        p_end: end,
      });
      if (error) throw error;
      return (data ?? []) as CoverageIssue[];
    },
    enabled: !!start && !!end,
  });
}

export function issuesByDate(issues: CoverageIssue[]): Map<string, CoverageIssue[]> {
  const map = new Map<string, CoverageIssue[]>();
  for (const i of issues) {
    const arr = map.get(i.issue_date) ?? [];
    arr.push(i);
    map.set(i.issue_date, arr);
  }
  return map;
}

export function roleLabel(role: string | null): string {
  switch (role) {
    case "pharmacist": return "farm";
    case "pha": return "pha";
    case "apprentice_pha": return "app";
    case "driver": return "drv";
    case "auxiliary": return "aux";
    default: return role ?? "?";
  }
}
```

- [ ] **Step 2: Write `CoverageBadges.tsx`**

```tsx
import type { CoverageIssue } from "../lib/coverage";
import { roleLabel } from "../lib/coverage";

export function CoverageBadges({ issues }: { issues: CoverageIssue[] }) {
  const shortages = issues.filter((i) => i.kind === "shortage");
  if (shortages.length === 0) return null;
  return (
    <div className="coverage-badges">
      {shortages.map((s, i) => (
        <span key={i} className="coverage-badge coverage-badge-shortage">
          -{(s.required ?? 0) - (s.assigned ?? 0)} {roleLabel(s.role)}
        </span>
      ))}
    </div>
  );
}

export function hasCritical(issues: CoverageIssue[]): boolean {
  return issues.some((i) => i.severity === "critical");
}
```

- [ ] **Step 3: Add CSS**

Append to `frontend/src/styles/app.css`:

```css
.coverage-badges {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}
.coverage-badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  background: #fde2e2;
  color: #8a1a1a;
  border: 1px solid #e8a1a1;
}
.day-has-critical {
  border-left: 3px solid #c43030 !important;
  background: #fff6f6;
}
.shift-cell.is-conflict {
  background: #fde2e2;
  color: #8a1a1a;
}
.shift-cell.is-generated {
  opacity: 0.9;
}
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/coverage.ts frontend/src/components/CoverageBadges.tsx frontend/src/styles/app.css
git commit -m "feat(frontend): coverage issues hook + badges component"
```

---

## Task 5: PianificazionePage — generate button + criticities

**Files:**
- Modify: `frontend/src/pages/PianificazionePage.tsx`

- [ ] **Step 1: Replace file contents**

Full new file:

```tsx
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { CoverageBadges, hasCritical } from "../components/CoverageBadges";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import { useCoverageIssues, issuesByDate } from "../lib/coverage";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;

type ShiftRow = Tables<"shifts"> & { employee?: Pick<Employee, "id" | "first_name" | "last_name" | "display_code" | "role"> };

function monthBounds(year: number, month: number): { start: string; end: string } {
  const s = new Date(Date.UTC(year, month - 1, 1));
  const e = new Date(Date.UTC(year, month, 0));
  return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
}

function daysInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function PianificazionePage() {
  const t = useT("planning");
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const { start, end } = monthBounds(year, month);

  const employeesQuery = useQuery({
    queryKey: ["employees", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("active", true)
        .order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, employee:employees(id, first_name, last_name, display_code, role)")
        .gte("shift_date", start)
        .lte("shift_date", end);
      if (error) throw error;
      return data as ShiftRow[];
    },
  });

  const issuesQuery = useCoverageIssues(start, end);

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("planning-engine", {
        body: { action: "generate", year, month },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", start, end] });
      queryClient.invalidateQueries({ queryKey: ["coverage_issues", start, end] });
    },
  });

  const days = useMemo(() => daysInRange(start, end), [start, end]);
  const issuesMap = useMemo(() => issuesByDate(issuesQuery.data ?? []), [issuesQuery.data]);

  const shiftsByDateEmp = useMemo(() => {
    const m = new Map<string, ShiftRow>();
    for (const s of shiftsQuery.data ?? []) {
      m.set(`${s.shift_date}|${s.employee_id}`, s);
    }
    return m;
  }, [shiftsQuery.data]);

  const conflictsByDateEmp = useMemo(() => {
    const s = new Set<string>();
    for (const i of issuesQuery.data ?? []) {
      if (i.kind === "conflict" && i.employee_id) s.add(`${i.issue_date}|${i.employee_id}`);
    }
    return s;
  }, [issuesQuery.data]);

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
        <div className="toolbar">
          <label>
            {t.year}
            <input
              type="number"
              value={year}
              min={2025}
              max={2030}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label>
            {t.month}
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? t.generating : t.generate}
          </button>
          {generate.error ? <span className="error">{String(generate.error)}</span> : null}
        </div>

        <div className="plan-grid-wrap">
          <table className="table plan-grid">
            <thead>
              <tr>
                <th>{t.employee}</th>
                {days.map((d) => {
                  const dayIssues = issuesMap.get(d) ?? [];
                  const critical = hasCritical(dayIssues);
                  return (
                    <th key={d} className={critical ? "day-has-critical" : ""}>
                      <div>{d.slice(8)}</div>
                      <CoverageBadges issues={dayIssues} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(employeesQuery.data ?? []).map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.first_name} {emp.last_name}</td>
                  {days.map((d) => {
                    const key = `${d}|${emp.id}`;
                    const s = shiftsByDateEmp.get(key);
                    const conflict = conflictsByDateEmp.has(key);
                    if (!s) return <td key={d}></td>;
                    const cls = ["shift-cell"];
                    if (s.source === "generated") cls.push("is-generated");
                    if (conflict) cls.push("is-conflict");
                    return (
                      <td key={d}>
                        <span className={cls.join(" ")}>{emp.display_code}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add translation keys**

Open `frontend/src/i18n/translations.ts`. Inside every language object's `planning` key (create if missing), ensure these keys exist:
```
title: "Pianificazione"
description: "Genera il piano mensile"
year: "Anno"
month: "Mese"
generate: "Genera piano"
generating: "Generazione..."
employee: "Dipendente"
```
Translate per language. If any key already exists with different wording, keep existing.

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PianificazionePage.tsx frontend/src/i18n/translations.ts
git commit -m "feat(piano): month picker, generate button, coverage + conflict highlights"
```

---

## Task 6: SchedulePage — criticity highlights on existing grid

**Files:**
- Modify: `frontend/src/pages/SchedulePage.tsx`

- [ ] **Step 1: Import coverage utilities at top of file**

Add to import block:

```ts
import { useCoverageIssues, issuesByDate } from "../lib/coverage";
import { CoverageBadges, hasCritical } from "../components/CoverageBadges";
```

- [ ] **Step 2: Wire hook inside component**

Locate the existing component body where `days` / month bounds are computed. Directly after those values are available, add:

```ts
const firstDay = days[0];
const lastDay = days[days.length - 1];
const issuesQuery = useCoverageIssues(firstDay ?? "", lastDay ?? "");
const issuesMap = issuesByDate(issuesQuery.data ?? []);
const conflictSet = new Set(
  (issuesQuery.data ?? [])
    .filter((i) => i.kind === "conflict" && i.employee_id)
    .map((i) => `${i.issue_date}|${i.employee_id}`),
);
```

- [ ] **Step 3: Apply red border + badges to day header cells**

Find the row that renders day headers in the schedule (columns = dates). For each `<th>` or `<td>` representing a day, update like:

```tsx
<th
  key={day}
  className={hasCritical(issuesMap.get(day) ?? []) ? "day-has-critical" : ""}
>
  {/* existing content */}
  <CoverageBadges issues={issuesMap.get(day) ?? []} />
</th>
```

If the existing header element is a `<td>` inside `<tbody>` instead of a `<th>` in `<thead>`, apply the same `className` + children there.

- [ ] **Step 4: Highlight conflict cells**

Find the inner map where each shift cell is rendered (`dayShifts.map((s) => ...)`). Change the rendered element from:

```tsx
<div key={s.id} className="shift-cell">{s.employee?.display_code}</div>
```

to:

```tsx
<div
  key={s.id}
  className={
    "shift-cell" +
    (s.source === "generated" ? " is-generated" : "") +
    (conflictSet.has(`${s.shift_date}|${s.employee_id}`) ? " is-conflict" : "")
  }
>
  {s.employee?.display_code}
</div>
```

If the existing shift query doesn't select `source`, update the select list to include `source`:

```ts
.select("id, employee_id, shift_date, source, employee:employees(id, first_name, last_name, display_code, role)")
```

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npm run typecheck
```
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/SchedulePage.tsx
git commit -m "feat(schedule): coverage + conflict highlights"
```

---

## Task 7: End-to-end verification

**Files:**
- Read only.

- [ ] **Step 1: Full typecheck + build**

```bash
cd frontend && npm run typecheck && npm run build
```
Expected: zero errors, build succeeds.

- [ ] **Step 2: Trigger a generate against cloud**

```bash
supabase functions invoke planning-engine --body '{"action":"generate","year":2026,"month":5}'
```
Expected: 200 with `{generated: N, ...}`.

- [ ] **Step 3: Verify RPC returns data**

```bash
supabase db query "select kind, count(*) from get_coverage_issues('2026-05-01','2026-05-31') group by kind;"
```
Expected: 0..M shortage rows, 0 conflict rows (unless manual shift clashes with absence).

- [ ] **Step 4: Dev server smoke test**

Run `cd frontend && npm run dev`. Open http://localhost:5173.

Checklist:
- `/piano`: month picker shows current month, "Genera piano" button; after click, grid populates with ✓/codes; day headers with shortages have red left border and `-N role` badges.
- `/schedule`: same red borders and badges on day columns; manual cells visible; generated cells rendered.
- Insert an absence for an employee covering a day where they have a generated shift (via `/assenze` UI or SQL), then reload `/piano` — that cell appears red (`.is-conflict`).

- [ ] **Step 5: Final commit (if any fixes)**

```bash
git commit -m "fix: verification adjustments"
```
Only if changes were needed.

---

## Out of Scope

- Evening coverage (seed simplified to `all_day`).
- Over-coverage warnings.
- Saturday rotation automation.
- Historical planning_runs tracking.
- Suggestion/repair heuristics.
