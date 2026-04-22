-- Set Bediener=true for all existing employees and make it default for new rows.
update public.employees
set bediener = true
where bediener is distinct from true;

alter table public.employees
alter column bediener set default true;

