-- Allow officer/admin to operate all lesson attendance, one-click instructor check-in,
-- and delete entire lessons. Run after add_lessons.sql.

create or replace function public.set_lesson_instructor_attendance(
  target_lesson_id uuid,
  target_instructor_id uuid,
  target_checked_in boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以簽到。';
  end if;

  if not exists (
    select 1 from public.lesson_instructors
    where lesson_id = target_lesson_id
      and instructor_id = target_instructor_id
  ) then
    raise exception '此人不在本堂教學名單。';
  end if;

  insert into public.lesson_instructor_attendance (
    lesson_id, instructor_id, checked_in, checked_in_by, checked_in_at
  )
  values (
    target_lesson_id,
    target_instructor_id,
    target_checked_in,
    case when target_checked_in then auth.uid() else null end,
    case when target_checked_in then now() else null end
  )
  on conflict (lesson_id, instructor_id) do update
  set
    checked_in = excluded.checked_in,
    checked_in_by = excluded.checked_in_by,
    checked_in_at = excluded.checked_in_at;
end;
$$;

create or replace function public.set_lesson_member_attendance(
  target_lesson_id uuid,
  target_user_id uuid,
  target_checked_in boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以簽到。';
  end if;

  if not exists (
    select 1 from public.lesson_participants
    where lesson_id = target_lesson_id
      and user_id = target_user_id
  ) then
    raise exception '此人不在本堂參加名單。';
  end if;

  insert into public.lesson_member_attendance (
    lesson_id, user_id, checked_in, checked_in_by, checked_in_at
  )
  values (
    target_lesson_id,
    target_user_id,
    target_checked_in,
    case when target_checked_in then auth.uid() else null end,
    case when target_checked_in then now() else null end
  )
  on conflict (lesson_id, user_id) do update
  set
    checked_in = excluded.checked_in,
    checked_in_by = excluded.checked_in_by,
    checked_in_at = excluded.checked_in_at;
end;
$$;

create or replace function public.check_in_all_lesson_instructors(
  target_lesson_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以一鍵簽到。';
  end if;

  if not exists (
    select 1 from public.lessons where id = target_lesson_id
  ) then
    raise exception '找不到社課。';
  end if;

  insert into public.lesson_instructor_attendance (
    lesson_id,
    instructor_id,
    checked_in,
    checked_in_by,
    checked_in_at
  )
  select
    target_lesson_id,
    instructor.instructor_id,
    true,
    auth.uid(),
    now()
  from public.lesson_instructors instructor
  where instructor.lesson_id = target_lesson_id
  on conflict (lesson_id, instructor_id) do update
  set
    checked_in = true,
    checked_in_by = auth.uid(),
    checked_in_at = now();
end;
$$;

create or replace function public.delete_lesson(target_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以取消社課。';
  end if;

  delete from public.lessons
  where id = target_lesson_id;

  if not found then
    raise exception '找不到社課。';
  end if;
end;
$$;

grant execute on function public.set_lesson_instructor_attendance(uuid, uuid, boolean) to authenticated;
grant execute on function public.set_lesson_member_attendance(uuid, uuid, boolean) to authenticated;
grant execute on function public.check_in_all_lesson_instructors(uuid) to authenticated;
grant execute on function public.delete_lesson(uuid) to authenticated;
