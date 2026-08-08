-- 租板挑選衝浪板 + 時段過期防護。
-- 需先執行 add_rental_payment_tracking.sql、add_surfboard_management.sql、
-- update_surfboard_fields.sql。此檔可重複安全執行。
--
-- 內容：
-- 1. rental_registrations.surfboard_id（外鍵、索引、同時段不可重複選同一張板）。
-- 2. 禁止新增／改到過去的租板時段，並禁止把已過期時段重新開放。
-- 3. 衝浪程度等級比較函式。
-- 4. 更新 register_rental_slot RPC，登記時必須傳入 target_surfboard_id 並完整驗證。
-- 5. surfboards、surfboard_images 與 Storage 的 SELECT policy 放寬給有租板權限的正式身分，
--    INSERT／UPDATE／DELETE 與圖片上傳、刪除仍只允許 officer、admin。
--
-- 時間判斷一律使用 Asia/Taipei（透過既有的 public.rental_slot_has_started）。

-- ---------------------------------------------------------------------------
-- 1. 登記資料加上所選衝浪板
-- ---------------------------------------------------------------------------

alter table public.rental_registrations
add column if not exists surfboard_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_registrations_surfboard_id_fkey'
      and conrelid = 'public.rental_registrations'::regclass
  ) then
    alter table public.rental_registrations
    add constraint rental_registrations_surfboard_id_fkey
    foreign key (surfboard_id)
    references public.surfboards (id)
    on delete set null;
  end if;
end
$$;

create index if not exists rental_registrations_surfboard_id_idx
  on public.rental_registrations (surfboard_id);

-- 同一個租板時段中，同一張實體衝浪板只能被一個人選擇。
-- 部分唯一索引可讓舊資料（surfboard_id 為 null）保持相容。
create unique index if not exists rental_registrations_slot_surfboard_unique_idx
  on public.rental_registrations (rental_slot_id, surfboard_id)
  where surfboard_id is not null;

-- ---------------------------------------------------------------------------
-- 2. 過去時段防護
-- ---------------------------------------------------------------------------

create or replace function public.enforce_rental_slot_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.rental_slot_has_started(new.rental_date, new.start_time::time) then
      raise exception '租板開始時間必須晚於目前時間。';
    end if;

    return new;
  end if;

  -- 只擋「把時間改到過去」與「把已過期時段重新開放」，
  -- 其他欄位的更新（例如負責人、備註）不受影響。
  if (new.rental_date, new.start_time) is distinct from
     (old.rental_date, old.start_time)
    and public.rental_slot_has_started(new.rental_date, new.start_time::time)
  then
    raise exception '租板開始時間必須晚於目前時間。';
  end if;

  if old.is_open = false
    and new.is_open = true
    and public.rental_slot_has_started(new.rental_date, new.start_time::time)
  then
    raise exception '此租板時段已過期，無法重新開放。';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_rental_slot_schedule on public.rental_slots;

create trigger enforce_rental_slot_schedule
before insert or update on public.rental_slots
for each row
execute function public.enforce_rental_slot_schedule();

-- ---------------------------------------------------------------------------
-- 3. 衝浪程度等級比較
-- ---------------------------------------------------------------------------

-- 專案資料庫可能已經有 public.surf_level_rank(text)（參數名為 level）。
-- create or replace 無法改參數名稱，也不應覆蓋既有函式（可能有其他功能依賴），
-- 因此只在函式不存在時才建立。
do $$
begin
  if to_regprocedure('public.surf_level_rank(text)') is null then
    create function public.surf_level_rank(level text)
    returns integer
    language sql
    immutable
    as $fn$
      select case level
        when '初階' then 1
        when '中階' then 2
        when '中進階' then 3
        when '進階' then 4
        else 0
      end;
    $fn$;
  end if;
end
$$;

-- 確認等級排序符合預期，避免既有函式語意不同導致程度判斷錯誤。
do $$
begin
  if not (
    public.surf_level_rank('初階') < public.surf_level_rank('中階')
    and public.surf_level_rank('中階') < public.surf_level_rank('中進階')
    and public.surf_level_rank('中進階') < public.surf_level_rank('進階')
  ) then
    raise exception
      'public.surf_level_rank(text) 的等級排序不符合預期（初階 < 中階 < 中進階 < 進階），請確認函式定義。';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. 登記租板 RPC：必須挑選衝浪板
-- ---------------------------------------------------------------------------

