-- Add a configurable registration deadline to lessons.
-- Existing lessons keep the previous registration behavior: lesson start minus 5 hours.

alter table public.lessons
  add column if not exists registration_deadline timestamptz;

update public.lessons
set registration_deadline =
  ((lesson_date + start_time) at time zone 'Asia/Taipei') - interval '5 hours'
where registration_deadline is null;

alter table public.lessons
  alter column registration_deadline set not null;

alter table public.lessons
  drop constraint if exists lessons_registration_deadline_before_start;

alter table public.lessons
  add constraint lessons_registration_deadline_before_start
  check (
    registration_deadline
      < ((lesson_date + start_time) at time zone 'Asia/Taipei')
  );

comment on column public.lessons.registration_deadline is
  'Registration closes at this instant. Cancellation closes three hours earlier.';

create or replace function public.lesson_registration_closed(
  target_registration_deadline timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select now() >= target_registration_deadline;
$$;

create or replace function public.lesson_cancellation_locked(
  target_registration_deadline timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select now() >= target_registration_deadline - interval '3 hours';
$$;

create or replace function public.join_lesson(target_lesson_id uuid)
returns public.lesson_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson_row public.lessons%rowtype;
  confirmed_count integer;
  waitlist_count integer;
  next_order integer;
  new_row public.lesson_participants;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_member() then
    raise exception '只有正式成員可以參加社課。';
  end if;

  select *
  into lesson_row
  from public.lessons
  where id = target_lesson_id
  for update;

  if lesson_row.id is null then
    raise exception '找不到社課。';
  end if;

  if public.lesson_registration_closed(lesson_row.registration_deadline) then
    raise exception '此社課已截止報名。';
  end if;

  if exists (
    select 1
    from public.lesson_participants
    where lesson_id = target_lesson_id
      and user_id = auth.uid()
  ) then
    raise exception '你已經報名此社課。';
  end if;

  perform public.promote_lesson_waitlist(target_lesson_id);

  select count(*)::integer
  into confirmed_count
  from public.lesson_participants
  where lesson_id = target_lesson_id
    and status = 'confirmed';

  if confirmed_count < lesson_row.capacity then
    insert into public.lesson_participants (lesson_id, user_id, status)
    values (target_lesson_id, auth.uid(), 'confirmed')
    returning * into new_row;
    return new_row;
  end if;

  select count(*)::integer
  into waitlist_count
  from public.lesson_participants
  where lesson_id = target_lesson_id
    and status = 'waitlist';

  if waitlist_count >= lesson_row.waitlist_capacity then
    raise exception '已額滿。';
  end if;

  select coalesce(max(waitlist_order), 0) + 1
  into next_order
  from public.lesson_participants
  where lesson_id = target_lesson_id
    and status = 'waitlist';

  insert into public.lesson_participants (
    lesson_id,
    user_id,
    status,
    waitlist_order
  )
  values (target_lesson_id, auth.uid(), 'waitlist', next_order)
  returning * into new_row;

  return new_row;
end;
$$;

create or replace function public.cancel_lesson_participation(
  target_lesson_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson_row public.lessons%rowtype;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  select *
  into lesson_row
  from public.lessons
  where id = target_lesson_id
  for update;

  if lesson_row.id is null then
    raise exception '找不到社課。';
  end if;

  if public.lesson_cancellation_locked(lesson_row.registration_deadline) then
    raise exception '報名截止時間前三小時起不可取消。';
  end if;

  delete from public.lesson_participants
  where lesson_id = target_lesson_id
    and user_id = auth.uid();

  if not found then
    raise exception '找不到報名紀錄。';
  end if;

  perform public.promote_lesson_waitlist(target_lesson_id);
end;
$$;

create or replace function public.create_lesson(
  target_lesson_date date,
  target_start_time time,
  target_end_time time,
  target_capacity integer,
  target_waitlist_capacity integer,
  target_note text,
  target_instructor_ids uuid[],
  target_registration_deadline timestamptz
)
returns public.lessons
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson_start_at timestamptz;
  new_lesson public.lessons;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以新增社課。';
  end if;

  if target_lesson_date is null
    or target_start_time is null
    or target_end_time is null
    or target_end_time <= target_start_time
  then
    raise exception '社課日期或時間無效。';
  end if;

  lesson_start_at :=
    (target_lesson_date + target_start_time) at time zone 'Asia/Taipei';

  if lesson_start_at <= now() then
    raise exception '不能新增已經開始的社課。';
  end if;

  if target_registration_deadline is null
    or target_registration_deadline <= now()
    or target_registration_deadline >= lesson_start_at
  then
    raise exception '報名截止時間必須晚於現在且早於社課開始時間。';
  end if;

  if target_capacity is null or target_capacity < 1 then
    raise exception '上限人數必須大於 0。';
  end if;

  if target_waitlist_capacity is null or target_waitlist_capacity < 0 then
    raise exception '備取人數不可小於 0。';
  end if;

  if coalesce(cardinality(target_instructor_ids), 0) = 0 then
    raise exception '請至少選擇一位教學。';
  end if;

  if exists (
    select 1
    from unnest(target_instructor_ids) as instructor(instructor_id)
    left join public.profiles profile on profile.id = instructor.instructor_id
    where profile.id is null
      or profile.role not in ('officer', 'admin')
  ) then
    raise exception '教學名單包含無效成員。';
  end if;

  insert into public.lessons (
    lesson_date,
    start_time,
    end_time,
    registration_deadline,
    capacity,
    waitlist_capacity,
    note,
    created_by
  )
  values (
    target_lesson_date,
    target_start_time,
    target_end_time,
    target_registration_deadline,
    target_capacity,
    target_waitlist_capacity,
    nullif(btrim(target_note), ''),
    auth.uid()
  )
  returning * into new_lesson;

  insert into public.lesson_instructors (lesson_id, instructor_id)
  select new_lesson.id, instructor_id
  from (
    select distinct unnest(target_instructor_ids) as instructor_id
  ) instructors;

  return new_lesson;
end;
$$;

-- Keep the previous signature as a safe fallback for older deployed clients.
-- It preserves the old default of closing registration five hours before start.
create or replace function public.create_lesson(
  target_lesson_date date,
  target_start_time time,
  target_end_time time,
  target_capacity integer,
  target_waitlist_capacity integer,
  target_note text,
  target_instructor_ids uuid[]
)
returns public.lessons
language sql
security definer
set search_path = ''
as $$
  select public.create_lesson(
    target_lesson_date,
    target_start_time,
    target_end_time,
    target_capacity,
    target_waitlist_capacity,
    target_note,
    target_instructor_ids,
    ((target_lesson_date + target_start_time) at time zone 'Asia/Taipei')
      - interval '5 hours'
  );
$$;

revoke all on function public.lesson_registration_closed(timestamptz)
  from public, anon;
revoke all on function public.lesson_cancellation_locked(timestamptz)
  from public, anon;
revoke all on function public.join_lesson(uuid) from public, anon;
revoke all on function public.cancel_lesson_participation(uuid) from public, anon;
revoke all on function public.create_lesson(
  date, time, time, integer, integer, text, uuid[], timestamptz
) from public, anon;
revoke all on function public.create_lesson(
  date, time, time, integer, integer, text, uuid[]
) from public, anon;

grant execute on function public.lesson_registration_closed(timestamptz)
  to authenticated;
grant execute on function public.lesson_cancellation_locked(timestamptz)
  to authenticated;
grant execute on function public.join_lesson(uuid) to authenticated;
grant execute on function public.cancel_lesson_participation(uuid)
  to authenticated;
grant execute on function public.create_lesson(
  date, time, time, integer, integer, text, uuid[], timestamptz
) to authenticated;
grant execute on function public.create_lesson(
  date, time, time, integer, integer, text, uuid[]
) to authenticated;
