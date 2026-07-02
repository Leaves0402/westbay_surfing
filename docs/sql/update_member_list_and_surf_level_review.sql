alter table public.profiles
alter column surf_level set default '初階';

update public.profiles
set surf_level = '初階'
where surf_level is null;

alter table public.profiles
add column if not exists requested_surf_level text null,
add column if not exists requested_surf_level_at timestamptz null;

alter table public.profiles
drop constraint if exists profiles_surf_level_allowed;

alter table public.profiles
add constraint profiles_surf_level_allowed
check (
  surf_level is null
  or surf_level in ('初階', '中階', '中進階', '進階')
);

alter table public.profiles
drop constraint if exists profiles_requested_surf_level_allowed;

alter table public.profiles
add constraint profiles_requested_surf_level_allowed
check (
  requested_surf_level is null
  or requested_surf_level in ('中進階', '進階')
);

drop view if exists public.public_member_profiles;

create view public.public_member_profiles as
select
  id,
  full_name,
  student_id,
  surf_level,
  role
from public.profiles
where role in ('member', 'board_manager', 'officer', 'admin');

grant select on public.public_member_profiles to authenticated;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_current_profile_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role(), 'pending') in ('officer', 'admin')
$$;

create or replace function public.request_surf_level(target_level text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if target_level not in ('初階', '中階', '中進階', '進階') then
    raise exception 'Invalid surf level.';
  end if;

  if target_level in ('初階', '中階') then
    update public.profiles
    set
      surf_level = target_level,
      requested_surf_level = null,
      requested_surf_level_at = null,
      updated_at = now()
    where id = auth.uid();
  else
    update public.profiles
    set
      requested_surf_level = target_level,
      requested_surf_level_at = now(),
      updated_at = now()
    where id = auth.uid();
  end if;
end;
$$;

create or replace function public.approve_surf_level_request(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_level text;
begin
  if not public.is_current_profile_staff() then
    raise exception 'Only officers and admins can approve surf level requests.';
  end if;

  select requested_surf_level
  into target_level
  from public.profiles
  where id = target_user_id;

  if target_level is null then
    raise exception 'No pending surf level request.';
  end if;

  update public.profiles
  set
    surf_level = target_level,
    requested_surf_level = null,
    requested_surf_level_at = null,
    updated_at = now()
  where id = target_user_id;
end;
$$;

create or replace function public.reject_surf_level_request(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_profile_staff() then
    raise exception 'Only officers and admins can reject surf level requests.';
  end if;

  update public.profiles
  set
    requested_surf_level = null,
    requested_surf_level_at = null,
    updated_at = now()
  where id = target_user_id;
end;
$$;

create or replace function public.approve_pending_members(target_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_profile_staff() then
    raise exception 'Only officers and admins can approve pending members.';
  end if;

  update public.profiles
  set
    role = 'member',
    surf_level = coalesce(surf_level, '初階'),
    updated_at = now()
  where id = any(target_user_ids)
    and role = 'pending';
end;
$$;

create or replace function public.prevent_non_staff_high_surf_level_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.surf_level is distinct from new.surf_level
    and new.surf_level in ('中進階', '進階')
    and not public.is_current_profile_staff()
  then
    raise exception 'Intermediate-advanced and advanced surf levels require officer/admin approval.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_non_staff_high_surf_level_updates
on public.profiles;

create trigger prevent_non_staff_high_surf_level_updates
before update on public.profiles
for each row
execute function public.prevent_non_staff_high_surf_level_updates();

grant execute on function public.request_surf_level(text) to authenticated;
grant execute on function public.approve_surf_level_request(uuid) to authenticated;
grant execute on function public.reject_surf_level_request(uuid) to authenticated;
grant execute on function public.approve_pending_members(uuid[]) to authenticated;
