-- Base working pattern per employee, per weekday, per slot.
-- weekday: 0 = Mon, 1 = Tue, ..., 6 = Sun (ISO: Mon-first).
-- slot: 'MORNING' | 'AFTERNOON' | 'FULL_DAY' | 'SATURDAY_ROTATING'.
create table weekly_patterns (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  slot text not null check (slot in ('MORNING', 'AFTERNOON', 'FULL_DAY', 'SATURDAY_ROTATING')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (employee_id, weekday, slot)
);

create index weekly_patterns_employee_idx on weekly_patterns (employee_id);
create index weekly_patterns_weekday_idx on weekly_patterns (weekday);
