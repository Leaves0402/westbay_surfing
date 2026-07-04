-- Lessons (社課), instructors, participants, attendance.
-- Requires is_current_profile_member() and is_current_profile_staff().

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  lesson_date date not null,
  start_time time not null,
  end_time time not null,
  capacity integer not null default 20 check (capacity >= 1),
  waitlist_capacity integer not null default 10 check (waitlist_capacity >= 0),
  note text null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.lesson_instructors (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  instructor_id uuid not null references public.profiles (id) on delete restrict,
  primary key (lesson_id, instructor_id)
);

create table if not exists public.lesson_participants (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('confirmed', 'waitlist')),
  waitlist_order integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);

create table if not exists public.lesson_instructor_attendance (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  instructor_id uuid not null references public.profiles (id) on delete cascade,
  checked_in boolean not null default false,
  checked_in_by uuid null references public.profiles (id) on delete set null,
  checked_in_at timestamptz null,
  unique (lesson_id, instructor_id)
);

create table if not exists public.lesson_member_attendance (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  checked_in boolean not null default false,
  checked_in_by uuid null references public.profiles (id) on delete set null,
  checked_in_at timestamptz null,
  unique (lesson_id, user_id)
);

create index if not exists lessons_lesson_date_idx
  on public.lessons (lesson_date desc, start_time desc);

create index if not exists lesson_participants_lesson_id_status_idx
  on public.lesson_participants (lesson_id, status, waitlist_order);

alter table public.lessons enable row level security;
alter table public.lesson_instructors enable row level security;
alter table public.lesson_participants enable row level security;
alter table public.lesson_instructor_attendance enable row level security;
alter table public.lesson_member_attendance enable row level security;

drop policy if exists "Members can read lessons" on public.lessons;
create policy "Members can read lessons"
on public.lessons for select to authenticated
using (public.is_current_profile_member());

drop policy if exists "Staff can insert lessons" on public.lessons;
create policy "Staff can insert lessons"
on public.lessons for insert to authenticated
with check (
  public.is_current_profile_staff()
  and created_by = auth.uid()
);

drop policy if exists "Members can read lesson instructors" on public.lesson_instructors;
create policy "Members can read lesson instructors"
on public.lesson_instructors for select to authenticated
using (public.is_current_profile_member());

drop policy if exists "Staff can insert lesson instructors" on public.lesson_instructors;
create policy "Staff can insert lesson instructors"
on public.lesson_instructors for insert to authenticated
with check (public.is_current_profile_staff());

drop policy if exists "Members can read lesson participants" on public.lesson_participants;
create policy "Members can read lesson participants"
on public.lesson_participants for select to authenticated
using (public.is_current_profile_member());

drop policy if exists "Members can read instructor attendance"
on public.lesson_instructor_attendance;
create policy "Members can read instructor attendance"
on public.lesson_instructor_attendance for select to authenticated
using (public.is_current_profile_member());

drop policy if exists "Members can read member attendance"
on public.lesson_member_attendance;
create policy "Members can read member attendance"
on public.lesson_member_attendance for select to authenticated
using (public.is_current_profile_member());

create or replace function public.lesson_start_timestamp(
  target_date date,
  target_start_time time
)
returns timestamp
language sql
immutable
as $$
  select target_date + target_start_time;
$$;

create or replace function public.lesson_cancel_locked(
  target_date date,
  target_start_time time
)
returns boolean
language sql
stable
as $$
  select public.lesson_start_timestamp(target_date, target_start_time)
    <= (timezone('Asia/Taipei', now()))::timestamp + interval '5 hours';
$$;

