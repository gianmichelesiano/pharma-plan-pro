-- Drop old unique constraint (current name based on Postgres default naming)
alter table weekly_patterns
  drop constraint if exists weekly_patterns_employee_id_weekday_key;

-- Add pattern_type column
alter table weekly_patterns
  add column pattern_type text not null default 'standard'
  check (pattern_type in ('standard', 'accessory'));

-- New unique constraint includes pattern_type
alter table weekly_patterns
  add constraint weekly_patterns_employee_weekday_type_key
  unique (employee_id, weekday, pattern_type);
