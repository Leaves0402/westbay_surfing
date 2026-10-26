-- Legacy paid rentals have rental_fee = 0. Infer them using the club's current rates.
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
    select paid_by, sum(case when rental_fee > 0 then rental_fee when renter_type = 'guest' then 200 else 50 end)::bigint as amount from public.rental_registrations
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