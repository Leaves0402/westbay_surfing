-- Surf trips (揪外衝): spots, trips, and trip-spot junction.
-- Run this in the Supabase SQL editor after deploy.

create or replace function public.is_current_profile_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role(), 'pending') in (
    'member',
    'board_manager',
    'officer',
    'admin'
  )
$$;

create table if not exists public.surf_spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  county text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name, county)
);

create table if not exists public.surf_trips (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  capacity integer not null check (capacity >= 1),
  leader_id uuid not null references public.profiles (id) on delete restrict,
  min_surf_level text null,
  note text null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (
    min_surf_level is null
    or min_surf_level in ('初階', '中階', '中進階', '進階')
  )
);

create table if not exists public.surf_trip_spots (
  trip_id uuid not null references public.surf_trips (id) on delete cascade,
  spot_id uuid not null references public.surf_spots (id) on delete restrict,
  primary key (trip_id, spot_id)
);

create index if not exists surf_spots_sort_order_idx
  on public.surf_spots (sort_order, name);

create index if not exists surf_trips_start_date_idx
  on public.surf_trips (start_date desc, created_at desc);

insert into public.surf_spots (name, county, sort_order)
values
  ('將軍', '台南', 1),
  ('漁光島', '台南', 2),
  ('西子灣', '高雄', 3),
  ('海口', '屏東', 4),
  ('南灣', '屏東', 5),
  ('佳樂水', '屏東', 6),
  ('九鵬', '屏東', 7),
  ('小漁港', '台東', 8),
  ('東河', '台東', 9),
  ('金樽', '台東', 10)
on conflict (name, county) do nothing;

alter table public.surf_spots enable row level security;
alter table public.surf_trips enable row level security;
alter table public.surf_trip_spots enable row level security;

drop policy if exists "Members can read surf spots" on public.surf_spots;
create policy "Members can read surf spots"
on public.surf_spots
for select
to authenticated
using (public.is_current_profile_member());

drop policy if exists "Members can insert surf spots" on public.surf_spots;
create policy "Members can insert surf spots"
on public.surf_spots
for insert
to authenticated
with check (public.is_current_profile_member());

drop policy if exists "Members can read surf trips" on public.surf_trips;
create policy "Members can read surf trips"
on public.surf_trips
for select
to authenticated
using (public.is_current_profile_member());

drop policy if exists "Members can insert surf trips" on public.surf_trips;
create policy "Members can insert surf trips"
on public.surf_trips
for insert
to authenticated
with check (
  public.is_current_profile_member()
  and created_by = auth.uid()
);

drop policy if exists "Creators leaders and staff can update surf trips"
on public.surf_trips;
create policy "Creators leaders and staff can update surf trips"
on public.surf_trips
for update
to authenticated
using (
  public.is_current_profile_member()
  and (
    created_by = auth.uid()
    or leader_id = auth.uid()
    or public.is_current_profile_staff()
  )
)
with check (
  public.is_current_profile_member()
  and (
    created_by = auth.uid()
    or leader_id = auth.uid()
    or public.is_current_profile_staff()
  )
);

drop policy if exists "Creators leaders and staff can delete surf trips"
on public.surf_trips;
create policy "Creators leaders and staff can delete surf trips"
on public.surf_trips
for delete
to authenticated
using (
  public.is_current_profile_member()
  and (
    created_by = auth.uid()
    or leader_id = auth.uid()
    or public.is_current_profile_staff()
  )
);

drop policy if exists "Members can read surf trip spots" on public.surf_trip_spots;
create policy "Members can read surf trip spots"
on public.surf_trip_spots
for select
to authenticated
using (public.is_current_profile_member());

drop policy if exists "Members can insert surf trip spots" on public.surf_trip_spots;
create policy "Members can insert surf trip spots"
on public.surf_trip_spots
for insert
to authenticated
with check (
  public.is_current_profile_member()
  and exists (
    select 1
    from public.surf_trips trip
    where trip.id = trip_id
      and (
        trip.created_by = auth.uid()
        or trip.leader_id = auth.uid()
        or public.is_current_profile_staff()
      )
  )
);

drop policy if exists "Creators leaders and staff can delete surf trip spots"
on public.surf_trip_spots;
create policy "Creators leaders and staff can delete surf trip spots"
on public.surf_trip_spots
for delete
to authenticated
using (
  public.is_current_profile_member()
  and exists (
    select 1
    from public.surf_trips trip
    where trip.id = trip_id
      and (
        trip.created_by = auth.uid()
        or trip.leader_id = auth.uid()
        or public.is_current_profile_staff()
      )
  )
);

grant select, insert on public.surf_spots to authenticated;
grant select, insert, update, delete on public.surf_trips to authenticated;
grant select, insert, delete on public.surf_trip_spots to authenticated;
grant execute on function public.is_current_profile_member() to authenticated;
