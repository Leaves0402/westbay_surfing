-- Capacity limit (1-8), trip leader management RPCs, and past-trip cleanup.
-- Run after add_surf_trips.sql and add_surf_trip_cars.sql.

alter table public.surf_trips
drop constraint if exists surf_trips_capacity_check;

alter table public.surf_trips
add constraint surf_trips_capacity_check
check (capacity >= 1 and capacity <= 8);

alter table public.surf_trip_cars
drop constraint if exists surf_trip_cars_capacity_check;

alter table public.surf_trip_cars
add constraint surf_trip_cars_capacity_check
check (capacity >= 1 and capacity <= 8);

create or replace function public.create_surf_trip_car(
  target_trip_id uuid,
  target_capacity integer
)
returns public.surf_trip_cars
language plpgsql
security definer
set search_path = public
as $$
declare
  trip_row public.surf_trips%rowtype;
  user_level text;
  new_car public.surf_trip_cars;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_member() then
    raise exception '只有正式成員可以新增車長。';
  end if;

  if target_capacity is null or target_capacity < 1 then
    raise exception '請輸入有效人數。';
  end if;

  if target_capacity > 8 then
    raise exception '人數上限最多 8 人，不包含負責人。';
  end if;

  select *
  into trip_row
  from public.surf_trips
  where id = target_trip_id;

  if trip_row.id is null then
    raise exception '找不到此外衝活動。';
  end if;

  select surf_level
  into user_level
  from public.profiles
  where id = auth.uid();

  if not public.user_meets_trip_surf_level(user_level, trip_row.min_surf_level) then
    raise exception '你的衝浪程度未達此外衝限制。';
  end if;

  if exists (
    select 1
    from public.surf_trip_car_passengers
    where trip_id = target_trip_id
      and user_id = auth.uid()
  ) then
    raise exception '你已經跟車，不能再新增車長。';
  end if;

  if exists (
    select 1
    from public.surf_trip_cars
    where trip_id = target_trip_id
      and leader_id = auth.uid()
  ) then
    raise exception '你已經是此外衝車長。';
  end if;

  insert into public.surf_trip_cars (
    trip_id,
    leader_id,
    capacity,
    created_by
  )
  values (
    target_trip_id,
    auth.uid(),
    target_capacity,
    auth.uid()
  )
  returning * into new_car;

  return new_car;
end;
$$;

create or replace function public.delete_surf_trip(target_trip_id uuid)
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
    select 1
    from public.surf_trips
    where id = target_trip_id
      and leader_id = auth.uid()
  ) then
    raise exception '只有活動負責人可以移除此活動。';
  end if;

  delete from public.surf_trips
  where id = target_trip_id
    and leader_id = auth.uid();
end;
$$;

create or replace function public.update_surf_trip_min_level(
  target_trip_id uuid,
  new_min_surf_level text
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

  if new_min_surf_level is not null
    and new_min_surf_level not in ('初階', '中階', '中進階', '進階')
  then
    raise exception '程度限制無效。';
  end if;

  if not exists (
    select 1
    from public.surf_trips
    where id = target_trip_id
      and leader_id = auth.uid()
  ) then
    raise exception '只有活動負責人可以修改程度限制。';
  end if;

  update public.surf_trips
  set
    min_surf_level = nullif(new_min_surf_level, ''),
    updated_at = now()
  where id = target_trip_id
    and leader_id = auth.uid();
end;
$$;

create or replace function public.remove_surf_trip_car_slot(
  target_car_id uuid,
  target_slot_index integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  car_row public.surf_trip_cars%rowtype;
  trip_leader uuid;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  select *
  into car_row
  from public.surf_trip_cars
  where id = target_car_id;

  if car_row.id is null then
    raise exception '找不到此車。';
  end if;

  select leader_id
  into trip_leader
  from public.surf_trips
  where id = car_row.trip_id;

  if trip_leader is distinct from auth.uid() then
    raise exception '只有活動負責人可以移除車廂。';
  end if;

  if car_row.capacity <= 1 then
    raise exception '車廂數量不可少於 1。';
  end if;

  if target_slot_index is distinct from car_row.capacity then
    raise exception '請先從最後一個空車廂開始移除。';
  end if;

  if exists (
    select 1
    from public.surf_trip_car_passengers
    where car_id = target_car_id
      and slot_index = target_slot_index
  ) then
    raise exception '此車廂已有跟車者，無法移除。';
  end if;

  update public.surf_trip_cars
  set capacity = capacity - 1
  where id = target_car_id;
end;
$$;

create or replace function public.cleanup_past_surf_trips()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_member() then
    raise exception '只有正式成員可以清理過期活動。';
  end if;

  with deleted as (
    delete from public.surf_trips
    where end_date < current_date
    returning id
  )
  select count(*)::integer into deleted_count from deleted;

  return coalesce(deleted_count, 0);
end;
$$;

-- Optional: schedule with pg_cron if available
-- select cron.schedule('cleanup-past-surf-trips', '15 0 * * *', $$select public.cleanup_past_surf_trips()$$);

grant execute on function public.delete_surf_trip(uuid) to authenticated;
grant execute on function public.update_surf_trip_min_level(uuid, text) to authenticated;
grant execute on function public.remove_surf_trip_car_slot(uuid, integer) to authenticated;
grant execute on function public.cleanup_past_surf_trips() to authenticated;
grant execute on function public.create_surf_trip_car(uuid, integer) to authenticated;
