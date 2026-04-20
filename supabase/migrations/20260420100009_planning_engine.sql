create table planning_runs (
  id uuid primary key default gen_random_uuid(),
  year smallint not null check (year between 2000 and 2100),
  month smallint not null check (month between 1 and 12),
  status text not null default 'draft' check (status in ('draft', 'committed', 'failed')),
  fairness_score numeric(6, 3),
  coverage_score numeric(6, 3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planning_runs_period_idx on planning_runs (year, month, created_at desc);

create trigger planning_runs_set_updated_at
before update on planning_runs
for each row execute function set_updated_at();

create table planning_draft_shifts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references planning_runs(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  shift_date date not null,
  source text not null default 'baseline' check (source in ('baseline', 'repair', 'manual', 'suggestion')),
  legacy_code text,
  created_at timestamptz not null default now(),
  unique (run_id, employee_id, shift_date)
);

create index planning_draft_shifts_run_idx on planning_draft_shifts (run_id, shift_date);
create index planning_draft_shifts_emp_idx on planning_draft_shifts (employee_id, shift_date);

create table planning_issues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references planning_runs(id) on delete cascade,
  issue_date date not null,
  role employee_role,
  severity text not null default 'warning' check (severity in ('warning', 'critical')),
  code text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index planning_issues_run_idx on planning_issues (run_id, issue_date);

create table planning_suggestions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references planning_runs(id) on delete cascade,
  issue_id uuid references planning_issues(id) on delete set null,
  suggestion_type text not null check (suggestion_type in ('ADD_SHIFT', 'MOVE_SHIFT', 'SWAP_SHIFT', 'REMOVE_SHIFT')),
  title text not null,
  description text,
  action_payload jsonb not null default '{}'::jsonb,
  score numeric(8, 3) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index planning_suggestions_run_idx on planning_suggestions (run_id, status, score desc);
create index planning_suggestions_issue_idx on planning_suggestions (issue_id);

create table planning_legacy_code_map (
  id uuid primary key default gen_random_uuid(),
  legacy_code text not null unique,
  normalized_kind text not null,
  display_label text not null,
  active boolean not null default true
);

insert into planning_legacy_code_map (legacy_code, normalized_kind, display_label) values
  ('1', 'SHIFT', 'FULL'),
  ('1mo', 'SHIFT', 'AM'),
  ('1nm', 'SHIFT', 'PM'),
  ('.', 'OFF', 'OFF'),
  ('krank', 'ABSENCE', 'SICK'),
  ('Kurs', 'ABSENCE', 'TRAINING'),
  ('ÜK', 'ABSENCE', 'SCHOOL'),
  ('TP', 'ABSENCE', 'TRAINING'),
  ('k', 'ABSENCE', 'SICK');
