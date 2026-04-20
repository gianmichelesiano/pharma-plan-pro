# Whole-Day Shifts — Design Spec

**Date:** 2026-04-20
**Status:** Draft

## Goal

Eliminate slot/shift-type distinction (FULL_DAY / MORNING / AFTERNOON / SATURDAY_ROTATING) across the entire application. Every shift becomes a single whole-day unit. One record per `(employee, date)`.

## Scope

Changes touch: database schema, seed, Supabase edge function (`planning-engine`), frontend types, four pages (`SchedulePage`, `PianificazionePage`, `TrainingPage`, `AvailabilityPage`), shared `AppShell`, i18n translations, and CSS.

Existing runtime data is dev-only. Tables are wiped; schema is reshaped via new migrations (no data migration logic).

## Decisions

1. **SATURDAY_ROTATING** — removed. Saturday is a normal whole-day.
2. **start_time / end_time** — removed from `shifts`. Pharmacy hours are fixed implicitly.
3. **Existing data** — wiped. Dev environment, no production to preserve.
4. **`shift_type` enum** — dropped entirely. No single-value enum kept.
5. **`slot` columns** — dropped from `weekly_patterns`, `coverage_rules`, `planning_issues`; `shift_type` dropped from `planning_draft_shifts`.
6. **UI** — minimal: one cell per day, toggle on/off. No AM/PM split anywhere.

## Database Changes

New migration: `supabase/migrations/20260420100010_whole_day_shifts.sql`.

Actions (in order):

1. `TRUNCATE TABLE planning_issues, planning_suggestions, planning_draft_shifts, planning_runs, shifts, weekly_patterns, coverage_rules RESTART IDENTITY CASCADE;`
2. `ALTER TABLE shifts DROP COLUMN shift_type, DROP COLUMN start_time, DROP COLUMN end_time;`
3. `ALTER TABLE shifts DROP CONSTRAINT shifts_employee_id_shift_date_shift_type_key;` → add `UNIQUE (employee_id, shift_date)`.
4. `ALTER TABLE weekly_patterns DROP COLUMN slot;` → new unique `(employee_id, weekday)`.
5. `ALTER TABLE coverage_rules DROP COLUMN slot;` → new unique `(weekday, role, time_window)`.
6. `ALTER TABLE planning_draft_shifts DROP COLUMN shift_type;` → new unique `(run_id, employee_id, shift_date)`.
7. `ALTER TABLE planning_issues DROP COLUMN slot;`
8. `DROP TYPE shift_type;`

Also edit `20260417100001_enums.sql` to remove `shift_type` enum definition, so fresh `supabase db reset` works.

Edit existing migration files (`_shifts.sql`, `_weekly_patterns.sql`, `_coverage_rules.sql`, `_planning_engine.sql`) to match final shape — keeps migration history clean for dev.

## Seed

Rewrite `supabase/seed.sql`:

- `weekly_patterns`: one row per `(employee, weekday)` where employee works that day. No slot column.
- `coverage_rules`: one row per `(weekday, role, time_window)` with `min_required`.

Saturday rotations encoded directly: alternate Saturdays modeled as data (separate rows per concrete Saturday in `shifts`) rather than pattern-level.

## Planning Engine

File: `supabase/functions/planning-engine/index.ts`.

- Remove slot iteration. Loop: for each date × employee, decide whole-day on/off.
- Coverage check: count shifts per `(date, role)` vs `min_required` from `coverage_rules` for that weekday+role.
- Draft shifts: insert one row per `(run_id, employee, date)`.
- Issues: emit with `(date, role)` — no slot field.

## Frontend Changes

### `frontend/src/lib/database.types.ts`
Regenerate via `supabase gen types`.

### `SchedulePage.tsx`
- Grid: one cell per `(employee, date)` instead of two (MORNING/AFTERNOON).
- Remove conditional rendering by `shift_type`.
- Weekday/weekend layout identical — no FULL_DAY spanning logic.

### `PianificazionePage.tsx`
- Toggle mutation: flip one shift on/off per `(employee, date)`.
- Remove slot parameter from `toggleMutation` payload.
- Coverage badges per day only.

### `TrainingPage.tsx`
- Remove slot dropdown on training slot form. Training is whole-day.

### `AvailabilityPage.tsx`
- Remove slot selection. Availability toggle = whole-day per `(employee, weekday)`.

### `AppShell.tsx` + `i18n/translations.ts`
- Drop labels: `shiftType.MORNING`, `shiftType.AFTERNOON`, `shiftType.FULL_DAY`, `slot.SATURDAY_ROTATING`, etc.

### `styles/app.css`
- Remove classes: `.slot-morning`, `.slot-afternoon`, `.shift-full-day`, etc. Consolidate into single `.shift-cell`.

## Testing

- `supabase db reset` succeeds cleanly.
- Seed loads without errors.
- Planning engine generates draft for a month without slot-related crashes.
- Each frontend page renders with single whole-day cells.
- Toggle/generate/clear mutations work end-to-end.

## Out of Scope

- Custom shift hours (removed entirely; no override path).
- Saturday rotation automation (data-driven only).
- Historical data migration (none exists).
