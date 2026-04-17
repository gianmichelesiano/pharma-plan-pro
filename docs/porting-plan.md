# Pharma Plan Pro — Porting Plan (FastAPI+SQLite → Supabase)

**Date:** 2026-04-17  
**Source:** `/Users/gianmichele/Development/Personal/pharma-plan`  
**Reference:** `/Users/gianmichele/Development/Personal/fph-prep` (auth patterns)

---

## Goal

Migrate pharma-plan from FastAPI + SQLite to Supabase direct client calls.  
Eliminate FastAPI backend and local SQLite database entirely.

## Constraints

- Auth: email/password only (Supabase Auth, same as fph-prep)
- Single pharmacy (no multi-tenant)
- All Supabase tables prefixed with `plan_`
- Frontend: React + TypeScript (keep existing, replace API layer)

---

## Approach: Strangler Fig (step by step)

Each phase is independently testable. Frontend stays functional throughout.

---

## Phase 1 — Supabase Foundation + Auth

### 1.1 Supabase Schema

Create these tables (all prefixed `plan_`):

```sql
-- User profiles (linked to auth.users)
create table plan_profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        text,
  full_name    text,
  is_admin     boolean default false,
  created_at   timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_plan_user()
returns trigger as $$
begin
  insert into public.plan_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_plan_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_plan_user();

-- Employees
create table employees (
  id           serial primary key,
  first_name   text not null,
  last_name    text not null,
  role         text check (role in ('pharmacist', 'operator')),
  weekly_hours integer,
  active       boolean default true,
  created_at   timestamptz default now()
);

-- Shift templates (opening hours)
create table plan_shift_templates (
  id         serial primary key,
  weekday    integer not null,  -- 0=Mon, 6=Sun
  slot_name  text not null,     -- AM, PM, FULL
  start_time text not null,     -- HH:MM
  end_time   text not null,
  is_open    boolean default true
);

-- Employee availability
create table plan_availabilities (
  id           serial primary key,
  employee_id  integer references employees(id) on delete cascade,
  weekday      integer not null,
  slot_name    text not null,
  is_available boolean default true
);

-- Time off requests
create table plan_time_off (
  id          serial primary key,
  employee_id integer references employees(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text default 'vacation',
  status      text default 'approved'
);

-- Coverage rules
create table coverage_rules (
  id               serial primary key,
  weekday          integer not null,
  slot_name        text not null,
  role             text not null,
  minimum_required integer not null
);

-- Schedules
create table plan_schedules (
  id           serial primary key,
  period_type  text not null,  -- week, month
  start_date   date not null,
  end_date     date not null,
  status       text default 'draft',
  generated_at timestamptz default now()
);

-- Shift assignments
create table plan_shift_assignments (
  id          serial primary key,
  schedule_id integer references plan_schedules(id) on delete cascade,
  date        date not null,
  slot_name   text not null,
  employee_id integer references employees(id),
  role        text not null,
  source      text default 'generated'  -- generated, manual
);
```

### 1.2 RLS Policies

```sql
-- Enable RLS on all tables
alter table plan_profiles enable row level security;
alter table employees enable row level security;
alter table plan_shift_templates enable row level security;
alter table plan_availabilities enable row level security;
alter table plan_time_off enable row level security;
alter table coverage_rules enable row level security;
alter table plan_schedules enable row level security;
alter table plan_shift_assignments enable row level security;

-- Authenticated users can read/write all plan_ tables (single pharmacy)
create policy "authenticated full access" on employees
  for all using (auth.role() = 'authenticated');

-- (repeat for all plan_ tables)
```

### 1.3 Frontend Auth (copy from fph-prep)

Files to create in pharma-plan-pro frontend:

- `src/lib/supabase.ts` — Supabase client init
- `src/contexts/AuthContext.tsx` — auth state (signIn, signOut, user, profile)
- `src/components/ProtectedRoute.tsx` — redirect to /login if not authed
- `src/pages/LoginPage.tsx` — email/password form

Pattern (from fph-prep `AuthContext.jsx`):
```typescript
const { data: { session } } = await supabase.auth.getSession()
supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null) })
```

