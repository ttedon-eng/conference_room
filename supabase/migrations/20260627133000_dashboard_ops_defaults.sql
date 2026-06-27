alter table public.profiles
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id),
  add column if not exists rejection_reason text;

create index if not exists profiles_rejected_at_idx
  on public.profiles (rejected_at desc);

alter table public.email_delivery_logs
  drop constraint if exists email_delivery_logs_notification_type_check;

alter table public.email_delivery_logs
  add constraint email_delivery_logs_notification_type_check
  check (notification_type in ('booking_created', 'booking_deleted', 'profile_rejected'));

create or replace function public.get_booking_dashboard_rows()
returns table (
  id uuid,
  room_id uuid,
  room_name text,
  room_number text,
  user_id uuid,
  user_name text,
  user_email text,
  group_id uuid,
  group_name text,
  start_at timestamptz,
  end_at timestamptz,
  title text,
  notes text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved_user() and not public.is_admin_user() then
    raise exception 'not allowed';
  end if;

  return query
    select
      b.id,
      b.room_id,
      r.name as room_name,
      r.room_number,
      b.user_id,
      coalesce(p.full_name, p.email) as user_name,
      p.email as user_email,
      p.group_id,
      g.name as group_name,
      b.start_at,
      b.end_at,
      b.title,
      b.notes
    from public.bookings b
    join public.rooms r
      on r.id = b.room_id
    join public.profiles p
      on p.id = b.user_id
    left join public.groups g
      on g.id = p.group_id
    order by b.start_at asc, b.created_at asc;
end;
$$;

grant execute on function public.get_booking_dashboard_rows() to authenticated;

create or replace function public.list_booking_groups()
returns table (
  id uuid,
  name text,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved_user() and not public.is_admin_user() then
    raise exception 'not allowed';
  end if;

  return query
    select
      g.id,
      g.name,
      g.is_active
    from public.groups g
    order by g.is_active desc, g.name asc;
end;
$$;

grant execute on function public.list_booking_groups() to authenticated;

insert into public.booking_settings (id, weekly_booking_limit_minutes)
values (1, 180)
on conflict (id) do nothing;

insert into public.groups (id, name, description, is_active)
values
  ('10000000-0000-4000-8000-000000000001', '미지정', '기본 통계와 대시보드 기준 그룹', false),
  ('10000000-0000-4000-8000-000000000002', '데이터', '데이터 분석 및 운영 그룹', true),
  ('10000000-0000-4000-8000-000000000003', '프론트코어', '프론트엔드 핵심 기능 그룹', true),
  ('10000000-0000-4000-8000-000000000004', 'GA선진화', 'GA 및 운영 고도화 그룹', true)
on conflict (name) do nothing;

insert into public.rooms (id, name, room_number, capacity, description, is_active)
values
  ('20000000-0000-4000-8000-000000000001', 'Nexus A', '101', 8, '소규모 운영 회의용 샘플 회의실', true),
  ('20000000-0000-4000-8000-000000000002', 'Nexus B', '102', 12, '중간 규모 회의 및 리뷰용 샘플 회의실', true),
  ('20000000-0000-4000-8000-000000000003', 'Nexus C', '201', 16, '다부서 협업용 샘플 회의실', true)
on conflict (room_number) do nothing;
