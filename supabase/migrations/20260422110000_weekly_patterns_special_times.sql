alter table weekly_patterns
  add column if not exists special_start_time time,
  add column if not exists special_end_time time;

alter table weekly_patterns
  drop constraint if exists weekly_patterns_special_times_valid;

alter table weekly_patterns
  add constraint weekly_patterns_special_times_valid
  check (
    (special_start_time is null and special_end_time is null)
    or (
      special_start_time is not null
      and special_end_time is not null
      and special_start_time < special_end_time
    )
  );
