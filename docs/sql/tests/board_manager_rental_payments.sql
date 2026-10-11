-- Run against an existing database with an ended, unpaid member rental and
-- at least one profile in each role. All payment changes are rolled back.
begin;

do $tests$
declare
  registration_id uuid;
  actor_id uuid;
  actor_role text;
  affected integer;
begin
  select r.id into registration_id
  from public.rental_registrations r
  join public.rental_slots s on s.id = r.rental_slot_id
  where not r.is_paid and r.renter_type = 'member'
    and (s.rental_date + s.end_time) at time zone 'Asia/Taipei' < now()
  limit 1;
  if registration_id is null then
    raise exception 'Test requires an ended, unpaid member rental.';
  end if;

  if has_function_privilege('anon', 'public.mark_rental_registration_paid(uuid)', 'execute') then
    raise exception 'Anonymous callers must not have payment RPC access.';
  end if;

  foreach actor_role in array array['pending', 'member', 'board_manager', 'officer', 'admin'] loop
    select id into actor_id from public.profiles where role = actor_role limit 1;
    if actor_id is null then
      raise exception 'Missing test role: %', actor_role;
    end if;
    perform set_config('request.jwt.claim.sub', actor_id::text, true);
    set local role authenticated;

    -- Each case rolls back its writes, including guest privacy cleanup.
    begin
      if actor_role in ('pending', 'member') then
        begin
          perform public.mark_rental_registration_paid(registration_id);
          raise exception 'Unauthorized role could mark paid: %', actor_role;
        exception when raise_exception then
          if sqlerrm <> '只有板務、幹部與管理員可以標記補繳。' then raise; end if;
        end;
      else
        if not exists (select 1 from public.rental_registrations where id = registration_id) then
          raise exception 'Staff cannot view ended rental.';
        end if;
        perform public.mark_rental_registration_paid(registration_id);
        if not exists (
          select 1 from public.rental_registrations
          where id = registration_id and is_paid and paid_by = actor_id and paid_at is not null
        ) then
          raise exception 'Paid status or audit fields were not saved for %', actor_role;
        end if;

        begin
          perform public.mark_rental_registration_paid(registration_id);
          raise exception 'Duplicate payment should be rejected.';
        exception when raise_exception then
          if sqlerrm <> '找不到未繳費紀錄。' then raise; end if;
        end;

        update public.rental_registrations set is_paid = false where id = registration_id;
        get diagnostics affected = row_count;
        if actor_role = 'board_manager' then
          if affected <> 0 then raise exception 'Board manager could undo payment.'; end if;
        elsif affected <> 1 or not exists (
          select 1 from public.rental_registrations
          where id = registration_id and not is_paid and paid_at is null and paid_by is null
        ) then
          raise exception 'Officer/admin undo no longer works.';
        end if;
      end if;
      raise exception '__rollback_payment_test_case__';
    exception when raise_exception then
      if sqlerrm <> '__rollback_payment_test_case__' then raise; end if;
    end;
    reset role;
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  begin
    perform public.mark_rental_registration_paid(registration_id);
    raise exception 'Missing identity should be rejected.';
  exception when raise_exception then
    if sqlerrm <> '請先登入。' then raise; end if;
  end;
  reset role;
end;
$tests$;

rollback;
select 'PASS: ended rental visibility, paid marking, audit fields, duplicate protection, role restrictions, undo and missing identity; all writes rolled back.' as result;