create or replace function public.promote_lesson_waitlist(target_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lesson_row public.lessons%rowtype;
  confirmed_count integer;
  open_slots integer;
  candidate record;
begin
  select * into lesson_row from public.lessons where id = target_lesson_id;
  if lesson_row.id is null then
    return;
  end if;

  loop
    select count(*)::integer into confirmed_count
    from public.lesson_participants
    where lesson_id = target_lesson_id and status = 'confirmed';

    open_slots := lesson_row.capacity - confirmed_count;
    exit when open_slots <= 0;

    select *
    into candidate
    from public.lesson_participants
    where lesson_id = target_lesson_id
      and status = 'waitlist'
    order by waitlist_order asc nulls last, created_at asc
    limit 1;

    exit when candidate.id is null;

    update public.lesson_participants
    set
      status = 'confirmed',
      waitlist_order = null,
      updated_at = now()
    where id = candidate.id;
  end loop;

  with ordered as (
    select
      id,
      row_number() over (order by waitlist_order asc nulls last, created_at asc) as new_order
    from public.lesson_participants
    where lesson_id = target_lesson_id
      and status = 'waitlist'
  )
  update public.lesson_participants participant
  set
    waitlist_order = ordered.new_order,
    updated_at = now()
  from ordered
  where participant.id = ordered.id;
end;
$$;

create or replace function public.join_lesson(target_lesson_id uuid)
returns public.lesson_participants
language plpgsql
security definer
set search_path = public
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

  perform public.promote_lesson_waitlist(target_lesson_id);

  select * into lesson_row from public.lessons where id = target_lesson_id;
  if lesson_row.id is null then
    raise exception '找不到社課。';
  end if;

  if exists (
    select 1 from public.lesson_participants
    where lesson_id = target_lesson_id and user_id = auth.uid()
  ) then
    raise exception '你已經報名此社課。';
  end if;

  select count(*)::integer into confirmed_count
  from public.lesson_participants
  where lesson_id = target_lesson_id and status = 'confirmed';

  if confirmed_count < lesson_row.capacity then
    insert into public.lesson_participants (lesson_id, user_id, status)
    values (target_lesson_id, auth.uid(), 'confirmed')
    returning * into new_row;
    return new_row;
  end if;

  select count(*)::integer into waitlist_count
  from public.lesson_participants
  where lesson_id = target_lesson_id and status = 'waitlist';

  if waitlist_count >= lesson_row.waitlist_capacity then
    raise exception '已額滿。';
  end if;

  select coalesce(max(waitlist_order), 0) + 1 into next_order
  from public.lesson_participants
  where lesson_id = target_lesson_id and status = 'waitlist';

  insert into public.lesson_participants (
    lesson_id, user_id, status, waitlist_order
  )
  values (target_lesson_id, auth.uid(), 'waitlist', next_order)
  returning * into new_row;

  return new_row;
end;
$$;

create or replace function public.cancel_lesson_participation(target_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lesson_row public.lessons%rowtype;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  select * into lesson_row from public.lessons where id = target_lesson_id;
  if lesson_row.id is null then
    raise exception '找不到社課。';
  end if;

  if public.lesson_cancel_locked(lesson_row.lesson_date, lesson_row.start_time) then
    raise exception '社課開始前 5 小時內不可取消';
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

  if not exists (
    select 1 from public.lesson_instructors
    where lesson_id = target_lesson_id
      and instructor_id = auth.uid()
  ) then
    raise exception '只有本堂社課教學可以簽到。';
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

  if not exists (
    select 1 from public.lesson_instructors
    where lesson_id = target_lesson_id
      and instructor_id = auth.uid()
  ) then
    raise exception '只有本堂社課教學可以簽到。';
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

grant select, insert on public.lessons to authenticated;
grant select, insert on public.lesson_instructors to authenticated;
grant select on public.lesson_participants to authenticated;
grant select on public.lesson_instructor_attendance to authenticated;
grant select on public.lesson_member_attendance to authenticated;
grant execute on function public.promote_lesson_waitlist(uuid) to authenticated;
grant execute on function public.join_lesson(uuid) to authenticated;
grant execute on function public.cancel_lesson_participation(uuid) to authenticated;
grant execute on function public.set_lesson_instructor_attendance(uuid, uuid, boolean) to authenticated;
grant execute on function public.set_lesson_member_attendance(uuid, uuid, boolean) to authenticated;
