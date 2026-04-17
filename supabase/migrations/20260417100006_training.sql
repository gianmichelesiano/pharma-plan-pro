create table training_courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  location text,
  start_date date not null,
  end_date date,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now()
);

create table training_participants (
  id uuid primary key default gen_random_uuid(),
  training_course_id uuid not null references training_courses(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  confirmed boolean not null default true,
  unique (training_course_id, employee_id)
);

-- Add deferred FK from absences.training_course_id
alter table absences
  add constraint absences_training_course_fk
  foreign key (training_course_id) references training_courses(id) on delete set null;

create index training_courses_date_idx on training_courses (start_date);
create index training_participants_employee_idx on training_participants (employee_id);
