-- 衝浪板管理（Surfboard management）：資料表、RLS、圖片數量限制與 Storage policy。
-- 需要 public.is_current_profile_staff()（見 update_member_list_and_surf_level_review.sql）。
-- 只有幹部（officer）與管理員（admin）可以查看與管理衝浪板資料與圖片。

-- ---------------------------------------------------------------------------
-- 資料表
-- ---------------------------------------------------------------------------

create table if not exists public.surfboards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  suitability_level text not null check (
    suitability_level in ('初階', '初中階', '中階', '中高階', '進階')
  ),
  board_types text[] not null check (
    array_length(board_types, 1) between 1 and 5
    and board_types <@ array['軟板', '硬板', '長板', '短板', '中長板']::text[]
  ),
  -- 浮力，單位：公升（L）。
  buoyancy numeric(5, 1) not null check (buoyancy > 0 and buoyancy <= 999),
  -- 長度，單位：呎（ft）。
  length numeric(4, 1) not null check (length > 0 and length <= 20),
  usage_level text not null check (
    usage_level in ('全新', '輕度使用', '中度使用', '重度使用')
  ),
  description text null check (
    description is null or char_length(description) <= 2000
  ),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 刪除衝浪板時，圖片資料列會透過 on delete cascade 一併清除。
-- Storage 內的實體圖片檔案由前端在刪除成功後呼叫 storage.remove() 清除，
-- 若清除失敗，前端會顯示包含檔案路徑的警告訊息以便追蹤。
create table if not exists public.surfboard_images (
  id uuid primary key default gen_random_uuid(),
  surfboard_id uuid not null references public.surfboards (id) on delete cascade,
  -- Supabase Storage（surfboard-images bucket）內的檔案路徑。
  storage_path text not null unique,
  sort_order integer not null default 0 check (sort_order between 0 and 2),
  created_at timestamptz not null default now()
);

create index if not exists surfboards_created_at_idx
  on public.surfboards (created_at asc);

create index if not exists surfboard_images_surfboard_id_sort_order_idx
  on public.surfboard_images (surfboard_id, sort_order);

-- ---------------------------------------------------------------------------
-- updated_at 處理
-- ---------------------------------------------------------------------------

create or replace function public.set_surfboards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_surfboards_updated_at on public.surfboards;

create trigger set_surfboards_updated_at
before update on public.surfboards
for each row
execute function public.set_surfboards_updated_at();

-- ---------------------------------------------------------------------------
-- 圖片數量限制：每張衝浪板最多 3 張圖片（資料庫層驗證，不只靠前端）。
-- ---------------------------------------------------------------------------

create or replace function public.enforce_surfboard_image_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  image_count integer;
begin
  -- 鎖定衝浪板資料列，避免同時插入造成超過上限。
  perform 1
  from public.surfboards
  where id = new.surfboard_id
  for update;

  select count(*)::integer
  into image_count
  from public.surfboard_images
  where surfboard_id = new.surfboard_id;

  if image_count >= 3 then
    raise exception '每張衝浪板最多 3 張圖片。';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_surfboard_image_limit on public.surfboard_images;

create trigger enforce_surfboard_image_limit
before insert on public.surfboard_images
for each row
execute function public.enforce_surfboard_image_limit();

-- ---------------------------------------------------------------------------
-- RLS：只有幹部（officer）與管理員（admin）可以讀取與管理。
-- pending、member、board_manager 即使直接呼叫 API 也無法讀取或修改。
-- ---------------------------------------------------------------------------

alter table public.surfboards enable row level security;
alter table public.surfboard_images enable row level security;

drop policy if exists "Staff can read surfboards" on public.surfboards;
create policy "Staff can read surfboards"
on public.surfboards for select to authenticated
using (public.is_current_profile_staff());

drop policy if exists "Staff can insert surfboards" on public.surfboards;
create policy "Staff can insert surfboards"
on public.surfboards for insert to authenticated
with check (
  public.is_current_profile_staff()
  and created_by = auth.uid()
);

drop policy if exists "Staff can update surfboards" on public.surfboards;
create policy "Staff can update surfboards"
on public.surfboards for update to authenticated
using (public.is_current_profile_staff())
with check (public.is_current_profile_staff());

drop policy if exists "Staff can delete surfboards" on public.surfboards;
create policy "Staff can delete surfboards"
on public.surfboards for delete to authenticated
using (public.is_current_profile_staff());

drop policy if exists "Staff can read surfboard images" on public.surfboard_images;
create policy "Staff can read surfboard images"
on public.surfboard_images for select to authenticated
using (public.is_current_profile_staff());

drop policy if exists "Staff can insert surfboard images" on public.surfboard_images;
create policy "Staff can insert surfboard images"
on public.surfboard_images for insert to authenticated
with check (public.is_current_profile_staff());

drop policy if exists "Staff can update surfboard images" on public.surfboard_images;
create policy "Staff can update surfboard images"
on public.surfboard_images for update to authenticated
using (public.is_current_profile_staff())
with check (public.is_current_profile_staff());

drop policy if exists "Staff can delete surfboard images" on public.surfboard_images;
create policy "Staff can delete surfboard images"
on public.surfboard_images for delete to authenticated
using (public.is_current_profile_staff());

grant select, insert, update, delete on public.surfboards to authenticated;
grant select, insert, update, delete on public.surfboard_images to authenticated;

-- ---------------------------------------------------------------------------
-- Storage：surfboard-images bucket 與 policy。
-- 私密 bucket（public = false），前端以 signed URL 顯示圖片。
-- 限制檔案大小 5MB 與圖片格式（JPG / PNG / WebP）。
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'surfboard-images',
  'surfboard-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff can read surfboard image files" on storage.objects;
create policy "Staff can read surfboard image files"
on storage.objects for select to authenticated
using (
  bucket_id = 'surfboard-images'
  and public.is_current_profile_staff()
);

drop policy if exists "Staff can upload surfboard image files" on storage.objects;
create policy "Staff can upload surfboard image files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'surfboard-images'
  and public.is_current_profile_staff()
);

drop policy if exists "Staff can update surfboard image files" on storage.objects;
create policy "Staff can update surfboard image files"
on storage.objects for update to authenticated
using (
  bucket_id = 'surfboard-images'
  and public.is_current_profile_staff()
)
with check (
  bucket_id = 'surfboard-images'
  and public.is_current_profile_staff()
);

drop policy if exists "Staff can delete surfboard image files" on storage.objects;
create policy "Staff can delete surfboard image files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'surfboard-images'
  and public.is_current_profile_staff()
);
