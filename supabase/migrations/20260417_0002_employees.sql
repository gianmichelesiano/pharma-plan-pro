-- Employee anagrafica. `display_code` is the 2-letter code from Excel (KR, UE, ...).
create table plan_employees (
  id uuid primary key default gen_random_uuid(),
  display_code text not null unique,
  first_name text not null,
  last_name text not null,
  email text,
  role employee_role not null,
  employment_status employment_status not null default 'active',
  hired_at date,
  left_at date,
  weekly_hours_pct numeric(5, 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plan_employees_active_idx on plan_employees (active);
create index plan_employees_role_idx on plan_employees (role);

-- auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger employees_set_updated_at
before update on plan_employees
for each row execute function set_updated_at();
