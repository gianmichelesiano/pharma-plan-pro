create table coverage_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  role employee_role not null,
  min_required smallint not null check (min_required >= 0),
  time_window text not null default 'all_day',
  note text,
  unique (weekday, role, time_window)
);
