-- Add Bediener flag for employee roster management.
alter table public.employees
add column if not exists bediener boolean not null default false;

