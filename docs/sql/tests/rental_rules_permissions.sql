begin;
do $$
declare
  actor record;
  changed integer;
  denied boolean;
begin
  insert into public.rental_rules (id, content) values (1, 'Rental rules permission test')
  on conflict (id) do update set content = excluded.content;
  execute 'set local role anon';
  perform content from public.rental_rules where id = 1;
  if not found then raise exception 'Anonymous read failed'; end if;
  denied := false;
  begin
    update public.rental_rules set content = 'Unauthorized';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Anonymous write unexpectedly allowed'; end if;
  execute 'reset role';
  for actor in select distinct on (role) id, role from public.profiles
    where role in ('pending', 'member', 'board_manager', 'officer', 'admin') order by role, id
  loop
    perform set_config('request.jwt.claim.sub', actor.id::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', actor.id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    update public.rental_rules set content = 'Updated rules' where id = 1;
    get diagnostics changed = row_count;
    if changed <> (case when actor.role in ('officer','admin') then 1 else 0 end) then
      raise exception 'Unexpected update permission for %', actor.role;
    end if;
    denied := false;
    begin
      insert into public.rental_rules (id, content) values (1, 'Published rules')
      on conflict (id) do update set content = excluded.content;
    exception when insufficient_privilege then denied := true;
    end;
    if denied <> (actor.role not in ('officer','admin')) then
      raise exception 'Unexpected publish permission for %', actor.role;
    end if;
    execute 'reset role';
  end loop;
end $$;
rollback;
select 'PASS: public read; officer/admin writes; pending/member/board_manager writes denied; all changes rolled back' as result;
