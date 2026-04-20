-- App-level user profiles, keyed by auth.users.id.
-- Decoupled from employees roster: admins may not be employees.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  admin boolean not null default false,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on profiles (email);

-- Auto-create profile on signup (pending approval).
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;

drop policy if exists profiles_select_self_or_admin on profiles;
create policy profiles_select_self_or_admin on profiles for select
  using (id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.admin));

drop policy if exists profiles_update_admin on profiles;
create policy profiles_update_admin on profiles for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.admin));
