begin;

-- Non-member rentals share the same registration table so capacity and board
-- reservations remain atomic with member rentals. Guest PII is never exposed
-- through the public schedule RPC.
alter table public.rental_registrations
  alter column user_id drop not null;

alter table public.rental_registrations
  add column if not exists renter_type text not null default 'member',
  add column if not exists guest_name text,
  add column if not exists guest_phone text,
  add column if not exists guest_phone_hash text,
  add column if not exists guest_note text,
  add column if not exists reservation_code_hash text,
  add column if not exists guest_terms_version text,
  add column if not exists guest_terms_acknowledged_at timestamptz,
  add column if not exists guest_is_adult boolean,
  add column if not exists rental_fee integer not null default 0,
  add column if not exists personal_data_deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_registrations_renter_type_check'
      and conrelid = 'public.rental_registrations'::regclass
  ) then
    alter table public.rental_registrations
      add constraint rental_registrations_renter_type_check
      check (renter_type in ('member', 'guest'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_registrations_renter_identity_check'
      and conrelid = 'public.rental_registrations'::regclass
  ) then
    alter table public.rental_registrations
      add constraint rental_registrations_renter_identity_check
      check (
        (
          renter_type = 'member'
          and user_id is not null
          and guest_name is null
          and guest_phone is null
          and guest_phone_hash is null
          and reservation_code_hash is null
          and rental_fee = 0
        )
        or
        (
          renter_type = 'guest'
          and user_id is null
          and rental_fee = 200
          and guest_terms_version is not null
          and guest_terms_acknowledged_at is not null
          and guest_is_adult is true
          and (
            (
              personal_data_deleted_at is null
              and guest_name is not null
              and guest_phone is not null
              and guest_phone_hash is not null
              and reservation_code_hash is not null
            )
            or
            (
              personal_data_deleted_at is not null
              and guest_name is null
              and guest_phone is null
              and guest_phone_hash is null
              and guest_note is null
              and reservation_code_hash is null
            )
          )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rental_registrations_guest_lengths_check'
      and conrelid = 'public.rental_registrations'::regclass
  ) then
    alter table public.rental_registrations
      add constraint rental_registrations_guest_lengths_check
      check (
        (guest_name is null or char_length(guest_name) between 2 and 50)
        and (guest_phone is null or char_length(guest_phone) between 8 and 15)
        and (guest_note is null or char_length(guest_note) <= 500)
        and (guest_phone_hash is null or char_length(guest_phone_hash) = 64)
        and (reservation_code_hash is null or char_length(reservation_code_hash) = 64)
      );
  end if;
end;
$$;

create index if not exists rental_registrations_guest_phone_hash_idx
  on public.rental_registrations (guest_phone_hash)
  where renter_type = 'guest' and guest_phone_hash is not null;

create index if not exists rental_registrations_guest_cleanup_idx
  on public.rental_registrations (rental_slot_id)
  where renter_type = 'guest'
    and is_paid = true
    and personal_data_deleted_at is null;

create or replace function public.normalize_guest_phone(input_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(input_phone, ''), '[^0-9]', '', 'g')
$$;

create or replace function public.mask_rental_name(input_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(btrim(input_name), '') is null then '未提供姓名'
    when char_length(btrim(input_name)) = 1 then btrim(input_name) || 'O'
    else left(btrim(input_name), 1) || repeat('O', char_length(btrim(input_name)) - 1)
  end
$$;

-- Public calendar details: names are masked and neither student IDs nor phone
-- numbers are returned. Board UUIDs are returned only to disable already-taken
-- boards in the picker.
create or replace function public.get_public_rental_schedule_details_range(
  target_start_date date,
  target_end_date date
)
returns table (
  id uuid,
  rental_date date,
  start_time time,
  end_time time,
  capacity integer,
  min_surf_level text,
  is_open boolean,
  registration_count integer,
  remaining_capacity integer,
  registrations jsonb,
  taken_surfboard_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_start_date is null
    or target_end_date is null
    or target_end_date < target_start_date
  then
    raise exception '租板日期範圍無效。';
  end if;

  if target_end_date - target_start_date > 62 then
    raise exception '公開租板日曆一次最多查詢 63 天。';
  end if;

  return query
  select
    slot.id,
    slot.rental_date,
    slot.start_time,
    slot.end_time,
    slot.capacity,
    slot.min_surf_level,
    slot.is_open,
    count(registration.id)::integer,
    greatest(slot.capacity - count(registration.id), 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', registration.id,
          'renter_type', registration.renter_type,
          'display_name', public.mask_rental_name(
            case
              when registration.renter_type = 'guest'
                then coalesce(registration.guest_name, '非社員')
              else coalesce(member.full_name, '社員')
            end
          ),
          'surf_level', case
            when registration.renter_type = 'guest' then '初階'
            else member.surf_level
          end,
          'is_paid', registration.is_paid,
          'surfboard_name', board.name
        )
        order by registration.created_at, registration.id
      ) filter (where registration.id is not null),
      '[]'::jsonb
    ),
    coalesce(
      array_agg(registration.surfboard_id order by registration.created_at)
        filter (where registration.surfboard_id is not null),
      array[]::uuid[]
    )
  from public.rental_slots slot
  left join public.rental_registrations registration
    on registration.rental_slot_id = slot.id
  left join public.profiles member
    on member.id = registration.user_id
  left join public.surfboards board
    on board.id = registration.surfboard_id
  where slot.rental_date between target_start_date and target_end_date
  group by slot.id
  order by slot.rental_date asc, slot.start_time asc;
end;
$$;

-- Safe public catalog. Only beginner boards are exposed to signed-out guests.
create or replace function public.get_public_beginner_surfboards()
returns table (
  id uuid,
  name text,
  suitability_level text,
  board_types text[],
  buoyancy numeric,
  length text,
  description text,
  images jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    board.id,
    board.name,
    board.suitability_level,
    board.board_types,
    board.buoyancy,
    board.length,
    board.description,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', image.id,
          'surfboard_id', image.surfboard_id,
          'storage_path', image.storage_path,
          'sort_order', image.sort_order,
          'created_at', image.created_at
        )
        order by image.sort_order, image.created_at
      ) filter (where image.id is not null),
      '[]'::jsonb
    ) as images
  from public.surfboards board
  left join public.surfboard_images image on image.surfboard_id = board.id
  where board.suitability_level = '初階'
  group by board.id
  order by board.created_at, board.id
