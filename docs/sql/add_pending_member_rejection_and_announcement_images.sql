-- Reject pending membership requests and allow one optional image per announcement.
-- Applied to the production Supabase project together with the matching frontend.

begin;

-- ---------------------------------------------------------------------------
-- Pending member rejection
-- ---------------------------------------------------------------------------

create or replace function public.reject_pending_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以刪除待審核申請。';
  end if;

  if target_user_id is null then
    raise exception '缺少待審核申請人。';
  end if;

  if target_user_id = auth.uid() then
    raise exception '不能刪除自己的資料。';
  end if;

  delete from public.profiles
  where id = target_user_id
    and role = 'pending';

  if not found then
    raise exception '找不到這筆待審核申請。';
  end if;
end;
$$;

revoke all on function public.reject_pending_member(uuid) from public, anon;
grant execute on function public.reject_pending_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Announcement images
-- ---------------------------------------------------------------------------

alter table public.announcements
  add column if not exists image_path text null;

alter table public.announcements
  drop constraint if exists announcements_image_path_length;

alter table public.announcements
  add constraint announcements_image_path_length
  check (image_path is null or char_length(image_path) between 1 and 500);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'announcement-images',
  'announcement-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members can read announcement images" on storage.objects;
create policy "Members can read announcement images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'announcement-images'
  and coalesce(public.current_profile_role(), 'pending') in (
    'member',
    'board_manager',
    'officer',
    'admin'
  )
);

drop policy if exists "Staff can upload announcement images" on storage.objects;
create policy "Staff can upload announcement images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'announcement-images'
  and public.is_current_profile_staff()
);

drop policy if exists "Staff can delete announcement images" on storage.objects;
create policy "Staff can delete announcement images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'announcement-images'
  and public.is_current_profile_staff()
);

commit;
