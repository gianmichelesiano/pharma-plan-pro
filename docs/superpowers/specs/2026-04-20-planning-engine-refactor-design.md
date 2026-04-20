# Planning Engine Refactor — Design Spec

**Date:** 2026-04-20
**Status:** Draft

## Goal

Rewrite the monthly planning flow so that a single action allocates whole-day shifts to available employees while respecting patterns, absences, and coverage rules, and surfaces criticities (coverage shortages, absence conflicts) in `/piano` and `/schedule`.

## Decisions

1. **Allocation strategy — permissive baseline.** Every employee whose `weekly_patterns` row for that weekday is `active=true` and who has no `absences` row covering that date receives one whole-day shift. Coverage rules are a *check*, not a constraint driving allocation.
2. **Training.** Counted only when a dedicated `absences` row with `type='TRAINING'` exists. `training_participants` is bookkeeping and does not affect shift generation.
3. **Criticities.**
   - Type 1: role coverage shortage — `assigned < coverage_rules.min_required` for a `(date, role, time_window='all_day')`.
   - Type 2: conflict — shift exists for an employee on a date when `absences` overlaps.
4. **Visualization.** Red border around the day cell; badge with shortage count per role (e.g. `-1 farm`, `-2 pha`). Conflicts render as red rows / red highlighted employees inside the cell.
5. **Storage.** `shifts` gains `source text not null default 'manual' check (source in ('generated','manual'))`. No draft table. `/piano` and `/schedule` read the same `shifts`.
6. **Regenerate.** Manual button on `/piano`. Month range selector. Deletes shifts with `source='generated'` in `[YYYY-MM-01, last day of month]` and inserts fresh ones. `source='manual'` shifts are preserved across regenerations.
7. **Criticities storage.** Computed by a Postgres function `get_coverage_issues(p_start date, p_end date)`. No persistence.

## Database Changes

New migration `supabase/migrations/20260420100010_planning_refactor.sql`:

```sql
-- 1. Drop obsolete planning tables
drop table if exists planning_legacy_code_map cascade;
drop table if exists planning_suggestions cascade;
drop table if exists planning_issues cascade;
drop table if exists planning_draft_shifts cascade;
drop table if exists planning_runs cascade;

-- 2. Add source column to shifts
alter table shifts
  add column source text not null default 'manual'
  check (source in ('generated', 'manual'));

-- 3. Coverage issues function
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
      coalesce(count(s.id), 0)::smallint as assigned,
      null::uuid as employee_id,
      'critical'::text as severity
    from days d
    join coverage_rules r on r.weekday = extract(isodow from d.d)::int - 1
      and r.time_window = 'all_day'
    left join shifts s on s.shift_date = d.d
      and exists (
        select 1 from employees e
        where e.id = s.employee_id and e.role = r.role
      )
    group by d.d, r.role, r.min_required
    having coalesce(count(s.id), 0) < r.min_required
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

## Planning Engine

Rewrite `supabase/functions/planning-engine/index.ts` to roughly 150 lines.

Exposes a single HTTP POST endpoint accepting:
```json
{ "action": "generate", "year": 2026, "month": 5 }
```

Logic:

1. Compute `start = YYYY-MM-01`, `end = last day of month`.
2. Fetch in parallel:
   - `employees` where `active=true`
   - `weekly_patterns` where `active=true`
   - `absences` overlapping range and `status='approved'`
3. Build a map `absentOn: Map<employeeId, Set<dateISO>>`.
4. Build a map `worksOn: Map<employeeId, Set<weekday>>` from patterns.
5. Iterate each day in range:
   - Skip Sundays (weekday 6).
   - For each employee, if `worksOn[emp].has(weekday) && !absentOn[emp].has(date)`, push `{employee_id, shift_date: date, source: 'generated'}`.
6. Transaction:
   - `delete from shifts where source='generated' and shift_date between start and end`
   - `insert into shifts` with the generated rows (batch)
7. Return `{ generated: N, start, end }`.

No `planning_runs`, no suggestions, no repair loop, no legacy codes.

## Frontend

### `/piano` (PianificazionePage)

- Top toolbar:
  - Month picker (year + month select, default current month)
  - Button "Genera piano" → invokes edge function with `{action:'generate', year, month}`
  - Shows loader + success/error toast
- Load in parallel after month selection:
  - `shifts` where `shift_date between start and end`, joined with employee
  - Issues via `supabase.rpc('get_coverage_issues', { p_start, p_end })`
- Grid: rows = employees (ordered by `first_name`), columns = days. Cell shows ✓ when a shift exists, differentiated visually if `source='generated'` vs `source='manual'`.
- Day-column header gets red border if any shortage issue exists for that day. Below the header, show badges: `-N farm`, `-N pha`, one per role shortage.
- Cells containing a conflict (employee absent that day) render with red background.
- Bottom panel: collapsible list "Criticità" grouped by date, each row describes the issue in plain text.

### `/schedule` (SchedulePage)

- No generate button.
- Same `shifts` data. Same issues query.
- Visual criticity treatment identical (red border on day, badges).
- Existing manual edit UX (drag/click to add) unchanged; new shifts created via UI get `source='manual'` by default from the DB column default.

### Shared UI pieces

Extract a small `CoverageBadges` component and a `useCoverageIssues(start, end)` TanStack Query hook into `frontend/src/lib/coverage.ts` / `frontend/src/components/CoverageBadges.tsx`. Both pages import it.

## Seed adjustments

None required. Existing seed already has `coverage_rules` per weekday. `weekly_patterns` derived from Arbeitsplan already committed.

## Testing

- DB reset and re-seed succeed.
- Call planning engine for a month — verify row count equals expected (sum of pattern rows × their weekday occurrences in the month, minus absence overlaps).
- Insert an absence spanning the month for one employee, regenerate — that employee's shifts in overlap range gone.
- Insert a `source='manual'` shift, regenerate — manual shift survives.
- Insert a manual shift where the employee is absent, call RPC — conflict row returned.
- Delete all `pha` patterns for Monday, regenerate, call RPC — shortage row returned for each Monday in month.
- `/piano` renders red border + badges; `/schedule` matches.

## Out of Scope

- Evening coverage rules (seed was simplified to `all_day` only).
- Over-coverage warnings.
- Saturday rotation automation.
- Suggestion/repair algorithms.
- Historical `planning_runs` tracking (dropped).
