-- Enable RLS on all public tables missing it.
-- Policy: any authenticated user can do full CRUD (internal app, no per-row tenant isolation).

alter table employees enable row level security;
alter table shifts enable row level security;
alter table absences enable row level security;
alter table weekly_patterns enable row level security;
alter table training_courses enable row level security;
alter table training_participants enable row level security;
alter table daily_notes enable row level security;
alter table daily_note_participants enable row level security;
alter table coverage_rules enable row level security;

create policy employees_authenticated on employees for all to authenticated using (true) with check (true);
create policy shifts_authenticated on shifts for all to authenticated using (true) with check (true);
create policy absences_authenticated on absences for all to authenticated using (true) with check (true);
create policy weekly_patterns_authenticated on weekly_patterns for all to authenticated using (true) with check (true);
create policy training_courses_authenticated on training_courses for all to authenticated using (true) with check (true);
create policy training_participants_authenticated on training_participants for all to authenticated using (true) with check (true);
create policy daily_notes_authenticated on daily_notes for all to authenticated using (true) with check (true);
create policy daily_note_participants_authenticated on daily_note_participants for all to authenticated using (true) with check (true);
create policy coverage_rules_authenticated on coverage_rules for all to authenticated using (true) with check (true);
