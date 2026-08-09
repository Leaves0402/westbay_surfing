-- Priority correctness and security fixes.
-- Run after every existing SQL file in docs/sql.
--
-- Includes:
-- 1. Atomic lesson creation, concurrency-safe registration and attendance guards.
-- 2. Atomic surfboard metadata/image-row mutations.
-- 3. Surf-trip participation snapshots, three-day retention and member statistics.
-- 4. Atomic surf-trip creation and protected member-role updates.
-- 5. Explicit SECURITY DEFINER execute privileges.

-- ---------------------------------------------------------------------------
-- Lesson correctness
-- ---------------------------------------------------------------------------

-- Normalize any old duplicate waitlist positions before enforcing uniqueness.
with ordered_waitlist as (
  select
    id,
    row_number() over (
      partition by lesson_id
      order by waitlist_order asc nulls last, created_at asc, id asc
    )::integer as normalized_order
  from public.lesson_participants
  where status = 'waitlist'
)
update public.lesson_participants participant
set waitlist_order = ordered_waitlist.normalized_order
from ordered_waitlist
where participant.id = ordered_waitlist.id;

create unique index if not exists lesson_participants_waitlist_order_unique_idx
  on public.lesson_participants (lesson_id, waitlist_order)
  where status = 'waitlist';

