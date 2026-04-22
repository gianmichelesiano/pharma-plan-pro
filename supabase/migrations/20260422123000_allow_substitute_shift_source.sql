alter table shifts
  drop constraint if exists shifts_source_check;

alter table shifts
  add constraint shifts_source_check
  check (source in ('generated', 'manual', 'substitute'));
