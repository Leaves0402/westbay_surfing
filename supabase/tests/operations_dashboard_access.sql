-- Run as the project database owner against a database with seeded role profiles.
-- Read-only regression checks: no profile or rental/storage records are changed.
begin;
do $tests$
declare
  target_role text;
  target_user uuid;
  payload jsonb;
  row_count integer;
begin
  if has_function_privilege('anon','public.get_operations_dashboard(date)','execute') then
    raise exception 'Anonymous callers can execute the dashboard';
  end if;
  foreach target_role in array array['board_manager','officer','admin','member','pending'] loop
    select id into target_user from public.profiles where role::text = target_role order by id limit 1;
    if target_user is null then raise exception 'Missing seeded profile for role %',target_role; end if;
    perform set_config('request.jwt.claim.sub',target_user::text,true);
    execute 'set local role authenticated';
    if target_role in ('member','pending') then
      begin
        perform public.get_operations_dashboard();
        raise exception 'Dashboard unexpectedly allowed for %',target_role;
      exception when insufficient_privilege then null;
      end;
    else
      payload := public.get_operations_dashboard();
      if not (payload ?& array['income','collectors','daily','attendance','academic_months','monthly']) then
        raise exception 'Rental metrics missing for %',target_role;
      end if;
      if target_role = 'board_manager' then
        if payload->'storage' is distinct from 'null'::jsonb then raise exception 'Board manager received storage data'; end if;
        select count(*) into row_count from public.board_storage_settings;
        if row_count <> 0 then raise exception 'Board manager can read storage settings'; end if;
        select count(*) into row_count from public.board_storage_leases;
        if row_count <> 0 then raise exception 'Board manager can read storage leases'; end if;
        begin
          perform public.search_board_storage_members('test');
          raise exception 'Board manager can search storage members';
        exception when insufficient_privilege then null;
        end;
        begin
          perform public.manage_board_storage(action => 'capacity',delta => 0);
          raise exception 'Board manager can invoke storage mutations';
        exception when insufficient_privilege then null;
        end;
      elsif jsonb_typeof(payload->'storage') is distinct from 'object' then
        raise exception 'Storage data missing for %',target_role;
      end if;
    end if;
    execute 'reset role';
  end loop;
end;
$tests$;
rollback;
