create or replace function public.remove_official_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if not public.is_current_profile_staff() then
    raise exception 'Only officers and admins can remove official members.';
  end if;

  if auth.uid() = target_user_id then
    raise exception 'Cannot remove yourself.';
  end if;

  select role::text
  into target_role
  from public.profiles
  where id = target_user_id;

  if target_role is null then
    raise exception 'Member not found.';
  end if;

  if target_role = 'admin' then
    raise exception 'Cannot remove an admin.';
  end if;

  if target_role not in ('member', 'board_manager', 'officer') then
    raise exception 'User is not an official member.';
  end if;

  update public.profiles
  set
    role = 'pending',
    updated_at = now()
  where id = target_user_id;
end;
$$;

grant execute on function public.remove_official_member(uuid) to authenticated;
