-- Concrete planned shift for one employee on one date.
create table plan_shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references plan_employees(id) on delete cascade,
  shift_date date not null,
  shift_type shift_type not null,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, shift_date, shift_type)
);

create index plan_shifts_date_idx on plan_shifts (shift_date);
create index plan_shifts_employee_idx on plan_shifts (employee_id);

create trigger shifts_set_updated_at
before update on plan_shifts
for each row execute function set_updated_at();
