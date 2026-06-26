create table if not exists public.email_delivery_logs (
  id bigserial primary key,
  notification_type text not null check (notification_type in ('booking_created', 'booking_deleted')),
  status text not null check (status in ('success', 'failure')),
  provider text not null,
  booking_id uuid references public.bookings(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  recipient_email text not null,
  subject text not null,
  body text,
  provider_message_id text,
  error_message text,
  provider_response jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_delivery_logs_created_at_idx
  on public.email_delivery_logs (created_at desc);

create index if not exists email_delivery_logs_booking_id_idx
  on public.email_delivery_logs (booking_id);

create index if not exists email_delivery_logs_status_idx
  on public.email_delivery_logs (status, created_at desc);

alter table public.email_delivery_logs enable row level security;

drop policy if exists "email delivery logs select admin only" on public.email_delivery_logs;
create policy "email delivery logs select admin only"
on public.email_delivery_logs
for select
to authenticated
using (public.is_admin_user());

create or replace function public.record_email_delivery_log(
  p_notification_type text,
  p_status text,
  p_provider text,
  p_booking_id uuid,
  p_actor_id uuid,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_subject text,
  p_body text,
  p_provider_message_id text default null,
  p_error_message text default null,
  p_provider_response jsonb default '{}'::jsonb,
  p_payload jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  log_id bigint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor mismatch';
  end if;

  if p_actor_id is distinct from p_recipient_user_id and not public.is_admin_user() then
    raise exception 'not allowed';
  end if;

  insert into public.email_delivery_logs (
    notification_type,
    status,
    provider,
    booking_id,
    actor_id,
    recipient_user_id,
    recipient_email,
    subject,
    body,
    provider_message_id,
    error_message,
    provider_response,
    payload
  )
  values (
    p_notification_type,
    p_status,
    p_provider,
    p_booking_id,
    p_actor_id,
    p_recipient_user_id,
    p_recipient_email,
    p_subject,
    p_body,
    p_provider_message_id,
    p_error_message,
    coalesce(p_provider_response, '{}'::jsonb),
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into log_id;

  return log_id;
end;
$$;

grant execute on function public.record_email_delivery_log(
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) to authenticated;
