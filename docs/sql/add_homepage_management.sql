-- 首頁內容管理：文字、圖片、幹部展示與 Storage。
-- 需要既有的 public.current_profile_role()（見 add_is_paid_to_rental_registrations.sql）。
-- 此檔可重複安全執行。
--
-- 權限原則：
-- 1. 任何人（含未登入 anon）都可以 SELECT 首頁公開內容與讀取圖片。
-- 2. 只有 profiles.role IN ('officer', 'admin') 可以 INSERT / UPDATE / DELETE 與上傳、刪除圖片。
-- 3. 首頁展示幹部與系統帳號權限完全分離，這裡不會也不能修改 profiles.role。

-- ---------------------------------------------------------------------------
-- 0. 幹部以上權限判斷（與衝浪板管理共用同一套規則）
-- ---------------------------------------------------------------------------

create or replace function public.is_current_profile_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role(), 'pending') in ('officer', 'admin')
$$;

-- ---------------------------------------------------------------------------
-- 1. 資料表
-- ---------------------------------------------------------------------------

-- 單列設定表：用 is_singleton 固定只有一列，避免出現多份首頁內容。
create table if not exists public.homepage_content (
  id uuid primary key default gen_random_uuid(),
  is_singleton boolean not null default true,
  hero_title text not null default '西灣衝浪社'
    check (char_length(btrim(hero_title)) between 1 and 60),
  hero_subtitle text not null default ''
    check (char_length(hero_subtitle) <= 300),
  about_eyebrow text not null default 'ABOUT'
    check (char_length(about_eyebrow) <= 40),
  about_heading text not null default '關於西灣衝浪社'
    check (char_length(btrim(about_heading)) between 1 and 80),
  about_paragraphs text[] not null default '{}'
    check (array_length(about_paragraphs, 1) between 1 and 4),
  about_highlights jsonb not null default '[]'::jsonb,
  banner_slogan text not null default ''
    check (char_length(banner_slogan) <= 80),
  banner_subtitle text not null default ''
    check (char_length(banner_subtitle) <= 200),
  footer_club_name text not null default '西灣衝浪社'
    check (char_length(btrim(footer_club_name)) between 1 and 60),
  footer_description text not null default ''
    check (char_length(footer_description) <= 300),
  footer_instagram_url text null
    check (
      footer_instagram_url is null
      or footer_instagram_url = ''
      or footer_instagram_url ~* '^https?://'
    ),
  footer_admin_contact text null
    check (
      footer_admin_contact is null
      or char_length(footer_admin_contact) <= 200
    ),
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles (id) on delete set null,
  constraint homepage_content_singleton_check check (is_singleton)
);

create unique index if not exists homepage_content_singleton_idx
  on public.homepage_content (is_singleton);

-- about_highlights 必須是「物件陣列」且每項都有 title / description。
create or replace function public.homepage_highlights_are_valid(highlights jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(highlights) = 'array'
    and jsonb_array_length(highlights) <= 6
    and not exists (
      select 1
      from jsonb_array_elements(highlights) as item
      where jsonb_typeof(item.value) <> 'object'
        or coalesce(btrim(item.value ->> 'title'), '') = ''
        or char_length(item.value ->> 'title') > 40
        or char_length(coalesce(item.value ->> 'description', '')) > 200
    );
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'homepage_content_highlights_check'
      and conrelid = 'public.homepage_content'::regclass
  ) then
    alter table public.homepage_content
    add constraint homepage_content_highlights_check
    check (public.homepage_highlights_are_valid(about_highlights));
  end if;
end
$$;