$$;

create or replace function public.register_guest_rental(
  target_slot_id uuid,
  target_surfboard_id uuid,
  target_name text,
  target_phone text,
  target_note text,
  target_terms_accepted boolean,
  target_is_adult boolean
)
returns table (registration_id uuid, reservation_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot_row public.rental_slots%rowtype;
  board_row public.surfboards%rowtype;
  normalized_name text := btrim(coalesce(target_name, ''));
  normalized_phone text := public.normalize_guest_phone(target_phone);
  normalized_note text := nullif(btrim(coalesce(target_note, '')), '');
  phone_hash text;
  raw_reservation_code text;
  reservation_hash text;
  current_count integer;
  new_registration_id uuid;
begin
  if auth.uid() is not null then
    raise exception '此流程只提供未登入的非社員使用。';
  end if;

  if target_terms_accepted is distinct from true then
    raise exception '請先閱讀並同意非社員租板說明。';
  end if;

  if target_is_adult is distinct from true then
    raise exception '非社員租板僅開放年滿 18 歲者。';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 50 then
    raise exception '姓名需為 2 至 50 個字。';
  end if;

  if normalized_phone !~ '^[0-9]{8,15}$' then
    raise exception '請填寫 8 至 15 碼的有效聯絡電話。';
  end if;

  if normalized_note is not null and char_length(normalized_note) > 500 then
    raise exception '備註最多 500 個字。';
  end if;

  if target_surfboard_id is null then
    raise exception '請先挑選一張初階衝浪板。';
  end if;

  phone_hash := encode(extensions.digest(normalized_phone, 'sha256'), 'hex');

  -- Serialize requests for the same phone before checking the one-booking rule.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('guest-rental-phone:' || phone_hash, 0)
  );

  if exists (
    select 1
    from public.rental_registrations registration
    join public.rental_slots existing_slot
      on existing_slot.id = registration.rental_slot_id
    where registration.renter_type = 'guest'
      and registration.guest_phone_hash = phone_hash
      and (
        registration.is_paid = false
        or (
          (existing_slot.rental_date + existing_slot.end_time)
            at time zone 'Asia/Taipei'
        ) > now()
      )
  ) then
    raise exception '這支電話已有租板預約；同一電話一次只能保留一筆。';
  end if;

  -- Share the slot row lock with member registration to prevent overbooking.
  select *
  into slot_row
  from public.rental_slots
  where id = target_slot_id
  for update;

  if slot_row.id is null then
    raise exception '找不到租板時段。';
  end if;

  if public.rental_slot_has_started(
    slot_row.rental_date,
    slot_row.start_time::time
  ) then
    raise exception '此租板時段已開始，無法登記。';
  end if;

  if not slot_row.is_open then
    raise exception '這個租板時段目前未開放。';
  end if;

  if slot_row.min_surf_level is not null
    and slot_row.min_surf_level <> '初階'
  then
    raise exception '非社員一律視為初階，無法登記此時段。';
  end if;

  select count(*)::integer
  into current_count
  from public.rental_registrations
  where rental_slot_id = target_slot_id;

  if current_count >= slot_row.capacity then
    raise exception '這個租板時段已額滿。';
  end if;

  select *
  into board_row
  from public.surfboards
  where id = target_surfboard_id;

  if board_row.id is null then
    raise exception '找不到這張衝浪板。';
  end if;

  if board_row.suitability_level <> '初階' then
    raise exception '非社員只能租借初階衝浪板。';
  end if;

  if exists (
    select 1
    from public.rental_registrations
    where rental_slot_id = target_slot_id
      and surfboard_id = target_surfboard_id
  ) then
    raise exception '這張板在此時段已被選走，請重新挑選。';
  end if;

  raw_reservation_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12));
  reservation_hash := encode(
    extensions.digest(raw_reservation_code, 'sha256'),
    'hex'
  );

  begin
    insert into public.rental_registrations (
      rental_slot_id,
      user_id,
      surfboard_id,
      is_paid,
      renter_type,
      guest_name,
      guest_phone,
      guest_phone_hash,
      guest_note,
      reservation_code_hash,
      guest_terms_version,
      guest_terms_acknowledged_at,
      guest_is_adult,
      rental_fee
    ) values (
      target_slot_id,
      null,
      target_surfboard_id,
      false,
      'guest',
      normalized_name,
      normalized_phone,
      phone_hash,
      normalized_note,
      reservation_hash,
      'guest-rental-2026-08-31',
      now(),
      true,
      200
    )
    returning id into new_registration_id;
  exception
    when unique_violation then
      raise exception '這張板在此時段已被選走，請重新挑選。';
  end;

  return query select new_registration_id, raw_reservation_code;
