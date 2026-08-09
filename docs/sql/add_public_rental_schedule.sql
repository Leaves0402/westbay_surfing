-- 公開租板時段摘要（未登入者與待審核身分可看）。
-- 需先執行 add_rental_surfboard_selection_and_expiration.sql。此檔可重複安全執行。
--
-- 設計原則：
-- 1. 不開放 rental_slots / rental_registrations 的 SELECT 給 anon。
-- 2. 只用一個 SECURITY DEFINER 函式回傳「非個資」欄位與人數統計。
-- 3. 固定 search_path，並且只 grant execute 給 anon 與 authenticated。
-- 4. 絕對不回傳 user_id、姓名、學號、surfboard_id、繳費資料或負責人 ID（board_manager_id）。
-- 5. note（備註）也不回傳，避免幹部在備註寫入的個人資訊外流。

create or replace function public.get_public_rental_schedule()
returns table (
  id uuid,
  rental_date date,
  start_time time,
  end_time time,
  capacity integer,
  min_surf_level text,
  is_open boolean,
  registration_count integer,
  remaining_capacity integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    slot.id,
    slot.rental_date,
    slot.start_time,
    slot.end_time,
    slot.capacity,
    slot.min_surf_level,
    slot.is_open,
    count(registration.id)::integer as registration_count,
    greatest(slot.capacity - count(registration.id), 0)::integer
      as remaining_capacity
  from public.rental_slots slot
  left join public.rental_registrations registration
    on registration.rental_slot_id = slot.id
  group by
    slot.id,
    slot.rental_date,
    slot.start_time,
    slot.end_time,
    slot.capacity,
    slot.min_surf_level,
    slot.is_open
  order by slot.rental_date asc, slot.start_time asc;
$$;

-- security definer 函式預設會 grant execute 給 PUBLIC，這裡收回後只給需要的角色。
revoke all on function public.get_public_rental_schedule() from public;
grant execute on function public.get_public_rental_schedule() to anon;
grant execute on function public.get_public_rental_schedule() to authenticated;