-- 移除舊的單參數版本，避免有人繞過挑板流程直接登記。
drop function if exists public.register_rental_slot(uuid);

create or replace function public.register_rental_slot(
  target_slot_id uuid,
  target_surfboard_id uuid
)
returns public.rental_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_row public.rental_slots%rowtype;
  board_row public.surfboards%rowtype;
  actor_surf_level text;
  unpaid_count integer;
  current_count integer;
  new_registration public.rental_registrations;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if coalesce(public.current_profile_role(), 'pending') not in (
    'member',
    'board_manager',
    'officer',
    'admin'
  ) then
    raise exception '目前身份尚未開通租板權限。';
  end if;

  if target_surfboard_id is null then
    raise exception '請先挑選一張衝浪板。';
  end if;

  -- 鎖定時段，讓同時登記的請求依序檢查名額與選板。
  select *
  into slot_row
  from public.rental_slots
  where id = target_slot_id
  for update;

  if slot_row.id is null then
    raise exception '找不到租板時段。';
  end if;

  if public.rental_slot_has_started(slot_row.rental_date, slot_row.start_time::time) then
    raise exception '此租板時段已過期，無法登記';
  end if;

  if not slot_row.is_open then
    raise exception '這個租板時段目前未開放。';
  end if;

  select count(*)::integer
  into current_count
  from public.rental_registrations
  where rental_slot_id = target_slot_id;

  if current_count >= slot_row.capacity then
    raise exception '這個租板時段已額滿。';
  end if;

  if exists (
    select 1
    from public.rental_registrations
    where rental_slot_id = target_slot_id
      and user_id = auth.uid()
  ) then
    raise exception '你已經登記此時段。';
  end if;

  unpaid_count := public.get_my_unpaid_rental_count();
  if unpaid_count >= 2 then
    raise exception '您目前租板未繳費 %/2，請先完成補繳後再租板', unpaid_count;
  end if;

  select surf_level
  into actor_surf_level
  from public.profiles
  where id = auth.uid();

  if slot_row.min_surf_level is not null
    and public.surf_level_rank(actor_surf_level)
        < public.surf_level_rank(slot_row.min_surf_level)
  then
    raise exception '你的衝浪程度尚未符合此時段最低要求。';
  end if;

  select *
  into board_row
  from public.surfboards
  where id = target_surfboard_id;

  if board_row.id is null then
    raise exception '找不到這張衝浪板。';
  end if;

  if public.surf_level_rank(actor_surf_level)
     < public.surf_level_rank(board_row.suitability_level)
  then
    raise exception '你的衝浪程度尚未達到此板子的適合程度';
  end if;

  if exists (
    select 1
    from public.rental_registrations
    where rental_slot_id = target_slot_id
      and surfboard_id = target_surfboard_id
  ) then
    raise exception '此時段已被選擇';
  end if;

  begin
    insert into public.rental_registrations (
      rental_slot_id,
      user_id,
      surfboard_id,
      is_paid
    )
    values (
      target_slot_id,
      auth.uid(),
      target_surfboard_id,
      false
    )
    returning * into new_registration;
  exception
    when unique_violation then
      -- 兩人同時選同一張板時，後送出的請求會落到這裡。
      raise exception '此時段已被選擇';
  end;

  return new_registration;
end;
$$;

grant execute on function public.surf_level_rank(text) to authenticated;
grant execute on function public.register_rental_slot(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 衝浪板讀取權限放寬給有租板權限的正式身分
--    （新增、修改、刪除與圖片上傳仍只允許 officer、admin）
-- ---------------------------------------------------------------------------

drop policy if exists "Staff can read surfboards" on public.surfboards;
drop policy if exists "Members can read surfboards" on public.surfboards;
create policy "Members can read surfboards"
on public.surfboards for select to authenticated
using (public.is_current_profile_member());

drop policy if exists "Staff can read surfboard images" on public.surfboard_images;
drop policy if exists "Members can read surfboard images" on public.surfboard_images;
create policy "Members can read surfboard images"
on public.surfboard_images for select to authenticated
using (public.is_current_profile_member());

drop policy if exists "Staff can read surfboard image files" on storage.objects;
drop policy if exists "Members can read surfboard image files" on storage.objects;
create policy "Members can read surfboard image files"
on storage.objects for select to authenticated
using (
  bucket_id = 'surfboard-images'
  and public.is_current_profile_member()
);
