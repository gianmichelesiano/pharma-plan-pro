-- Fix infinite recursion: use SECURITY DEFINER helper to check admin flag.
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select coalesce((select admin from profiles where id = auth.uid()), false);
$$;

drop policy if exists profiles_select_self_or_admin on profiles;
create policy profiles_select_self on profiles for select
  using (id = auth.uid());

drop policy if exists profiles_select_admin on profiles;
create policy profiles_select_admin on profiles for select
  using (is_admin());

drop policy if exists profiles_update_admin on profiles;
create policy profiles_update_admin on profiles for update
  using (is_admin());
