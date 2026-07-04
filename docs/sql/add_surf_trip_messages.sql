-- Surf trip chat messages.
-- Run after add_surf_trips.sql.

create table if not exists public.surf_trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.surf_trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  check (char_length(btrim(message)) > 0),
  check (char_length(message) <= 500)
);

create index if not exists surf_trip_messages_trip_id_created_at_idx
  on public.surf_trip_messages (trip_id, created_at);

alter table public.surf_trip_messages enable row level security;

drop policy if exists "Members can read surf trip messages"
on public.surf_trip_messages;
create policy "Members can read surf trip messages"
on public.surf_trip_messages
for select
to authenticated
using (public.is_current_profile_member());

drop policy if exists "Members can insert own surf trip messages"
on public.surf_trip_messages;
create policy "Members can insert own surf trip messages"
on public.surf_trip_messages
for insert
to authenticated
with check (
  public.is_current_profile_member()
  and user_id = auth.uid()
);

grant select, insert on public.surf_trip_messages to authenticated;
