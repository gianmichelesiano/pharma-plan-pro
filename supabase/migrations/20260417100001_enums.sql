-- Postgres enums shared across domain tables.
create type employee_role as enum (
  'pharmacist',          -- Apotheker/in
  'pha',                 -- Pharma-Assistent/in
  'apprentice_pha',      -- Apprendista PhA
  'driver',              -- Autista consegne (SB)
  'auxiliary'            -- Ausiliaria sabato (LO, LM)
);

create type employment_status as enum (
  'active',
  'planned',             -- futura assunzione (es. JF a Maggio)
  'terminated'
);

create type shift_type as enum (
  'FULL_DAY',
  'MORNING',
  'AFTERNOON'
);

create type absence_type as enum (
  'VACATION',
  'UNAVAILABLE',
  'SICK',
  'SCHOOL',
  'TRAINING',
  'HR_MEETING'
);

create type absence_status as enum (
  'requested',
  'approved',
  'rejected'
);