-- 圖片：hero 可多張並排序，banner / footer / qr_code 各只有一張。
create table if not exists public.homepage_media (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hero', 'banner', 'footer', 'qr_code')),
  -- 兩種可能：homepage-images bucket 內的路徑（hero/uuid.webp），
  -- 或以 / 開頭的本機 public 圖片（/images/home/hero/hero-01.webp）。
  -- 後者讓還沒換照片的社團可以直接沿用原本內建的圖片。
  storage_path text not null check (char_length(btrim(storage_path)) > 0),
  alt text not null default '' check (char_length(alt) <= 200),
  sort_order integer not null default 0 check (sort_order between 0 and 50),
  -- object-position 百分比，讓 object-cover 在手機版不會裁掉主體。
  focal_x integer not null default 50 check (focal_x between 0 and 100),
  focal_y integer not null default 50 check (focal_y between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references public.profiles (id) on delete set null
);

create index if not exists homepage_media_kind_sort_order_idx
  on public.homepage_media (kind, sort_order);

-- banner / footer / qr_code 每種只能有一列。
create unique index if not exists homepage_media_single_kind_idx
  on public.homepage_media (kind)
  where kind in ('banner', 'footer', 'qr_code');

-- 首頁展示幹部；與 profiles.role 完全無關，只是首頁上的介紹卡。
create table if not exists public.homepage_officers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  role_title text not null
    check (char_length(btrim(role_title)) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 200),
  storage_path text null,
  focal_x integer not null default 50 check (focal_x between 0 and 100),
  focal_y integer not null default 50 check (focal_y between 0 and 100),
  sort_order integer not null default 0 check (sort_order between 0 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references public.profiles (id) on delete set null
);

create index if not exists homepage_officers_sort_order_idx
  on public.homepage_officers (sort_order);

-- ---------------------------------------------------------------------------
-- 2. updated_at 自動維護
-- ---------------------------------------------------------------------------

create or replace function public.set_homepage_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_homepage_content_updated_at on public.homepage_content;
create trigger set_homepage_content_updated_at
before update on public.homepage_content
for each row execute function public.set_homepage_updated_at();

drop trigger if exists set_homepage_media_updated_at on public.homepage_media;
create trigger set_homepage_media_updated_at
before update on public.homepage_media
for each row execute function public.set_homepage_updated_at();

drop trigger if exists set_homepage_officers_updated_at on public.homepage_officers;
create trigger set_homepage_officers_updated_at
before update on public.homepage_officers
for each row execute function public.set_homepage_updated_at();

-- ---------------------------------------------------------------------------
-- 3. 初始文字資料（與原本 lib/siteContent.ts 的內容一致）
-- ---------------------------------------------------------------------------

insert into public.homepage_content (
  hero_title,
  hero_subtitle,
  about_eyebrow,
  about_heading,
  about_paragraphs,
  about_highlights,
  banner_slogan,
  banner_subtitle,
  footer_club_name,
  footer_description
)
select
  '西灣衝浪社',
  '中山大學西子灣旁的衝浪社團。租板、社課、外衝，一起把週末交給海。',
  'ABOUT',
  '關於西灣衝浪社',
  array[
    '我們是國立中山大學的西灣衝浪社。社團就在西子灣旁邊，從教室走到海邊只要幾分鐘，不管是第一次下水還是已經有自己的板子，都可以找到一起衝浪的人。',
    '社團提供社板租借、社課教學與週末外衝，由幹部與板務一起維護器材與安全，讓新手可以安心從頭學起。'
  ],
  '[
    {"title": "社板租借", "description": "線上查看租板時段與剩餘名額，登入後挑選適合自己的板子。"},
    {"title": "社課教學", "description": "從基本觀念、起乘到看浪選浪，由社上教學帶著練習。"},
    {"title": "週末外衝", "description": "一起揪車去外地浪點，跟車、車隊與行程都在網站上安排。"}
  ]'::jsonb,
  '有浪就下水，沒浪就一起等浪',
  '西子灣的浪不大，但我們每個週末都在海邊。',
  '西灣衝浪社',
  '國立中山大學西灣衝浪社，社員以上可登入使用租板、社課與外衝功能。'
where not exists (select 1 from public.homepage_content);

-- ---------------------------------------------------------------------------
-- 4. RLS：所有人可讀，只有 officer / admin 可寫
-- ---------------------------------------------------------------------------

alter table public.homepage_content enable row level security;
alter table public.homepage_media enable row level security;
alter table public.homepage_officers enable row level security;

drop policy if exists "Anyone can read homepage content" on public.homepage_content;
create policy "Anyone can read homepage content"
on public.homepage_content for select
to anon, authenticated
using (true);

drop policy if exists "Staff can insert homepage content" on public.homepage_content;
create policy "Staff can insert homepage content"
on public.homepage_content for insert
to authenticated
with check (public.is_current_profile_staff());

drop policy if exists "Staff can update homepage content" on public.homepage_content;
create policy "Staff can update homepage content"
on public.homepage_content for update
to authenticated
using (public.is_current_profile_staff())
with check (public.is_current_profile_staff());

drop policy if exists "Staff can delete homepage content" on public.homepage_content;
create policy "Staff can delete homepage content"
on public.homepage_content for delete
to authenticated
using (public.is_current_profile_staff());

drop policy if exists "Anyone can read homepage media" on public.homepage_media;
create policy "Anyone can read homepage media"
on public.homepage_media for select
to anon, authenticated
using (true);

