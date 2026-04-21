-- coverage_requests: one per (absence, shift_date) pair
create table coverage_requests (
  id uuid primary key default gen_random_uuid(),
  absence_id uuid not null references absences(id) on delete cascade,
  shift_date date not null,
  role employee_role not null,
  status text not null default 'pending'
    check (status in ('pending','proposed','accepted','exhausted','cancelled')),
  timeout_hours smallint not null default 24,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coverage_requests_absence_idx on coverage_requests(absence_id);
create index coverage_requests_status_idx on coverage_requests(status, shift_date);

create trigger coverage_requests_set_updated_at
  before update on coverage_requests
  for each row execute function set_updated_at();

-- coverage_proposals: one row per candidate per request, ordered
create table coverage_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references coverage_requests(id) on delete cascade,
  employee_id uuid not null references employees(id),
  attempt_order smallint not null,
  status text not null default 'pending'
    check (status in ('pending','sent','accepted','rejected','expired')),
  token text not null unique,
  sent_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index coverage_proposals_request_idx on coverage_proposals(request_id, attempt_order);
create index coverage_proposals_token_idx on coverage_proposals(token);

-- RLS: service_role bypasses; authenticated admins can read/write
alter table coverage_requests enable row level security;
alter table coverage_proposals enable row level security;

create policy "admins manage coverage_requests"
  on coverage_requests for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create policy "admins manage coverage_proposals"
  on coverage_proposals for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
