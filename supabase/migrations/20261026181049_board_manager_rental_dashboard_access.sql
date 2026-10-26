-- Board managers may read rental operations; storage remains officer/admin only.
CREATE OR REPLACE FUNCTION public.get_operations_dashboard(target_month date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  today date := (now() at time zone 'Asia/Taipei')::date;
  month_start date := date_trunc('month',coalesce(target_month,today))::date;
  academic_start date := make_date(extract(year from month_start)::integer - case when extract(month from month_start) < 9 then 1 else 0 end,9,1);
  through_date date;
  result jsonb;
  viewer_role text := public.current_profile_role();
begin
  if auth.uid() is null or coalesce(viewer_role,'pending') not in ('board_manager','officer','admin') then
    raise exception '只有板務、幹部與管理員可以查看儀錶板。' using errcode = '42501';
  end if;
  if month_start > today then raise exception '請選擇本月或之前的月份。'; end if;
  through_date := least(today,(month_start + interval '1 month - 1 day')::date);
  with monthly as (
    select r.* from public.rental_registrations r join public.rental_slots s on s.id = r.rental_slot_id
    where s.rental_date between month_start and through_date
  ), academic_months as (
    select m::date as month,
      case when m::date > date_trunc('month',today)::date then null else count(r.id)::integer end as count
      from generate_series(academic_start::timestamp,(academic_start + interval '9 months')::timestamp,interval '1 month') m
      left join public.rental_slots s on s.rental_date >= m::date
        and s.rental_date < (m + interval '1 month')::date and s.rental_date <= today
      left join public.rental_registrations r on r.rental_slot_id = s.id
      group by m order by m
  ), collected as (
    select paid_by, sum(case when rental_fee > 0 then rental_fee when renter_type = 'guest' then 200 else 50 end)::bigint as amount from public.rental_registrations
    where is_paid group by paid_by
  ), collectors as (
    select p.id,coalesce(nullif(p.full_name,''),'未填姓名') as name,p.role::text as role,coalesce(c.amount,0) as amount
      from public.profiles p left join collected c on c.paid_by = p.id
      where p.role::text in ('board_manager','officer','admin') or c.amount is not null
    union all select null::uuid,'未記錄收款人',null::text,amount from collected where paid_by is null
  ), slot_attendance as (
    select s.board_manager_id,p.role::text as role,count(*)::integer as count
      from public.rental_slots s
      left join public.profiles p on p.id = s.board_manager_id
      where s.rental_date between month_start and through_date
      group by s.board_manager_id,p.role
  ), attendance as (
    select p.id::text as id,coalesce(nullif(p.full_name,''),'未填姓名') as name,
      coalesce(a.count,0)::integer as count,0 as sort_order
      from public.profiles p left join slot_attendance a on a.board_manager_id = p.id
      where p.role::text = 'board_manager'
    union all
    select 'staff','幹部',coalesce(sum(count),0)::integer,1
      from slot_attendance where role in ('officer','admin')
    union all
    select 'unassigned','未指定',sum(count)::integer,2
      from slot_attendance where role is null or role not in ('board_manager','officer','admin')
      having sum(count) > 0
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
    'collectors',coalesce((select jsonb_agg(c order by case when role = 'board_manager' then 0 when role in ('officer','admin') then 1 else 2 end,amount desc,name) from collectors c),'[]'::jsonb),
    'attendance',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'count',a.count) order by a.sort_order,a.count desc,a.name) from attendance a),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(d order by day) from daily d),'[]'::jsonb),
    'academic_months',coalesce((select jsonb_agg(a order by month) from academic_months a),'[]'::jsonb),
    'monthly',(select jsonb_build_object('total',count(*),
      'members',count(*) filter(where renter_type = 'member'),
      'guests',count(*) filter(where renter_type = 'guest'),
      'unpaid',count(*) filter(where not is_paid)) from monthly),
    'storage',case when viewer_role in ('officer','admin') then jsonb_build_object(
      'capacity',(select capacity from public.board_storage_settings where id = true),
      'leases',coalesce((select jsonb_agg(jsonb_build_object(
        'id',l.id,'member_id',l.member_id,'name',l.renter_name,'type',l.renter_type,
        'start_on',l.start_on,'end_on',l.end_on,'is_paid',l.is_paid,'paid_at',l.paid_at,'ended_at',l.ended_at
      ) order by l.created_at desc) from public.board_storage_leases l
        where l.ended_at is null or not l.is_paid),'[]'::jsonb)
    ) else null::jsonb end
  ) into result;
  return result;
end;
$function$;
