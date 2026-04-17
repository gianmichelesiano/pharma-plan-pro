create table plan_daily_notes (
  id uuid primary key default gen_random_uuid(),
  note_date date not null,
  title text,
  text text not null,
  meeting_type text,
  start_time time,
  end_time time,
  created_at timestamptz not null default now()
);

create table plan_daily_note_participants (
  id uuid primary key default gen_random_uuid(),
  daily_note_id uuid not null references plan_daily_notes(id) on delete cascade,
  employee_id uuid not null references plan_employees(id) on delete cascade,
  unique (daily_note_id, employee_id)
);

create index plan_daily_notes_date_idx on plan_daily_notes (note_date);
