-- 衝浪板欄位調整：
-- 1. 移除使用程度（usage_level）。
-- 2. 適合程度改為與社員衝浪程度相同的等級（初階、中階、中進階、進階）。
-- 3. 浮力可留空（null 代表未知）。
-- 4. 長度改為呎吋文字格式（例如 5'4），可留空（null 代表未知）。
-- 執行前請先執行 add_surfboard_management.sql。此檔可重複執行。

-- ---------------------------------------------------------------------------
-- 1. 移除使用程度（欄位上的 check constraint 會一併移除）
-- ---------------------------------------------------------------------------

alter table public.surfboards
drop column if exists usage_level;

-- ---------------------------------------------------------------------------
-- 2. 先移除 suitability_level、buoyancy、length 三個欄位上的舊 check constraint。
-- 以 conkey 精準比對欄位，避免誤刪其他欄位（例如 name）的 constraint。
-- ---------------------------------------------------------------------------

do $$
declare
  target_constraint text;
begin
  for target_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = any (con.conkey)
    where nsp.nspname = 'public'
      and rel.relname = 'surfboards'
      and con.contype = 'c'
      and att.attname in ('suitability_level', 'buoyancy', 'length')
  loop
    execute format(
      'alter table public.surfboards drop constraint %I',
      target_constraint
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. 適合程度：初中階 → 初階、中高階 → 中進階
-- ---------------------------------------------------------------------------

update public.surfboards
set suitability_level = '初階'
where suitability_level = '初中階';

update public.surfboards
set suitability_level = '中進階'
where suitability_level in ('中高階', '高階');

alter table public.surfboards
drop constraint if exists surfboards_suitability_level_check;

alter table public.surfboards
add constraint surfboards_suitability_level_check
check (suitability_level in ('初階', '中階', '中進階', '進階'));

-- ---------------------------------------------------------------------------
-- 4. 浮力可留空
-- ---------------------------------------------------------------------------

alter table public.surfboards
alter column buoyancy drop not null;

alter table public.surfboards
drop constraint if exists surfboards_buoyancy_check;

alter table public.surfboards
add constraint surfboards_buoyancy_check
check (buoyancy is null or (buoyancy > 0 and buoyancy <= 999));

-- ---------------------------------------------------------------------------
-- 5. 長度改為呎吋文字（例如 5'4）
-- 舊資料為 numeric，衝浪板慣例上 9.2 代表 9 呎 2 吋，因此小數位轉換為吋。
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'surfboards'
      and column_name = 'length'
      and data_type = 'numeric'
  ) then
    alter table public.surfboards
    alter column length type text
    using (
      case
        when length is null then null
        when length = trunc(length) then trunc(length)::integer::text
        else trunc(length)::integer::text
          || ''''
          || round((length - trunc(length)) * 10)::integer::text
      end
    );
  end if;
end
$$;

alter table public.surfboards
alter column length drop not null;

alter table public.surfboards
drop constraint if exists surfboards_length_check;

alter table public.surfboards
add constraint surfboards_length_check
check (length is null or length ~ '^([1-9]|1[0-9]|20)(''([0-9]|1[01]))?$');
