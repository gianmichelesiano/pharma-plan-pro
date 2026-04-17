create table plan_training_courses (
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

create table plan_training_participants (
  id uuid primary key default gen_random_uuid(),
  training_course_id uuid not null references plan_training_courses(id) on delete cascade,
  employee_id uuid not null references plan_employees(id) on delete cascade,
  confirmed boolean not null default true,
  unique (training_course_id, employee_id)
);

-- Add deferred FK from plan_absences.training_course_id
alter table plan_absences
  add constraint absences_training_course_fk
  foreign key (training_course_id) references plan_training_courses(id) on delete set null;

create index plan_training_courses_date_idx on plan_training_courses (start_date);
create index plan_training_participants_employee_idx on plan_training_participants (employee_id);
