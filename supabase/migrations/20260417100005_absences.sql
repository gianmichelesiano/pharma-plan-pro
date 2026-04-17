create table absences (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type absence_type not null,
  status absence_status not null default 'approved',
  note text,
  training_course_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index absences_employee_idx on absences (employee_id);
create index absences_range_idx on absences (start_date, end_date);

create trigger absences_set_updated_at
before update on absences
for each row execute function set_updated_at();