end;
$$;

create or replace function public.get_guest_rental_reservation(
  target_phone text,
  target_reservation_code text
)
returns table (
  registration_id uuid,
  rental_date date,
  start_time time,
  end_time time,
  guest_name text,
  guest_phone text,
  surf_level text,
  surfboard_name text,
  rental_fee integer,
  is_paid boolean,
  can_cancel boolean,
  cancellation_deadline timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    registration.id,
    slot.rental_date,
    slot.start_time,
    slot.end_time,
    registration.guest_name,
    registration.guest_phone,
    '初階'::text,
    board.name,
    registration.rental_fee,
    registration.is_paid,
    now() <= (
      (slot.rental_date + slot.start_time) at time zone 'Asia/Taipei'
    ) - interval '24 hours',
    (
      (slot.rental_date + slot.start_time) at time zone 'Asia/Taipei'
    ) - interval '24 hours'
  from public.rental_registrations registration
  join public.rental_slots slot on slot.id = registration.rental_slot_id
  left join public.surfboards board on board.id = registration.surfboard_id
  where auth.uid() is null
    and registration.renter_type = 'guest'
    and registration.personal_data_deleted_at is null
    and registration.guest_phone_hash = encode(
      extensions.digest(public.normalize_guest_phone(target_phone), 'sha256'),
      'hex'
    )
    and registration.reservation_code_hash = encode(
      extensions.digest(upper(btrim(coalesce(target_reservation_code, ''))), 'sha256'),
      'hex'
    )
  limit 1
$$;

create or replace function public.cancel_guest_rental(
  target_phone text,
  target_reservation_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration_row public.rental_registrations%rowtype;
  slot_row public.rental_slots%rowtype;
  phone_hash text := encode(
    extensions.digest(public.normalize_guest_phone(target_phone), 'sha256'),
    'hex'
  );
  code_hash text := encode(
    extensions.digest(upper(btrim(coalesce(target_reservation_code, ''))), 'sha256'),
    'hex'
  );
begin
  if auth.uid() is not null then
    raise exception '此流程只提供未登入的非社員使用。';
  end if;

  select *
  into registration_row
  from public.rental_registrations
  where renter_type = 'guest'
    and guest_phone_hash = phone_hash
    and reservation_code_hash = code_hash
    and personal_data_deleted_at is null
  for update;

  if registration_row.id is null then
    raise exception '查無預約，請確認電話與預約編號。';
  end if;

  select *
  into slot_row
  from public.rental_slots
  where id = registration_row.rental_slot_id;

  if now() > (
    (slot_row.rental_date + slot_row.start_time) at time zone 'Asia/Taipei'
  ) - interval '24 hours' then
    raise exception '已超過自行取消期限，請聯絡西灣衝浪社 Instagram。';
  end if;

  delete from public.rental_registrations
  where id = registration_row.id;
end;
$$;

create or replace function public.cleanup_paid_guest_rental_personal_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_count integer;
begin
  update public.rental_registrations registration
  set
    guest_name = null,
    guest_phone = null,
    guest_phone_hash = null,
    guest_note = null,
    reservation_code_hash = null,
    personal_data_deleted_at = now(),
    updated_at = now()
  from public.rental_slots slot
  where slot.id = registration.rental_slot_id
    and registration.renter_type = 'guest'
    and registration.is_paid = true
    and registration.personal_data_deleted_at is null
    and (
      (slot.rental_date + slot.end_time) at time zone 'Asia/Taipei'
    ) <= now() - interval '24 hours';

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

-- Marking an old guest registration paid should anonymize it immediately;
-- the hourly cron covers registrations that simply age past the 24-hour mark.
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

  perform public.cleanup_paid_guest_rental_personal_data();
end;
$$;

-- Signed-out users may only read files in the surfboard image bucket. Upload,
-- update and delete remain restricted to existing staff policies.
drop policy if exists "Public can read surfboard images" on storage.objects;
create policy "Public can read surfboard images"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'surfboard-images');

-- Least-privilege function access. SECURITY DEFINER functions are not callable
-- until explicitly granted below.
revoke all on function public.normalize_guest_phone(text) from public, anon, authenticated;
revoke all on function public.mask_rental_name(text) from public, anon, authenticated;
revoke all on function public.get_public_rental_schedule_details_range(date, date) from public, anon, authenticated;
revoke all on function public.get_public_beginner_surfboards() from public, anon, authenticated;
revoke all on function public.register_guest_rental(uuid, uuid, text, text, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.get_guest_rental_reservation(text, text) from public, anon, authenticated;
revoke all on function public.cancel_guest_rental(text, text) from public, anon, authenticated;
revoke all on function public.cleanup_paid_guest_rental_personal_data() from public, anon, authenticated;
revoke all on function public.mark_rental_registration_paid(uuid) from public, anon;

grant execute on function public.get_public_rental_schedule_details_range(date, date) to anon, authenticated;
grant execute on function public.get_public_beginner_surfboards() to anon;
grant execute on function public.register_guest_rental(uuid, uuid, text, text, text, boolean, boolean) to anon;
grant execute on function public.get_guest_rental_reservation(text, text) to anon;
grant execute on function public.cancel_guest_rental(text, text) to anon;
grant execute on function public.mark_rental_registration_paid(uuid) to authenticated;

-- Newly added columns are read by formal members under the existing RLS policy.
-- Guests never receive table grants and can only use the privacy-filtered RPCs.
revoke all on table public.rental_registrations from anon;

-- Replace any previous cleanup job with this deterministic hourly task.
do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'cleanup-paid-guest-rental-pii'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'cleanup-paid-guest-rental-pii',
    '20 * * * *',
    'select public.cleanup_paid_guest_rental_personal_data()'
  );
end;
$$;

commit;
