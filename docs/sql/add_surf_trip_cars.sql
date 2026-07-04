-- Surf trip convoy cars and passengers (跟車系統).
-- Run this in the Supabase SQL editor after deploy.
-- Requires docs/sql/add_surf_trips.sql and is_current_profile_member().

create table if not exists public.surf_trip_cars (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.surf_trips (id) on delete cascade,
  leader_id uuid not null references public.profiles (id) on delete restrict,
  capacity integer not null check (capacity >= 1),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (trip_id, leader_id)
);

create table if not exists public.surf_trip_car_passengers (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.surf_trip_cars (id) on delete cascade,
  trip_id uuid not null references public.surf_trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot_index integer not null check (slot_index >= 1),
  created_at timestamptz not null default now(),
  unique (car_id, slot_index),
  unique (trip_id, user_id)
);

create index if not exists surf_trip_cars_trip_id_idx
  on public.surf_trip_cars (trip_id, created_at);

create index if not exists surf_trip_car_passengers_trip_id_idx
  on public.surf_trip_car_passengers (trip_id);

create index if not exists surf_trip_car_passengers_car_id_idx
  on public.surf_trip_car_passengers (car_id);

alter table public.surf_trip_cars enable row level security;
alter table public.surf_trip_car_passengers enable row level security;

drop policy if exists "Members can read surf trip cars" on public.surf_trip_cars;
create policy "Members can read surf trip cars"
on public.surf_trip_cars
for select
to authenticated
using (public.is_current_profile_member());

drop policy if exists "Members can insert own surf trip cars" on public.surf_trip_cars;
create policy "Members can insert own surf trip cars"
on public.surf_trip_cars
for insert
to authenticated
with check (
  public.is_current_profile_member()
  and created_by = auth.uid()
  and leader_id = auth.uid()
);

drop policy if exists "Leaders and staff can delete surf trip cars"
on public.surf_trip_cars;
create policy "Leaders and staff can delete surf trip cars"
on public.surf_trip_cars
for delete
to authenticated
using (
  public.is_current_profile_member()
  and (
    leader_id = auth.uid()
    or created_by = auth.uid()
    or public.is_current_profile_staff()
  )
);

drop policy if exists "Members can read surf trip car passengers"
on public.surf_trip_car_passengers;
create policy "Members can read surf trip car passengers"
on public.surf_trip_car_passengers
for select
to authenticated
using (public.is_current_profile_member());

drop policy if exists "Members can insert own passenger records"
on public.surf_trip_car_passengers;
create policy "Members can insert own passenger records"
on public.surf_trip_car_passengers
for insert
to authenticated
with check (
  public.is_current_profile_member()
  and user_id = auth.uid()
);

drop policy if exists "Members can delete own passenger records"
on public.surf_trip_car_passengers;
create policy "Members can delete own passenger records"
on public.surf_trip_car_passengers
for delete
to authenticated
using (
  public.is_current_profile_member()
  and (
    user_id = auth.uid()
    or public.is_current_profile_staff()
  )
);

create or replace function public.user_meets_trip_surf_level(
  user_level text,
  min_level text
)
returns boolean
language sql
immutable
as $$
  select
    min_level is null
    or case coalesce(user_level, '')
      when '初階' then 1
      when '中階' then 2
      when '中進階' then 3
      when '進階' then 4
      else 0
    end >= case min_level
      when '初階' then 1
      when '中階' then 2
      when '中進階' then 3
      when '進階' then 4
      else 0
    end;
$$;

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

create or replace function public.join_surf_trip_car(
  target_car_id uuid,
  target_slot_index integer
)
returns public.surf_trip_car_passengers
language plpgsql
security definer
set search_path = public
as $$
declare
  car_row public.surf_trip_cars%rowtype;
  trip_row public.surf_trips%rowtype;
  user_level text;
  new_passenger public.surf_trip_car_passengers;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_member() then
    raise exception '只有正式成員可以跟車。';
  end if;

  select *
  into car_row
  from public.surf_trip_cars
  where id = target_car_id;

  if car_row.id is null then
    raise exception '找不到此車。';
  end if;

  select *
  into trip_row
  from public.surf_trips
  where id = car_row.trip_id;

  if trip_row.id is null then
    raise exception '找不到此外衝活動。';
  end if;

  if target_slot_index is null
    or target_slot_index < 1
    or target_slot_index > car_row.capacity
  then
    raise exception '車廂位置無效。';
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
    from public.surf_trip_cars
    where trip_id = car_row.trip_id
      and leader_id = auth.uid()
  ) then
    raise exception '你已經是此外衝車長。';
  end if;

  if exists (
    select 1
    from public.surf_trip_car_passengers
    where trip_id = car_row.trip_id
      and user_id = auth.uid()
  ) then
    raise exception '你已經在此外衝中跟車。';
  end if;

  if exists (
    select 1
    from public.surf_trip_car_passengers
    where car_id = target_car_id
      and slot_index = target_slot_index
  ) then
    raise exception '此車廂已有人。';
  end if;

  insert into public.surf_trip_car_passengers (
    car_id,
    trip_id,
    user_id,
    slot_index
  )
  values (
    target_car_id,
    car_row.trip_id,
    auth.uid(),
    target_slot_index
  )
  returning * into new_passenger;

  return new_passenger;
end;
$$;

create or replace function public.leave_surf_trip_car(target_passenger_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  delete from public.surf_trip_car_passengers
  where id = target_passenger_id
    and (
      user_id = auth.uid()
      or public.is_current_profile_staff()
    );

  if not found then
    raise exception '取消失敗，找不到跟車紀錄。';
  end if;
end;
$$;

create or replace function public.create_default_surf_trip_car()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.surf_trip_cars (
    trip_id,
    leader_id,
    capacity,
    created_by
  )
  values (
    new.id,
    new.leader_id,
    new.capacity,
    new.created_by
  );

  return new;
end;
$$;

drop trigger if exists create_default_surf_trip_car on public.surf_trips;
create trigger create_default_surf_trip_car
after insert on public.surf_trips
for each row
execute function public.create_default_surf_trip_car();

grant select, insert, delete on public.surf_trip_cars to authenticated;
grant select, insert, delete on public.surf_trip_car_passengers to authenticated;
grant execute on function public.user_meets_trip_surf_level(text, text) to authenticated;
grant execute on function public.create_surf_trip_car(uuid, integer) to authenticated;
grant execute on function public.join_surf_trip_car(uuid, integer) to authenticated;
grant execute on function public.leave_surf_trip_car(uuid) to authenticated;
