-- Public rental rules; only officers and admins may publish or edit them.
-- Requires public.is_current_profile_staff(), shared with homepage management.
create table if not exists public.rental_rules (
  id smallint primary key default 1 check (id = 1),
  content text not null check (char_length(btrim(content)) between 1 and 10000)
);

alter table public.rental_rules enable row level security;

drop policy if exists "Anyone can read rental rules" on public.rental_rules;
create policy "Anyone can read rental rules"
on public.rental_rules for select to anon, authenticated
using (true);

drop policy if exists "Staff can publish rental rules" on public.rental_rules;
create policy "Staff can publish rental rules"
on public.rental_rules for insert to authenticated
with check (public.is_current_profile_staff());

drop policy if exists "Staff can update rental rules" on public.rental_rules;
create policy "Staff can update rental rules"
on public.rental_rules for update to authenticated
using (public.is_current_profile_staff())
with check (public.is_current_profile_staff());

revoke all on public.rental_rules from anon, authenticated;
grant select on public.rental_rules to anon, authenticated;
grant insert, update on public.rental_rules to authenticated;

-- No seed text: an absent row means the rules have not been published.
