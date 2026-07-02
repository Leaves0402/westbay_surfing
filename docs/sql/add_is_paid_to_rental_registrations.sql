alter table public.rental_registrations
add column if not exists is_paid boolean not null default false;

drop view if exists public.public_member_profiles;

create view public.public_member_profiles as
select
  id,
  full_name,
  student_id,
  surf_level,
  role
from public.profiles
where role in ('member', 'board_manager', 'officer', 'admin');

grant select on public.public_member_profiles to authenticated;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.prevent_non_staff_payment_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_paid is distinct from new.is_paid
    and coalesce(public.current_profile_role(), 'pending') not in ('board_manager', 'officer', 'admin')
  then
    raise exception 'Only board managers, officers, and admins can update rental payment status.';
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

create policy "Board managers officers and admins can update rental payments"
on public.rental_registrations
for update
to authenticated
using (
  public.current_profile_role() in ('board_manager', 'officer', 'admin')
)
with check (
  public.current_profile_role() in ('board_manager', 'officer', 'admin')
);
