-- Operations dashboard: staff-only aggregates and transactional board storage.
begin;
create schema if not exists operations_private;
revoke all on schema operations_private from public, anon;
grant usage on schema operations_private to authenticated;

create table public.board_storage_settings (
  id boolean primary key default true check (id),
  capacity integer not null default 20 check (capacity between 0 and 10000),
  updated_at timestamptz not null default now()
);
insert into public.board_storage_settings(id) values (true);

create table public.board_storage_leases (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles(id),
  renter_type text not null check (renter_type in ('member','guest')),
  renter_name text not null check (length(btrim(renter_name)) between 1 and 100),
  start_on date not null,
  end_on date not null check (end_on > start_on),
  annual_fee integer not null check (annual_fee in (1000,1500)),
  is_paid boolean not null default false,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id),
  ended_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  check ((renter_type = 'member' and member_id is not null and annual_fee = 1000)
      or (renter_type = 'guest' and member_id is null and annual_fee = 1500)),
  check ((is_paid and paid_at is not null and paid_by is not null)
      or (not is_paid and paid_at is null and paid_by is null))
);
create unique index board_storage_one_active_member
  on public.board_storage_leases(member_id) where ended_at is null and member_id is not null;
create index board_storage_active on public.board_storage_leases(created_at desc) where ended_at is null;
create index board_storage_paid_by on public.board_storage_leases(paid_by);
create index board_storage_created_by on public.board_storage_leases(created_by);
create index board_storage_updated_by on public.board_storage_leases(updated_by);

alter table public.board_storage_settings enable row level security;
alter table public.board_storage_leases enable row level security;
revoke all on public.board_storage_settings, public.board_storage_leases from public, anon, authenticated;
grant select on public.board_storage_settings, public.board_storage_leases to authenticated;
create policy "Officers read storage settings" on public.board_storage_settings for select to authenticated
using ((select public.current_profile_role()) in ('officer','admin'));
create policy "Officers read storage leases" on public.board_storage_leases for select to authenticated
using ((select public.current_profile_role()) in ('officer','admin'));