drop policy if exists "Staff can insert homepage media" on public.homepage_media;
create policy "Staff can insert homepage media"
on public.homepage_media for insert
to authenticated
with check (public.is_current_profile_staff());

drop policy if exists "Staff can update homepage media" on public.homepage_media;
create policy "Staff can update homepage media"
on public.homepage_media for update
to authenticated
using (public.is_current_profile_staff())
with check (public.is_current_profile_staff());

drop policy if exists "Staff can delete homepage media" on public.homepage_media;
create policy "Staff can delete homepage media"
on public.homepage_media for delete
to authenticated
using (public.is_current_profile_staff());

drop policy if exists "Anyone can read homepage officers" on public.homepage_officers;
create policy "Anyone can read homepage officers"
on public.homepage_officers for select
to anon, authenticated
using (true);

drop policy if exists "Staff can insert homepage officers" on public.homepage_officers;
create policy "Staff can insert homepage officers"
on public.homepage_officers for insert
to authenticated
with check (public.is_current_profile_staff());

drop policy if exists "Staff can update homepage officers" on public.homepage_officers;
create policy "Staff can update homepage officers"
on public.homepage_officers for update
to authenticated
using (public.is_current_profile_staff())
with check (public.is_current_profile_staff());

drop policy if exists "Staff can delete homepage officers" on public.homepage_officers;
create policy "Staff can delete homepage officers"
on public.homepage_officers for delete
to authenticated
using (public.is_current_profile_staff());

grant select on public.homepage_content to anon, authenticated;
grant select on public.homepage_media to anon, authenticated;
grant select on public.homepage_officers to anon, authenticated;
grant insert, update, delete on public.homepage_content to authenticated;
grant insert, update, delete on public.homepage_media to authenticated;
grant insert, update, delete on public.homepage_officers to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 一次性儲存首頁內容（單一交易，避免存到一半的狀態）
-- ---------------------------------------------------------------------------

