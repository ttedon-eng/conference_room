create table if not exists public.booking_series (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  notes text,
  recurrence_type text not null default 'weekly' check (recurrence_type in ('weekly')),
  interval_weeks integer not null default 1 check (interval_weeks > 0),
  repeat_count integer not null default 1 check (repeat_count > 0 and repeat_count <= 12),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_series_time_order check (ends_at > starts_at)
);

drop trigger if exists touch_booking_series_updated_at on public.booking_series;
create trigger touch_booking_series_updated_at
before update on public.booking_series
for each row
execute function public.touch_updated_at();

create index if not exists booking_series_room_status_idx
  on public.booking_series (room_id, status, starts_at desc);

create index if not exists booking_series_user_status_idx
  on public.booking_series (user_id, status, starts_at desc);

create index if not exists bookings_series_start_idx
  on public.bookings (series_id, start_at);

alter table public.bookings
  add column if not exists series_id uuid references public.booking_series(id) on delete set null,
  add column if not exists occurrence_index integer not null default 1 check (occurrence_index > 0);

alter table public.booking_series enable row level security;

create policy "booking series select approved users"
on public.booking_series
for select
to authenticated
using (public.is_approved_user() or public.is_admin_user());

create policy "booking series manage owner or admin"
on public.booking_series
for update
to authenticated
using (user_id = auth.uid() or public.is_admin_user())
with check (user_id = auth.uid() or public.is_admin_user());

create or replace function public.create_weekly_booking_series(
  p_room_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_title text default null,
  p_notes text default null,
  p_repeat_count integer default 1
)
returns table (
  series_id uuid,
  booking_id uuid,
  occurrence_index integer,
  start_at timestamptz,
  end_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_series_id uuid;
  current_start timestamptz;
  current_end timestamptz;
  current_index integer;
begin
  if not public.is_admin_user() and not public.is_approved_user() then
    raise exception 'account is not approved';
  end if;

  if p_repeat_count is null or p_repeat_count < 1 or p_repeat_count > 12 then
    raise exception 'repeat count must be between 1 and 12';
  end if;

  insert into public.booking_series (
    room_id,
    user_id,
    title,
    notes,
    recurrence_type,
    interval_weeks,
    repeat_count,
    starts_at,
    ends_at,
    status
  )
  values (
    p_room_id,
    auth.uid(),
    p_title,
    p_notes,
    'weekly',
    1,
    p_repeat_count,
    p_start_at,
    p_end_at,
    'active'
  )
  returning id into created_series_id;

  current_start := p_start_at;
  current_end := p_end_at;

  for current_index in 1..p_repeat_count loop
    return query
      with inserted as (
        insert into public.bookings (
          room_id,
          user_id,
          start_at,
          end_at,
          title,
          notes,
          series_id,
          occurrence_index
        )
        values (
          p_room_id,
          auth.uid(),
          current_start,
          current_end,
          p_title,
          p_notes,
          created_series_id,
          current_index
        )
        returning id, start_at, end_at
      )
      select
        created_series_id,
        inserted.id,
        current_index,
        inserted.start_at,
        inserted.end_at
      from inserted;

    current_start := current_start + interval '1 week';
    current_end := current_end + interval '1 week';
  end loop;
end;
$$;

grant execute on function public.create_weekly_booking_series(uuid, timestamptz, timestamptz, text, text, integer) to authenticated;

create or replace function public.list_booking_series_overview()
returns table (
  id uuid,
  room_id uuid,
  room_name text,
  room_number text,
  user_id uuid,
  user_name text,
  user_email text,
  title text,
  notes text,
  recurrence_type text,
  interval_weeks integer,
  repeat_count integer,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  upcoming_booking_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'not allowed';
  end if;

  return query
    select
      s.id,
      s.room_id,
      r.name as room_name,
      r.room_number,
      s.user_id,
      coalesce(p.full_name, p.email) as user_name,
      p.email as user_email,
      s.title,
      s.notes,
      s.recurrence_type,
      s.interval_weeks,
      s.repeat_count,
      s.status,
      s.starts_at,
      s.ends_at,
      count(b.id) filter (where b.start_at >= now()) as upcoming_booking_count,
      s.created_at,
      s.updated_at
    from public.booking_series s
    join public.rooms r
      on r.id = s.room_id
    join public.profiles p
      on p.id = s.user_id
    left join public.bookings b
      on b.series_id = s.id
    group by s.id, r.name, r.room_number, p.full_name, p.email
    order by s.created_at desc;
end;
$$;

grant execute on function public.list_booking_series_overview() to authenticated;

create or replace function public.cancel_booking_series(p_series_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  series_row public.booking_series%rowtype;
begin
  select *
  into series_row
  from public.booking_series
  where id = p_series_id
  for update;

  if not found then
    raise exception 'booking series not found';
  end if;

  if not public.is_admin_user() and series_row.user_id <> auth.uid() then
    raise exception 'not allowed';
  end if;

  update public.booking_series
    set status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = auth.uid()
  where id = p_series_id;

  delete from public.bookings
  where series_id = p_series_id
    and start_at >= now();
end;
$$;

grant execute on function public.cancel_booking_series(uuid) to authenticated;