---

## Phase 2 — Replace Employees API

Replace `GET/POST/PUT/DELETE /employees` with Supabase client calls.

```typescript
// src/lib/api.ts
import { supabase } from './supabase'

export const getEmployees = () =>
  supabase.from('employees').select('*').eq('active', true)

export const createEmployee = (data: EmployeeCreate) =>
  supabase.from('employees').insert(data).select().single()

export const updateEmployee = (id: number, data: EmployeeUpdate) =>
  supabase.from('employees').update(data).eq('id', id).select().single()

export const deleteEmployee = (id: number) =>
  supabase.from('employees').update({ active: false }).eq('id', id)
```

---

## Phase 3 — Replace Availability API

```typescript
export const getAvailability = (employeeId: number) =>
  supabase.from('plan_availabilities').select('*').eq('employee_id', employeeId)

export const setAvailability = (employeeId: number, slots: AvailabilitySlot[]) =>
  supabase.from('plan_availabilities').upsert(
    slots.map(s => ({ ...s, employee_id: employeeId })),
    { onConflict: 'employee_id,weekday,slot_name' }
  )
```

---

## Phase 4 — Replace Time Off API

```typescript
export const getTimeOff = () =>
  supabase.from('plan_time_off').select('*, employees(first_name, last_name)')

export const createTimeOff = (data: TimeOffCreate) =>
  supabase.from('plan_time_off').insert(data).select().single()

export const deleteTimeOff = (id: number) =>
  supabase.from('plan_time_off').delete().eq('id', id)
```

---

## Phase 5 — Replace Rules API

```typescript
export const getShiftTemplates = () =>
  supabase.from('plan_shift_templates').select('*').order('weekday')

export const getCoverageRules = () =>
  supabase.from('coverage_rules').select('*').order('weekday')

export const updateCoverageRules = (rules: CoverageRule[]) =>
  supabase.from('coverage_rules').upsert(rules, { onConflict: 'weekday,slot_name,role' })
```

---

## Phase 6 — Scheduling Algorithm

The core scheduler (`backend/app/services/scheduler.py`) is pure business logic — no DB or HTTP.

**Option A:** Port to TypeScript, run in browser (simplest, no server needed).  
**Option B:** Supabase Edge Function (if too slow in browser).

Recommend **Option A** first. Port to `src/services/scheduler.ts`.

```typescript
export function generateSchedule(
  employees: Employee[],
  shiftTemplates: ShiftTemplate[],
  coverageRules: CoverageRule[],
  availabilities: Availability[],
  timeOff: TimeOff[],
  params: { periodType: 'week' | 'month'; startDate: string }
): { assignments: Assignment[]; uncoveredSlots: UncoveredSlot[] }
```

---

## Phase 7 — Remove FastAPI + SQLite

Once all phases done and tested:

1. Delete `pharma-plan/backend/` directory
2. Delete `pharma-plan/pharma_plan.db`
3. Remove backend references from `start.sh`
4. Update `README.md`

---

## Source → Target Mapping

| FastAPI Route | Supabase Table | Notes |
|---|---|---|
| `GET /employees` | `employees` | |
| `GET/PUT /employees/:id/availability` | `plan_availabilities` | upsert on conflict |
| `GET/POST/DELETE /time-off` | `plan_time_off` | |
| `GET /rules/opening-hours` | `plan_shift_templates` | read-only for now |
| `GET/PUT /rules/coverage` | `coverage_rules` | |
| `POST /schedules/generate` | `plan_schedules` + `plan_shift_assignments` | algorithm runs client-side |
| `GET/POST/PUT/DELETE /schedules/:id/assignments` | `plan_shift_assignments` | |

---

## Reference Files (fph-prep)

| File | Use |
|---|---|
| `src/contexts/AuthContext.jsx` | Copy auth pattern |
| `src/components/ProtectedRoute.jsx` | Copy route guard |
| `src/lib/supabase.js` | Copy client init |
| `supabase/migrations/001_initial_schema.sql` | Reference trigger pattern |

---

## Environment Variables Needed

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
