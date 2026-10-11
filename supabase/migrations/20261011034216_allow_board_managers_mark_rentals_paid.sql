-- Board managers may mark rentals paid at any time through the existing RPC.
-- Apply after add_guest_rentals.sql. Direct updates (including undo) stay
-- restricted to officers/admins by the existing UPDATE policy.
create or replace function public.mark_rental_registration_paid(
  target_registration_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '請先登入。';
  end if;

  if coalesce(public.current_profile_role(), 'pending') not in ('board_manager', 'officer', 'admin') then
    raise exception '只有板務、幹部與管理員可以標記補繳。';
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

  perform public.cleanup_paid_guest_rental_personal_data();
end;
$$;

create or replace function public.prevent_non_staff_payment_updates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_paid is distinct from new.is_paid then
    if new.is_paid then
      if coalesce(public.current_profile_role(), 'pending') not in ('board_manager', 'officer', 'admin') then
        raise exception '只有板務、幹部與管理員可以標記已繳費。';
      end if;
      new.paid_at := coalesce(new.paid_at, now());
      new.paid_by := coalesce(new.paid_by, auth.uid());
    else
      if coalesce(public.current_profile_role(), 'pending') not in ('officer', 'admin') then
        raise exception '只有幹部與管理員可以取消已繳費標記。';
      end if;
      new.paid_at := null;
      new.paid_by := null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.mark_rental_registration_paid(uuid) from public, anon;
grant execute on function public.mark_rental_registration_paid(uuid) to authenticated;