-- One guarded, operations_private write boundary. No direct client INSERT/UPDATE/DELETE.
-- Lock the singleton for every mutation so simultaneous adds cannot overbook.
create or replace function operations_private.manage_board_storage(
  p_action text, p_target_id uuid, p_member_id uuid, p_guest_name text,
  p_start_on date, p_delta integer, p_paid boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  occupied integer;
  slots integer;
  person_name text;
  lease_id uuid;
  begins date := coalesce(p_start_on, (now() at time zone 'Asia/Taipei')::date);
begin
  if actor is null or coalesce(public.current_profile_role(),'pending') not in ('officer','admin') then
    raise exception '只有幹部與管理員可以管理板位。' using errcode = '42501';
  end if;
  select capacity into slots from public.board_storage_settings where id = true for update;
  select count(*) into occupied from public.board_storage_leases where ended_at is null;
  if p_action = 'capacity' then
    if p_delta is null or p_delta not in (-1,1) then raise exception '每次只能增減一個板位。'; end if;
    if slots + p_delta < occupied then raise exception '總板位不能少於已租出板位。'; end if;
    if slots + p_delta < 0 or slots + p_delta > 10000 then raise exception '板位數超出可設定範圍。'; end if;
    update public.board_storage_settings set capacity = slots + p_delta, updated_at = now() where id = true;
    return null;
  elsif p_action = 'add' then
    if occupied >= slots then raise exception '板位已滿，請先增加容量或辦理退租。'; end if;
    if begins > (now() at time zone 'Asia/Taipei')::date then raise exception '起租日期不能晚於今天。'; end if;
    if p_member_id is not null then
      select nullif(btrim(full_name),'') into person_name from public.profiles
        where id = p_member_id and role::text in ('member','board_manager','officer','admin');
      if person_name is null then raise exception '請選擇已完成姓名資料的正式社員。'; end if;
      if exists (select 1 from public.board_storage_leases where member_id = p_member_id and ended_at is null)
        then raise exception '這位社員已有租用中的板位。'; end if;
    else
      person_name := nullif(btrim(p_guest_name),'');
      if person_name is null or length(person_name) > 100 then raise exception '請填寫非社員姓名（最多 100 字）。'; end if;
      if exists (select 1 from public.board_storage_leases where renter_type = 'guest' and renter_name = person_name and ended_at is null)
        then raise exception '已有同名非社員租用板位，請在姓名加上可辨識的備註。'; end if;
    end if;
    insert into public.board_storage_leases(member_id,renter_type,renter_name,start_on,end_on,annual_fee,created_by,updated_by)
    values(p_member_id,case when p_member_id is null then 'guest' else 'member' end,person_name,begins,
      (begins + interval '1 year')::date,case when p_member_id is null then 1500 else 1000 end,actor,actor)
    returning id into lease_id;
    return lease_id;
  elsif p_action = 'end' then
    update public.board_storage_leases set ended_at = now(),updated_by = actor,updated_at = now()
      where id = p_target_id and ended_at is null returning id into lease_id;
  elsif p_action = 'payment' then
    if p_paid is null then raise exception '請指定繳費狀態。'; end if;
    update public.board_storage_leases set is_paid = p_paid,
      paid_at = case when p_paid then coalesce(paid_at,now()) else null end,
      paid_by = case when p_paid then coalesce(paid_by,actor) else null end,
      updated_by = actor,updated_at = now()
      where id = p_target_id returning id into lease_id;
  else
    raise exception '不支援的板位操作。';
  end if;
  if lease_id is null then raise exception '資料已變更，請重新整理後再試。'; end if;
  return lease_id;
end;
$$;
revoke all on function operations_private.manage_board_storage(text,uuid,uuid,text,date,integer,boolean) from public,anon,authenticated;
grant execute on function operations_private.manage_board_storage(text,uuid,uuid,text,date,integer,boolean) to authenticated;

create or replace function public.manage_board_storage(
  action text, target_id uuid default null, member_id uuid default null,
  guest_name text default null, start_on date default null, delta integer default 0, paid boolean default null
) returns uuid language sql security invoker set search_path = '' as $$
  select operations_private.manage_board_storage(action,target_id,member_id,guest_name,start_on,delta,paid);
$$;
revoke all on function public.manage_board_storage(text,uuid,uuid,text,date,integer,boolean) from public,anon,authenticated;
grant execute on function public.manage_board_storage(text,uuid,uuid,text,date,integer,boolean) to authenticated;

-- Aggregate in Postgres: historical totals never depend on the REST row limit.
create or replace function public.get_operations_dashboard(target_month date default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Taipei')::date;
  month_start date := date_trunc('month',coalesce(target_month,today))::date;
  through_date date;
  result jsonb;
begin
  if auth.uid() is null or coalesce(public.current_profile_role(),'pending') not in ('officer','admin') then
    raise exception '只有幹部與管理員可以查看儀錶板。' using errcode = '42501';
  end if;
  if month_start > today then raise exception '請選擇本月或之前的月份。'; end if;
  through_date := least(today,(month_start + interval '1 month - 1 day')::date);
  with monthly as (
    select r.* from public.rental_registrations r join public.rental_slots s on s.id = r.rental_slot_id
    where s.rental_date between month_start and through_date
  ), collected as (
    select paid_by, sum(rental_fee)::bigint as amount from public.rental_registrations
    where is_paid group by paid_by
  ), collectors as (
    select p.id,coalesce(nullif(p.full_name,''),'未填姓名') as name,coalesce(c.amount,0) as amount
      from public.profiles p left join collected c on c.paid_by = p.id
      where p.role::text in ('board_manager','officer','admin') or c.amount is not null
    union all select null::uuid,'未記錄收款人',amount from collected where paid_by is null
  ), daily as (
    select d::date as day,count(r.id)::integer as count
      from generate_series(month_start::timestamp,through_date::timestamp,interval '1 day') d
      left join public.rental_slots s on s.rental_date = d::date
      left join public.rental_registrations r on r.rental_slot_id = s.id
      group by d order by d
  )
  select jsonb_build_object(
    'today',today,'month',month_start,'through',through_date,
    'income',coalesce((select sum(amount) from collected),0),
    'collectors',coalesce((select jsonb_agg(c order by amount desc,name) from collectors c),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(d order by day) from daily d),'[]'::jsonb),
    'monthly',(select jsonb_build_object('total',count(*),
      'members',count(*) filter(where renter_type = 'member'),
      'guests',count(*) filter(where renter_type = 'guest'),
      'unpaid',count(*) filter(where not is_paid)) from monthly),
    'storage',jsonb_build_object(
      'capacity',(select capacity from public.board_storage_settings where id = true),
      'leases',coalesce((select jsonb_agg(jsonb_build_object(
        'id',l.id,'member_id',l.member_id,'name',l.renter_name,'type',l.renter_type,
        'start_on',l.start_on,'end_on',l.end_on,'is_paid',l.is_paid,'paid_at',l.paid_at,'ended_at',l.ended_at
      ) order by l.created_at desc) from public.board_storage_leases l
        where l.ended_at is null or not l.is_paid),'[]'::jsonb)
    )
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_operations_dashboard(date) from public,anon,authenticated;
grant execute on function public.get_operations_dashboard(date) to authenticated;

create or replace function public.search_board_storage_members(search_term text)
returns table(id uuid,full_name text,student_id text)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(public.current_profile_role(),'pending') not in ('officer','admin') then
    raise exception '只有幹部與管理員可以搜尋板位社員。' using errcode = '42501';
  end if;
  if length(btrim(search_term)) < 1 then return; end if;
  return query select p.id,p.full_name,p.student_id from public.profiles p
    where p.role::text in ('member','board_manager','officer','admin')
      and position(lower(btrim(search_term)) in lower(coalesce(p.full_name,''))) > 0
    order by p.full_name,p.id limit 20;
end;
$$;
revoke all on function public.search_board_storage_members(text) from public,anon,authenticated;
grant execute on function public.search_board_storage_members(text) to authenticated;
commit;
