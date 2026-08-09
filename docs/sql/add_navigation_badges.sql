-- Lightweight per-member read cursors for announcement and lesson badges.
-- Run after apply_medium_priority_improvements.sql.

begin;

create table if not exists public.member_content_read_state (
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('announcements', 'lessons')),
  last_seen_content_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

alter table public.member_content_read_state enable row level security;

drop policy if exists "Members can read own content state"
on public.member_content_read_state;
create policy "Members can read own content state"
on public.member_content_read_state for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Members can insert own content state"
on public.member_content_read_state;
create policy "Members can insert own content state"
on public.member_content_read_state for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Members can update own content state"
on public.member_content_read_state;
create policy "Members can update own content state"
on public.member_content_read_state for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists announcements_created_at_idx
  on public.announcements (created_at desc);

create index if not exists lessons_created_at_idx
  on public.lessons (created_at desc);

create or replace function public.get_my_navigation_badges()
returns table (
  has_unread_announcements boolean,
  has_unread_lessons boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  latest_announcement_at timestamptz;
  latest_lesson_at timestamptz;
  announcement_seen_at timestamptz;
  lesson_seen_at timestamptz;
begin
  if auth.uid() is null or not public.is_current_profile_member() then
    return query select false, false;
    return;
  end if;

  select max(announcement.created_at)
  into latest_announcement_at
  from public.announcements announcement;

  select max(lesson.created_at)
  into latest_lesson_at
  from public.lessons lesson;

  select state.last_seen_content_at
  into announcement_seen_at
  from public.member_content_read_state state
  where state.user_id = auth.uid()
    and state.channel = 'announcements';

  select state.last_seen_content_at
  into lesson_seen_at
  from public.member_content_read_state state
  where state.user_id = auth.uid()
    and state.channel = 'lessons';

  return query
  select
    latest_announcement_at is not null
      and (
        announcement_seen_at is null
        or latest_announcement_at > announcement_seen_at
      ),
    latest_lesson_at is not null
      and (
        lesson_seen_at is null
        or latest_lesson_at > lesson_seen_at
      );
end;
$$;

create or replace function public.mark_navigation_channel_read(
  target_channel text
)
returns table (
  has_unread_announcements boolean,
  has_unread_lessons boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest_content_at timestamptz;
begin
  if auth.uid() is null or not public.is_current_profile_member() then
    raise exception 'Only confirmed members can update content read state.';
  end if;

  if target_channel is null
    or target_channel not in ('announcements', 'lessons') then
    raise exception 'Unsupported navigation channel.';
  end if;

  if target_channel = 'announcements' then
    select max(announcement.created_at)
    into latest_content_at
    from public.announcements announcement;
  else
    select max(lesson.created_at)
    into latest_content_at
    from public.lessons lesson;
  end if;

  if latest_content_at is not null then
    insert into public.member_content_read_state as state (
      user_id,
      channel,
      last_seen_content_at,
      updated_at
    )
    values (
      auth.uid(),
      target_channel,
      latest_content_at,
      now()
    )
    on conflict (user_id, channel) do update
    set
      last_seen_content_at = greatest(
        state.last_seen_content_at,
        excluded.last_seen_content_at
      ),
      updated_at = now()
    where state.last_seen_content_at < excluded.last_seen_content_at;
  end if;

  return query select * from public.get_my_navigation_badges();
end;
$$;

-- Existing members start from the content that already exists at migration time,
-- so only future announcements and lessons create a new badge.
with latest_content as (
  select
    'announcements'::text as channel,
    max(announcement.created_at) as latest_at
  from public.announcements announcement
  union all
  select
    'lessons'::text as channel,
    max(lesson.created_at) as latest_at
  from public.lessons lesson
)
insert into public.member_content_read_state (
  user_id,
  channel,
  last_seen_content_at
)
select
  profile.id,
  latest_content.channel,
  latest_content.latest_at
from public.profiles profile
cross join latest_content
where profile.role in ('member', 'board_manager', 'officer', 'admin')
  and latest_content.latest_at is not null
on conflict (user_id, channel) do nothing;

revoke all on table public.member_content_read_state
  from public, anon, authenticated;

revoke all on function public.get_my_navigation_badges()
  from public, anon;
revoke all on function public.mark_navigation_channel_read(text)
  from public, anon;

grant execute on function public.get_my_navigation_badges()
  to authenticated;
grant execute on function public.mark_navigation_channel_read(text)
  to authenticated;

commit;
