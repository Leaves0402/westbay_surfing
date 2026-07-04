-- Surf trip waitlist (max 3). Requires add_surf_trip_cars.sql.

create table if not exists public.surf_trip_waitlist (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.surf_trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  waitlist_order integer not null check (waitlist_order >= 1),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id),
  unique (trip_id, waitlist_order)
);

create index if not exists surf_trip_waitlist_trip_id_idx
  on public.surf_trip_waitlist (trip_id, waitlist_order);

alter table public.surf_trip_waitlist enable row level security;

drop policy if exists "Members can read surf trip waitlist" on public.surf_trip_waitlist;
create policy "Members can read surf trip waitlist"
on public.surf_trip_waitlist for select to authenticated
using (public.is_current_profile_member());

create or replace function public.reorder_surf_trip_waitlist(target_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ordered as (
    select
      id,
      row_number() over (order by waitlist_order asc, created_at asc) as new_order
    from public.surf_trip_waitlist
    where trip_id = target_trip_id
  )
  update public.surf_trip_waitlist waitlist
  set waitlist_order = ordered.new_order
  from ordered
  where waitlist.id = ordered.id;
end;
$$;

create or replace function public.promote_surf_trip_waitlist(target_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  car_row record;
  target_car_id uuid;
  empty_slot integer;
begin
  loop
    select *
    into candidate
    from public.surf_trip_waitlist
    where trip_id = target_trip_id
    order by waitlist_order asc, created_at asc
    limit 1;

    exit when candidate.id is null;

    target_car_id := null;
    empty_slot := null;

    for car_row in
      select *
      from public.surf_trip_cars
      where trip_id = target_trip_id
      order by created_at asc
    loop
      select gs.slot_index
      into empty_slot
      from generate_series(1, car_row.capacity) as gs(slot_index)
      where not exists (
        select 1
        from public.surf_trip_car_passengers passenger
        where passenger.car_id = car_row.id
          and passenger.slot_index = gs.slot_index
      )
      order by gs.slot_index
      limit 1;

      if empty_slot is not null then
        target_car_id := car_row.id;
        exit;
      end if;
    end loop;

    exit when target_car_id is null or empty_slot is null;

    insert into public.surf_trip_car_passengers (
      car_id, trip_id, user_id, slot_index
    )
    values (
      target_car_id,
      target_trip_id,
      candidate.user_id,
      empty_slot
    );

    delete from public.surf_trip_waitlist where id = candidate.id;
  end loop;

  perform public.reorder_surf_trip_waitlist(target_trip_id);
end;
$$;

create or replace function public.join_surf_trip_waitlist(target_trip_id uuid)
returns public.surf_trip_waitlist
language plpgsql
security definer
set search_path = public
as $$
declare
  trip_row public.surf_trips%rowtype;
  user_level text;
  total_capacity integer;
  total_passengers integer;
  waitlist_count integer;
  next_order integer;
  new_row public.surf_trip_waitlist;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if not public.is_current_profile_member() then
    raise exception '只有正式成員可以加入備取。';
  end if;

  perform public.promote_surf_trip_waitlist(target_trip_id);

  select * into trip_row from public.surf_trips where id = target_trip_id;
  if trip_row.id is null then
    raise exception '找不到外衝活動。';
  end if;

  select surf_level into user_level from public.profiles where id = auth.uid();
  if not public.user_meets_trip_surf_level(user_level, trip_row.min_surf_level) then
    raise exception '你的衝浪程度未達此外衝限制。';
  end if;

  if exists (
    select 1 from public.surf_trip_cars
    where trip_id = target_trip_id and leader_id = auth.uid()
  ) then
    raise exception '你已經是此外衝車長。';
  end if;

  if exists (
    select 1 from public.surf_trip_car_passengers
    where trip_id = target_trip_id and user_id = auth.uid()
  ) then
    raise exception '你已經在此外衝中跟車。';
  end if;

  if exists (
    select 1 from public.surf_trip_waitlist
    where trip_id = target_trip_id and user_id = auth.uid()
  ) then
    raise exception '你已經在備取名單中。';
  end if;

  select coalesce(sum(capacity), 0)::integer into total_capacity
  from public.surf_trip_cars
  where trip_id = target_trip_id;

  select count(*)::integer into total_passengers
  from public.surf_trip_car_passengers
  where trip_id = target_trip_id;

  if total_passengers < total_capacity then
    raise exception '仍有空車廂，請直接跟車。';
  end if;

  select count(*)::integer into waitlist_count
  from public.surf_trip_waitlist
  where trip_id = target_trip_id;

  if waitlist_count >= 3 then
    raise exception '備取已滿。';
  end if;

  select coalesce(max(waitlist_order), 0) + 1 into next_order
  from public.surf_trip_waitlist
  where trip_id = target_trip_id;

  insert into public.surf_trip_waitlist (trip_id, user_id, waitlist_order)
  values (target_trip_id, auth.uid(), next_order)
  returning * into new_row;

  return new_row;
end;
$$;

create or replace function public.cancel_surf_trip_waitlist(target_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  delete from public.surf_trip_waitlist
  where trip_id = target_trip_id
    and user_id = auth.uid();

  if not found then
    raise exception '找不到備取紀錄。';
  end if;

  perform public.reorder_surf_trip_waitlist(target_trip_id);
end;
$$;

-- Promote waitlist after leaving a car.
create or replace function public.leave_surf_trip_car(target_passenger_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  passenger_row public.surf_trip_car_passengers%rowtype;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  select *
  into passenger_row
  from public.surf_trip_car_passengers
  where id = target_passenger_id;

  if passenger_row.id is null then
    raise exception '取消失敗，找不到跟車紀錄。';
  end if;

  if passenger_row.user_id is distinct from auth.uid()
    and not public.is_current_profile_staff()
  then
    raise exception '只能取消自己的跟車。';
  end if;

  delete from public.surf_trip_car_passengers
  where id = target_passenger_id;

  perform public.promote_surf_trip_waitlist(passenger_row.trip_id);
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

  select * into car_row from public.surf_trip_cars where id = target_car_id;
  if car_row.id is null then
    raise exception '找不到此車。';
  end if;

  select * into trip_row from public.surf_trips where id = car_row.trip_id;
  if trip_row.id is null then
    raise exception '找不到此外衝活動。';
  end if;

  if target_slot_index is null
    or target_slot_index < 1
    or target_slot_index > car_row.capacity
  then
    raise exception '車廂位置無效。';
  end if;

  select surf_level into user_level from public.profiles where id = auth.uid();
  if not public.user_meets_trip_surf_level(user_level, trip_row.min_surf_level) then
    raise exception '你的衝浪程度未達此外衝限制。';
  end if;

  if exists (
    select 1 from public.surf_trip_cars
    where trip_id = car_row.trip_id and leader_id = auth.uid()
  ) then
    raise exception '你已經是此外衝車長。';
  end if;

  if exists (
    select 1 from public.surf_trip_car_passengers
    where trip_id = car_row.trip_id and user_id = auth.uid()
  ) then
    raise exception '你已經在此外衝中跟車。';
  end if;

  if exists (
    select 1 from public.surf_trip_waitlist
    where trip_id = car_row.trip_id and user_id = auth.uid()
  ) then
    raise exception '你已在備取名單，請先取消備取。';
  end if;

  if exists (
    select 1 from public.surf_trip_car_passengers
    where car_id = target_car_id and slot_index = target_slot_index
  ) then
    raise exception '此車廂已有人。';
  end if;

  insert into public.surf_trip_car_passengers (
    car_id, trip_id, user_id, slot_index
  )
  values (
    target_car_id, car_row.trip_id, auth.uid(), target_slot_index
  )
  returning * into new_passenger;

  return new_passenger;
end;
$$;

grant select on public.surf_trip_waitlist to authenticated;
grant execute on function public.reorder_surf_trip_waitlist(uuid) to authenticated;
grant execute on function public.promote_surf_trip_waitlist(uuid) to authenticated;
grant execute on function public.join_surf_trip_waitlist(uuid) to authenticated;
grant execute on function public.cancel_surf_trip_waitlist(uuid) to authenticated;
grant execute on function public.leave_surf_trip_car(uuid) to authenticated;
grant execute on function public.join_surf_trip_car(uuid, integer) to authenticated;