create or replace function public.save_homepage(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  content_payload jsonb := payload -> 'content';
  hero_payload jsonb := coalesce(payload -> 'hero', '[]'::jsonb);
  officers_payload jsonb := coalesce(payload -> 'officers', '[]'::jsonb);
  hero_item jsonb;
  officer_item jsonb;
  single_kind text;
  single_item jsonb;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception '請先登入。';
  end if;

  -- 後端再次確認權限，不依賴前端判斷。
  if not public.is_current_profile_staff() then
    raise exception '只有幹部與管理員可以編輯首頁。';
  end if;

  if content_payload is null then
    raise exception '缺少首頁文字內容。';
  end if;

  if jsonb_typeof(hero_payload) <> 'array'
    or jsonb_array_length(hero_payload) < 1
    or jsonb_array_length(hero_payload) > 6
  then
    raise exception 'Hero 圖片必須是 1 到 6 張。';
  end if;

  if jsonb_typeof(officers_payload) <> 'array'
    or jsonb_array_length(officers_payload) > 12
  then
    raise exception '首頁展示幹部最多 12 位。';
  end if;

  if not public.homepage_highlights_are_valid(
    coalesce(content_payload -> 'about_highlights', '[]'::jsonb)
  ) then
    raise exception '特色項目格式不正確。';
  end if;

  -- 文字內容（單列 upsert）
  if exists (select 1 from public.homepage_content) then
    update public.homepage_content
    set
      hero_title = content_payload ->> 'hero_title',
      hero_subtitle = coalesce(content_payload ->> 'hero_subtitle', ''),
      about_eyebrow = coalesce(content_payload ->> 'about_eyebrow', ''),
      about_heading = content_payload ->> 'about_heading',
      about_paragraphs = coalesce(
        (
          select array_agg(value order by ordinality)
          from jsonb_array_elements_text(
            coalesce(content_payload -> 'about_paragraphs', '[]'::jsonb)
          ) with ordinality
        ),
        '{}'::text[]
      ),
      about_highlights = coalesce(content_payload -> 'about_highlights', '[]'::jsonb),
      banner_slogan = coalesce(content_payload ->> 'banner_slogan', ''),
      banner_subtitle = coalesce(content_payload ->> 'banner_subtitle', ''),
      footer_club_name = content_payload ->> 'footer_club_name',
      footer_description = coalesce(content_payload ->> 'footer_description', ''),
      footer_instagram_url = nullif(
        coalesce(content_payload ->> 'footer_instagram_url', ''),
        ''
      ),
      footer_admin_contact = nullif(
        coalesce(content_payload ->> 'footer_admin_contact', ''),
        ''
      ),
      updated_by = actor;
  else
    insert into public.homepage_content (
      hero_title,
      hero_subtitle,
      about_eyebrow,
      about_heading,
      about_paragraphs,
      about_highlights,
      banner_slogan,
      banner_subtitle,
      footer_club_name,
      footer_description,
      footer_instagram_url,
      footer_admin_contact,
      updated_by
    )
    values (
      content_payload ->> 'hero_title',
      coalesce(content_payload ->> 'hero_subtitle', ''),
      coalesce(content_payload ->> 'about_eyebrow', ''),
      content_payload ->> 'about_heading',
      coalesce(
        (
          select array_agg(value order by ordinality)
          from jsonb_array_elements_text(
            coalesce(content_payload -> 'about_paragraphs', '[]'::jsonb)
          ) with ordinality
        ),
        '{}'::text[]
      ),
      coalesce(content_payload -> 'about_highlights', '[]'::jsonb),
      coalesce(content_payload ->> 'banner_slogan', ''),
      coalesce(content_payload ->> 'banner_subtitle', ''),
      content_payload ->> 'footer_club_name',
      coalesce(content_payload ->> 'footer_description', ''),
      nullif(coalesce(content_payload ->> 'footer_instagram_url', ''), ''),
      nullif(coalesce(content_payload ->> 'footer_admin_contact', ''), ''),
      actor
    );
  end if;

  -- Hero 圖片：整組取代
  delete from public.homepage_media where kind = 'hero';

  for hero_item in select * from jsonb_array_elements(hero_payload)
  loop
    insert into public.homepage_media (
      kind, storage_path, alt, sort_order, focal_x, focal_y, created_by
    )
    values (
      'hero',
      hero_item ->> 'storage_path',
      coalesce(hero_item ->> 'alt', ''),
      coalesce((hero_item ->> 'sort_order')::integer, 0),
      coalesce((hero_item ->> 'focal_x')::integer, 50),
      coalesce((hero_item ->> 'focal_y')::integer, 50),
      actor
    );
  end loop;

  -- banner / footer / qr_code：有值就取代，null 代表移除
  foreach single_kind in array array['banner', 'footer', 'qr_code']
  loop
    single_item := payload -> single_kind;

    delete from public.homepage_media where kind = single_kind;

    if single_item is not null and jsonb_typeof(single_item) = 'object' then
      insert into public.homepage_media (
        kind, storage_path, alt, sort_order, focal_x, focal_y, created_by
      )
      values (
        single_kind,
        single_item ->> 'storage_path',
        coalesce(single_item ->> 'alt', ''),
        0,
        coalesce((single_item ->> 'focal_x')::integer, 50),
        coalesce((single_item ->> 'focal_y')::integer, 50),
        actor
      );
    end if;
  end loop;

  -- 首頁展示幹部：整組取代（不會動到 profiles.role）
  delete from public.homepage_officers;

  for officer_item in select * from jsonb_array_elements(officers_payload)
  loop
    insert into public.homepage_officers (
      display_name, role_title, bio, storage_path,
      focal_x, focal_y, sort_order, created_by
    )
    values (
      officer_item ->> 'display_name',
      officer_item ->> 'role_title',
      coalesce(officer_item ->> 'bio', ''),
      nullif(coalesce(officer_item ->> 'storage_path', ''), ''),
      coalesce((officer_item ->> 'focal_x')::integer, 50),
      coalesce((officer_item ->> 'focal_y')::integer, 50),
      coalesce((officer_item ->> 'sort_order')::integer, 0),
      actor
    );
  end loop;
end;
$$;

revoke all on function public.save_homepage(jsonb) from public;
grant execute on function public.save_homepage(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Storage：homepage-images（公開讀取，只有 officer / admin 可寫）
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'homepage-images',
  'homepage-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read homepage image files" on storage.objects;
create policy "Anyone can read homepage image files"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'homepage-images');

drop policy if exists "Staff can upload homepage image files" on storage.objects;
create policy "Staff can upload homepage image files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'homepage-images'
  and public.is_current_profile_staff()
);

drop policy if exists "Staff can update homepage image files" on storage.objects;
create policy "Staff can update homepage image files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'homepage-images'
  and public.is_current_profile_staff()
)
with check (
  bucket_id = 'homepage-images'
  and public.is_current_profile_staff()
);

drop policy if exists "Staff can delete homepage image files" on storage.objects;
create policy "Staff can delete homepage image files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'homepage-images'
  and public.is_current_profile_staff()
);
