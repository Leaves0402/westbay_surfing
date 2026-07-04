-- Hard-delete official members from public.profiles (does not touch auth.users).
-- Run this in the Supabase SQL editor after deploy.

create or replace function public.remove_official_members(target_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  removable_ids uuid[];
begin
  if not public.is_current_profile_staff() then
    raise exception 'Only officers and admins can remove official members.';
  end if;

  if target_user_ids is null or coalesce(array_length(target_user_ids, 1), 0) = 0 then
    raise exception 'No members selected.';
  end if;

  if auth.uid() = any(target_user_ids) then
    raise exception 'Cannot remove yourself.';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = any(target_user_ids)
      and role = 'admin'
  ) then
    raise exception 'Cannot remove an admin.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into removable_ids
  from public.profiles
  where id = any(target_user_ids)
    and role in ('member', 'board_manager', 'officer')
    and id is distinct from auth.uid();

  if coalesce(array_length(removable_ids, 1), 0) = 0 then
    raise exception 'No removable official members found.';
  end if;

  -- Clear references that would block profile deletion.
  update public.rental_slots
  set board_manager_id = null
  where board_manager_id = any(removable_ids);

  update public.rental_slots
  set created_by = auth.uid()
  where created_by = any(removable_ids);

  update public.announcements
  set created_by = auth.uid()
  where created_by = any(removable_ids);

  delete from public.rental_registrations
  where user_id = any(removable_ids);

  delete from public.profiles
  where id = any(removable_ids)
    and role in ('member', 'board_manager', 'officer')
    and id is distinct from auth.uid();
end;
$$;

-- Keep the single-member RPC as a thin wrapper for compatibility.
create or replace function public.remove_official_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.remove_official_members(array[target_user_id]);
end;
$$;

grant execute on function public.remove_official_members(uuid[]) to authenticated;
grant execute on function public.remove_official_member(uuid) to authenticated;
