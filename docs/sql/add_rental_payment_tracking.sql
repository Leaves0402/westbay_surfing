-- Rental unpaid tracking, cancel-after-start guard, and payment mark RPCs.
-- Run after add_is_paid_to_rental_registrations.sql.

alter table public.rental_registrations
add column if not exists paid_at timestamptz null;

alter table public.rental_registrations
add column if not exists paid_by uuid null references public.profiles (id) on delete set null;

create index if not exists rental_registrations_user_id_is_paid_idx
  on public.rental_registrations (user_id, is_paid);

create index if not exists rental_registrations_rental_slot_id_idx
  on public.rental_registrations (rental_slot_id);

create or replace function public.rental_slot_has_started(
  target_date date,
  target_start_time time
)
returns boolean
language sql
stable
as $$
  select (target_date + target_start_time)
    <= (timezone('Asia/Taipei', now()))::timestamp;
$$;

create or replace function public.get_my_unpaid_rental_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  unpaid_count integer;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  select count(*)::integer
  into unpaid_count
  from public.rental_registrations registration
  join public.rental_slots slot
    on slot.id = registration.rental_slot_id
  where registration.user_id = auth.uid()
    and registration.is_paid = false
    and public.rental_slot_has_started(slot.rental_date, slot.start_time::time);

  return coalesce(unpaid_count, 0);
end;
$$;

create or replace function public.register_rental_slot(target_slot_id uuid)
returns public.rental_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_row public.rental_slots%rowtype;
  unpaid_count integer;
  new_registration public.rental_registrations;
  current_count integer;
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

  select *
  into slot_row
  from public.rental_slots
  where id = target_slot_id;

  if slot_row.id is null then
    raise exception '找不到租板時段。';
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

  insert into public.rental_registrations (
    rental_slot_id,
    user_id,
    is_paid
  )
  values (
    target_slot_id,
    auth.uid(),
    false
  )
  returning * into new_registration;

  return new_registration;
end;
$$;

create or replace function public.cancel_rental_registration(
  target_registration_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  registration_row public.rental_registrations%rowtype;
  slot_row public.rental_slots%rowtype;
  current_role text;
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  select *
  into registration_row
  from public.rental_registrations
  where id = target_registration_id;

  if registration_row.id is null then
    raise exception '找不到租板登記。';
  end if;

  select *
  into slot_row
  from public.rental_slots
  where id = registration_row.rental_slot_id;

  if slot_row.id is null then
    raise exception '找不到租板時段。';
  end if;

  if public.rental_slot_has_started(slot_row.rental_date, slot_row.start_time::time) then
    raise exception '租板時段已開始，無法取消';
  end if;

  current_role := coalesce(public.current_profile_role(), 'pending');

  if registration_row.user_id is distinct from auth.uid()
    and current_role not in ('board_manager', 'officer', 'admin')
  then
    raise exception '只能取消自己的登記。';
  end if;

  delete from public.rental_registrations
  where id = target_registration_id;
end;
$$;

create or replace function public.mark_rental_registration_paid(
  target_registration_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if coalesce(public.current_profile_role(), 'pending') not in ('officer', 'admin') then
    raise exception '只有幹部與管理員可以標記補繳。';
  end if;

  update public.rental_registrations
  set
    is_paid = true,
    paid_at = now(),
    paid_by = auth.uid(),
    updated_at = now()
  where id = target_registration_id
    and is_paid = false;

  if not found then
    raise exception '找不到未繳費紀錄。';
  end if;
end;
$$;

create or replace function public.prevent_non_staff_payment_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_paid is distinct from new.is_paid
    and coalesce(public.current_profile_role(), 'pending') not in ('officer', 'admin')
  then
    raise exception 'Only officers and admins can update rental payment status.';
  end if;

  if old.is_paid is distinct from new.is_paid
    and new.is_paid = true
  then
    new.paid_at := coalesce(new.paid_at, now());
    new.paid_by := coalesce(new.paid_by, auth.uid());
  end if;

  if old.is_paid is distinct from new.is_paid
    and new.is_paid = false
  then
    new.paid_at := null;
    new.paid_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_non_staff_payment_updates
on public.rental_registrations;

create trigger prevent_non_staff_payment_updates
before update on public.rental_registrations
for each row
execute function public.prevent_non_staff_payment_updates();

drop policy if exists "Board managers officers and admins can update rental payments"
on public.rental_registrations;

drop policy if exists "Officers and admins can update rental payments"
on public.rental_registrations;

create policy "Officers and admins can update rental payments"
on public.rental_registrations
for update
to authenticated
using (
  public.current_profile_role() in ('officer', 'admin')
)
with check (
  public.current_profile_role() in ('officer', 'admin')
);

grant execute on function public.rental_slot_has_started(date, time) to authenticated;
grant execute on function public.get_my_unpaid_rental_count() to authenticated;
grant execute on function public.register_rental_slot(uuid) to authenticated;
grant execute on function public.cancel_rental_registration(uuid) to authenticated;
grant execute on function public.mark_rental_registration_paid(uuid) to authenticated;
