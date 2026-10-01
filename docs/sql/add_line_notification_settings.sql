-- Stores the single LINE group that receives club website notifications.
-- The browser roles receive no table privileges or RLS policies.

create table if not exists public.line_notification_settings (
  id boolean primary key default true check (id),
  group_id text not null unique check (char_length(group_id) between 1 and 255),
  group_name text,
  bound_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.line_notification_settings enable row level security;

revoke all on table public.line_notification_settings from public, anon, authenticated;
grant select, insert, update on table public.line_notification_settings to service_role;

comment on table public.line_notification_settings is
  'Server-only destination for LINE Messaging API group notifications.';

comment on column public.line_notification_settings.id is
  'Boolean singleton key; the table can contain only the true row.';