create or replace function public.promote_lesson_waitlist(target_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lesson_row public.lessons%rowtype;
  confirmed_count integer;
  candidate_id uuid;
begin
  select *
  into lesson_row
  from public.lessons
  where id = target_lesson_id
  for update;

  if lesson_row.id is null then
    return;
  end if;

  loop
    select count(*)::integer
    into confirmed_count
    from public.lesson_participants
    where lesson_id = target_lesson_id
      and status = 'confirmed';

    exit when confirmed_count >= lesson_row.capacity;

    select id
    into candidate_id
    from public.lesson_participants
    where lesson_id = target_lesson_id
      and status = 'waitlist'
    order by waitlist_order asc nulls last, created_at asc, id asc
    limit 1
    for update;

    exit when candidate_id is null;

    update public.lesson_participants
    set
      status = 'confirmed',
      waitlist_order = null,
      updated_at = now()
    where id = candidate_id;
  end loop;

  -- Use negative temporary values so the unique index cannot collide while rows
  -- are being compacted (for example 2 -> 1 while the old 1 still exists).
  with ordered as (
    select
      id,
      row_number() over (
        order by waitlist_order asc nulls last, created_at asc, id asc
      )::integer as new_order
    from public.lesson_participants
    where lesson_id = target_lesson_id
      and status = 'waitlist'
  )
  update public.lesson_participants participant
  set waitlist_order = -ordered.new_order
  from ordered
  where participant.id = ordered.id;

  update public.lesson_participants
  set waitlist_order = -waitlist_order
  where lesson_id = target_lesson_id
    and status = 'waitlist'
    and waitlist_order < 0;
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

  select *
  into lesson_row
  from public.lessons
  where id = target_lesson_id
  for update;

  if lesson_row.id is null then
    raise exception '找不到社課。';
  end if;

  if public.lesson_cancel_locked(lesson_row.lesson_date, lesson_row.start_time) then
    raise exception '社課開始前 5 小時停止報名。';
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
language plpgsql
security definer
set search_path = public
as $$
declare
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

  if public.lesson_start_timestamp(target_lesson_date, target_start_time)
    <= (timezone('Asia/Taipei', now()))::timestamp
  then
    raise exception '不能新增已經開始的社課。';
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
    capacity,
    waitlist_capacity,
    note,
    created_by
  )
  values (
    target_lesson_date,
    target_start_time,
    target_end_time,
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
declare
  lesson_row public.lessons%rowtype;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以簽到。';
  end if;

  select * into lesson_row
  from public.lessons
  where id = target_lesson_id;

  if lesson_row.id is null then
    raise exception '找不到社課。';
  end if;

  if public.lesson_start_timestamp(lesson_row.lesson_date, lesson_row.start_time)
    > (timezone('Asia/Taipei', now()))::timestamp
  then
    raise exception '社課尚未開始，不能簽到。';
  end if;

  if not exists (
    select 1
    from public.lesson_participants
    where lesson_id = target_lesson_id
      and user_id = target_user_id
      and status = 'confirmed'
  ) then
    raise exception '此人不在本堂正式參加名單。';
  end if;

  insert into public.lesson_member_attendance (
    lesson_id,
    user_id,
    checked_in,
    checked_in_by,
    checked_in_at
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
declare
  lesson_row public.lessons%rowtype;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以簽到。';
  end if;

  select * into lesson_row
  from public.lessons
  where id = target_lesson_id;

  if lesson_row.id is null then
    raise exception '找不到社課。';
  end if;

  if public.lesson_start_timestamp(lesson_row.lesson_date, lesson_row.start_time)
    > (timezone('Asia/Taipei', now()))::timestamp
  then
    raise exception '社課尚未開始，不能簽到。';
  end if;

  if not exists (
    select 1
    from public.lesson_instructors
    where lesson_id = target_lesson_id
      and instructor_id = target_instructor_id
  ) then
    raise exception '此人不在本堂教學名單。';
  end if;

  insert into public.lesson_instructor_attendance (
    lesson_id,
    instructor_id,
    checked_in,
    checked_in_by,
    checked_in_at
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

create or replace function public.check_in_all_lesson_instructors(
  target_lesson_id uuid
)
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

  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以一鍵簽到。';
  end if;

  select * into lesson_row
  from public.lessons
  where id = target_lesson_id;

  if lesson_row.id is null then
    raise exception '找不到社課。';
  end if;

  if public.lesson_start_timestamp(lesson_row.lesson_date, lesson_row.start_time)
    > (timezone('Asia/Taipei', now()))::timestamp
  then
    raise exception '社課尚未開始，不能簽到。';
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

-- ---------------------------------------------------------------------------
-- Atomic surfboard mutations
-- ---------------------------------------------------------------------------

create or replace function public.create_surfboard_with_images(
  target_surfboard_id uuid,
  target_name text,
  target_suitability_level text,
  target_board_types text[],
  target_buoyancy numeric,
  target_length text,
  target_description text,
  target_storage_paths text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以新增衝浪板。';
  end if;

  if target_surfboard_id is null then
    raise exception '衝浪板識別碼無效。';
  end if;

  if coalesce(cardinality(target_storage_paths), 0) not between 1 and 3 then
    raise exception '每張衝浪板需要 1 至 3 張圖片。';
  end if;

  if exists (
    select 1
    from unnest(target_storage_paths) as image(storage_path)
    where image.storage_path not like target_surfboard_id::text || '/%'
  ) then
    raise exception '圖片路徑與衝浪板不符。';
  end if;

  if (select count(*) from unnest(target_storage_paths))
    <> (
      select count(distinct image.storage_path)
      from unnest(target_storage_paths) as image(storage_path)
    )
  then
    raise exception '圖片路徑不可重複。';
  end if;

  insert into public.surfboards (
    id,
    name,
    suitability_level,
    board_types,
    buoyancy,
    length,
    description,
    created_by
  )
  values (
    target_surfboard_id,
    target_name,
    target_suitability_level,
    target_board_types,
    target_buoyancy,
    target_length,
    target_description,
    auth.uid()
  );

  insert into public.surfboard_images (surfboard_id, storage_path, sort_order)
  select target_surfboard_id, storage_path, ordinal_position - 1
  from unnest(target_storage_paths) with ordinality
    as image(storage_path, ordinal_position);

  return target_surfboard_id;
end;
$$;

create or replace function public.update_surfboard_with_images(
  target_surfboard_id uuid,
  target_name text,
  target_suitability_level text,
  target_board_types text[],
  target_buoyancy numeric,
  target_length text,
  target_description text,
  target_storage_paths text[]
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
    raise exception '只有幹部與管理員可以編輯衝浪板。';
  end if;

  if coalesce(cardinality(target_storage_paths), 0) not between 1 and 3 then
    raise exception '每張衝浪板需要 1 至 3 張圖片。';
  end if;

  if exists (
    select 1
    from unnest(target_storage_paths) as image(storage_path)
    where image.storage_path not like target_surfboard_id::text || '/%'
  ) then
    raise exception '圖片路徑與衝浪板不符。';
  end if;

  if (select count(*) from unnest(target_storage_paths))
    <> (
      select count(distinct image.storage_path)
      from unnest(target_storage_paths) as image(storage_path)
    )
  then
    raise exception '圖片路徑不可重複。';
  end if;

  perform 1
  from public.surfboards
  where id = target_surfboard_id
  for update;

  if not found then
    raise exception '找不到衝浪板。';
  end if;

  update public.surfboards
  set
    name = target_name,
    suitability_level = target_suitability_level,
    board_types = target_board_types,
    buoyancy = target_buoyancy,
    length = target_length,
    description = target_description,
    updated_at = now()
  where id = target_surfboard_id;

  delete from public.surfboard_images
  where surfboard_id = target_surfboard_id;

  insert into public.surfboard_images (surfboard_id, storage_path, sort_order)
  select target_surfboard_id, storage_path, ordinal_position - 1
  from unnest(target_storage_paths) with ordinality
    as image(storage_path, ordinal_position);
end;
$$;

-- ---------------------------------------------------------------------------
-- Surf-trip lifecycle and persistent participation statistics
-- ---------------------------------------------------------------------------

alter table public.surf_trips
add column if not exists participation_counted_at timestamptz null;

create or replace function public.prevent_counted_surf_trip_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.participation_counted_at is not null
    and row(
      old.start_date,
      old.end_date,
      old.capacity,
      old.leader_id,
      old.min_surf_level,
      old.note
    ) is distinct from row(
      new.start_date,
      new.end_date,
      new.capacity,
      new.leader_id,
      new.min_surf_level,
      new.note
    )
  then
    raise exception '外衝已開始並完成計次，不能再修改活動資料。';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_counted_surf_trip_changes on public.surf_trips;
create trigger prevent_counted_surf_trip_changes
before update on public.surf_trips
for each row
execute function public.prevent_counted_surf_trip_changes();

create or replace function public.prevent_counted_surf_trip_roster_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_trip_id uuid := case when tg_op = 'DELETE' then old.trip_id else new.trip_id end;
  counted_at timestamptz;
begin
  -- The row lock serializes the final roster change with lifecycle counting.
  -- During ON DELETE CASCADE the parent is already gone, so cleanup remains valid.
  select participation_counted_at
  into counted_at
  from public.surf_trips
  where id = target_trip_id
  for share;

  if counted_at is not null then
    raise exception '外衝已開始並完成計次，車隊名單不能再修改。';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_counted_surf_trip_car_changes
on public.surf_trip_cars;
create trigger prevent_counted_surf_trip_car_changes
before insert or update or delete on public.surf_trip_cars
for each row
execute function public.prevent_counted_surf_trip_roster_changes();

drop trigger if exists prevent_counted_surf_trip_passenger_changes
on public.surf_trip_car_passengers;
create trigger prevent_counted_surf_trip_passenger_changes
before insert or update or delete on public.surf_trip_car_passengers
for each row
execute function public.prevent_counted_surf_trip_roster_changes();

drop trigger if exists prevent_counted_surf_trip_waitlist_changes
on public.surf_trip_waitlist;
create trigger prevent_counted_surf_trip_waitlist_changes
before insert or update or delete on public.surf_trip_waitlist
for each row
execute function public.prevent_counted_surf_trip_roster_changes();

drop trigger if exists prevent_counted_surf_trip_spot_changes
on public.surf_trip_spots;
create trigger prevent_counted_surf_trip_spot_changes
before insert or update or delete on public.surf_trip_spots
for each row
execute function public.prevent_counted_surf_trip_roster_changes();

create table if not exists public.surf_trip_participation_events (
  trip_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  trip_start_date date not null,
  participation_role text not null check (
    participation_role in ('leader', 'passenger')
  ),
  counted_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists surf_trip_participation_events_user_id_idx
  on public.surf_trip_participation_events (user_id);

alter table public.surf_trip_participation_events enable row level security;

drop policy if exists "Members can read surf trip participation events"
on public.surf_trip_participation_events;
create policy "Members can read surf trip participation events"
on public.surf_trip_participation_events
for select
to authenticated
using (public.is_current_profile_member());

grant select on public.surf_trip_participation_events to authenticated;

create or replace function public.process_surf_trip_lifecycle_internal()
returns table(counted_trips integer, deleted_trips integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  taipei_today date := (timezone('Asia/Taipei', now()))::date;
  trip_row record;
  counted_total integer := 0;
  deleted_total integer := 0;
begin
  for trip_row in
    select id, start_date
    from public.surf_trips
    where start_date <= taipei_today
      and participation_counted_at is null
    order by start_date asc, id asc
    for update skip locked
  loop
    insert into public.surf_trip_participation_events (
      trip_id,
      user_id,
      trip_start_date,
      participation_role,
      counted_at
    )
    select
      trip_row.id,
      roster.user_id,
      trip_row.start_date,
      case
        when bool_or(roster.participation_role = 'leader') then 'leader'
        else 'passenger'
      end,
      now()
    from (
      select trip.leader_id as user_id, 'leader'::text as participation_role
      from public.surf_trips trip
      where trip.id = trip_row.id

      union all

      select car.leader_id, 'leader'::text
      from public.surf_trip_cars car
      where car.trip_id = trip_row.id

      union all

      select passenger.user_id, 'passenger'::text
      from public.surf_trip_car_passengers passenger
      where passenger.trip_id = trip_row.id
    ) roster
    group by roster.user_id
    on conflict (trip_id, user_id) do nothing;

    update public.surf_trips
    set participation_counted_at = now()
    where id = trip_row.id;

    counted_total := counted_total + 1;
  end loop;

  -- A trip ending on Aug 9 remains visible on Aug 10, 11 and 12, and is
  -- removed from Aug 13 onward.
  with deleted as (
    delete from public.surf_trips
    where end_date < taipei_today - 3
    returning id
  )
  select count(*)::integer into deleted_total from deleted;

  return query select counted_total, deleted_total;
end;
$$;

create or replace function public.process_surf_trip_lifecycle()
returns table(counted_trips integer, deleted_trips integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_member() then
    raise exception '只有正式成員可以處理外衝狀態。';
  end if;

  return query
  select * from public.process_surf_trip_lifecycle_internal();
end;
$$;

-- Keep the existing RPC name compatible, but apply the new three-day policy.
create or replace function public.cleanup_past_surf_trips()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_total integer;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_member() then
    raise exception '只有正式成員可以清理過期活動。';
  end if;

  select lifecycle.deleted_trips
  into deleted_total
  from public.process_surf_trip_lifecycle_internal() lifecycle;

  return coalesce(deleted_total, 0);
end;
$$;

create or replace function public.get_member_surf_trip_counts()
returns table(user_id uuid, trip_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_member() then
    raise exception '只有正式成員可以查看外衝統計。';
  end if;

  perform public.process_surf_trip_lifecycle_internal();

  return query
  select event.user_id, count(*)::bigint
  from public.surf_trip_participation_events event
  group by event.user_id;
end;
$$;

create or replace function public.create_surf_trip(
  target_start_date date,
  target_end_date date,
  target_capacity integer,
  target_min_surf_level text,
  target_note text,
  target_spot_ids uuid[]
)
returns public.surf_trips
language plpgsql
security definer
set search_path = public
as $$
declare
  new_trip public.surf_trips;
  taipei_today date := (timezone('Asia/Taipei', now()))::date;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_member() then
    raise exception '只有正式成員可以新增外衝。';
  end if;

  if target_start_date is null
    or target_end_date is null
    or target_end_date < target_start_date
  then
    raise exception '外衝日期無效。';
  end if;

  if target_start_date <= taipei_today then
    raise exception '外衝必須至少提前一天建立，才能在開始時正確計次。';
  end if;

  if target_capacity is null or target_capacity not between 1 and 8 then
    raise exception '人數上限必須介於 1 到 8。';
  end if;

  if target_min_surf_level is not null
    and target_min_surf_level <> ''
    and target_min_surf_level not in ('初階', '中階', '中進階', '進階')
  then
    raise exception '程度限制無效。';
  end if;

  if coalesce(cardinality(target_spot_ids), 0) = 0 then
    raise exception '請至少選擇一個浪點。';
  end if;

  if exists (
    select 1
    from unnest(target_spot_ids) as requested_spot(spot_id)
    left join public.surf_spots spot on spot.id = requested_spot.spot_id
    where spot.id is null
  ) then
    raise exception '浪點資料無效。';
  end if;

  insert into public.surf_trips (
    start_date,
    end_date,
    capacity,
    leader_id,
    min_surf_level,
    note,
    created_by
  )
  values (
    target_start_date,
    target_end_date,
    target_capacity,
    auth.uid(),
    nullif(target_min_surf_level, ''),
    nullif(btrim(target_note), ''),
    auth.uid()
  )
  returning * into new_trip;

  insert into public.surf_trip_spots (trip_id, spot_id)
  select new_trip.id, spot_id
  from (
    select distinct unnest(target_spot_ids) as spot_id
  ) spots;

  return new_trip;
end;
$$;

create or replace function public.delete_surf_trip(target_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  trip_row public.surf_trips%rowtype;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  select *
  into trip_row
  from public.surf_trips
  where id = target_trip_id
  for update;

  if trip_row.id is null then
    raise exception '找不到外衝活動。';
  end if;

  if trip_row.leader_id is distinct from auth.uid() then
    raise exception '只有活動負責人可以移除此活動。';
  end if;

  if trip_row.participation_counted_at is not null then
    raise exception '外衝已開始並完成計次，將在結束三天後自動移除。';
  end if;

  delete from public.surf_trips where id = target_trip_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Member-role boundary
-- ---------------------------------------------------------------------------

create or replace function public.update_member_role(
  target_user_id uuid,
  target_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := public.current_profile_role();
  current_target_role text;
  admin_count integer;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if actor_role not in ('officer', 'admin') then
    raise exception '只有幹部與管理員可以調整社員身分。';
  end if;

  if target_user_id = auth.uid() then
    raise exception '不能調整自己的身分。';
  end if;

  if target_role not in ('member', 'board_manager', 'officer', 'admin') then
    raise exception '社員身分無效。';
  end if;

  select role::text
  into current_target_role
  from public.profiles
  where id = target_user_id
  for update;

  if current_target_role is null then
    raise exception '找不到社員。';
  end if;

  if actor_role = 'officer'
    and (current_target_role = 'admin' or target_role = 'admin')
  then
    raise exception '只有管理員可以授予或移除管理員身分。';
  end if;

  if current_target_role = 'admin' and target_role <> 'admin' then
    select count(*)::integer
    into admin_count
    from public.profiles
    where role = 'admin';

    if admin_count <= 1 then
      raise exception '不能移除最後一位管理員。';
    end if;
  end if;

  update public.profiles
  set role = target_role, updated_at = now()
  where id = target_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER privilege hardening
-- ---------------------------------------------------------------------------

do $$
declare
  function_row record;
begin
  for function_row in
    select proc.oid::regprocedure as signature
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.prosecdef
  loop
    execute format(
      'revoke all on function %s from public, anon',
      function_row.signature
    );
  end loop;
end;
$$;

-- Public schedule is intentionally available without authentication.
grant execute on function public.get_public_rental_schedule() to anon, authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_current_profile_staff() to authenticated;
grant execute on function public.is_current_profile_member() to authenticated;

-- Internal mutation helpers are callable only by their authorized wrappers.
revoke execute on function public.promote_lesson_waitlist(uuid) from authenticated;
revoke execute on function public.reorder_surf_trip_waitlist(uuid) from authenticated;
revoke execute on function public.promote_surf_trip_waitlist(uuid) from authenticated;
revoke execute on function public.process_surf_trip_lifecycle_internal() from authenticated;

grant execute on function public.join_lesson(uuid) to authenticated;
grant execute on function public.create_lesson(date, time, time, integer, integer, text, uuid[]) to authenticated;
grant execute on function public.set_lesson_member_attendance(uuid, uuid, boolean) to authenticated;
grant execute on function public.set_lesson_instructor_attendance(uuid, uuid, boolean) to authenticated;
grant execute on function public.check_in_all_lesson_instructors(uuid) to authenticated;
grant execute on function public.create_surfboard_with_images(uuid, text, text, text[], numeric, text, text, text[]) to authenticated;
grant execute on function public.update_surfboard_with_images(uuid, text, text, text[], numeric, text, text, text[]) to authenticated;
grant execute on function public.process_surf_trip_lifecycle() to authenticated;
grant execute on function public.cleanup_past_surf_trips() to authenticated;
grant execute on function public.get_member_surf_trip_counts() to authenticated;
grant execute on function public.create_surf_trip(date, date, integer, text, text, uuid[]) to authenticated;
grant execute on function public.delete_surf_trip(uuid) to authenticated;
grant execute on function public.update_member_role(uuid, text) to authenticated;

-- Run lifecycle hourly when pg_cron is available. If the project does not
-- permit enabling pg_cron, the trips and members pages still process it.
do $cron_setup$
begin
  begin
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    execute $schedule$
      select cron.schedule(
        'process-surf-trip-lifecycle',
        '5 * * * *',
        'select * from public.process_surf_trip_lifecycle_internal()'
      )
    $schedule$;
  exception
    when others then
      raise notice 'pg_cron is unavailable; lifecycle will run on page load: %', sqlerrm;
  end;
end;
$cron_setup$;
