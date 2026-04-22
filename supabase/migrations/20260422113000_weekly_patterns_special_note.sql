alter table weekly_patterns
  drop constraint if exists weekly_patterns_special_times_valid;

alter table weekly_patterns
  drop column if exists special_start_time,
  drop column if exists special_end_time;

alter table weekly_patterns
  add column if not exists special_note text;
