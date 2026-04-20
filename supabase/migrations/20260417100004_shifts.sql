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
