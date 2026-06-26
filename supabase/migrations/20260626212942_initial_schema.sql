create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_approved_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_approved = true
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_profiles_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, is_approved)
  values (new.id, new.email, 'user', false)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  room_number text not null unique,
  capacity integer not null default 0 check (capacity >= 0),
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_rooms_updated_at
before update on public.rooms
for each row
execute function public.touch_updated_at();

create table if not exists public.booking_settings (
  id integer primary key default 1,
  weekly_booking_limit_minutes integer not null default 180 check (weekly_booking_limit_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_settings_single_row check (id = 1)
);

insert into public.booking_settings (id, weekly_booking_limit_minutes)
values (1, 180)
on conflict (id) do nothing;

create trigger touch_booking_settings_updated_at
before update on public.booking_settings
for each row
execute function public.touch_updated_at();

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_order check (end_at > start_at)
);

create trigger touch_bookings_updated_at
before update on public.bookings
for each row
execute function public.touch_updated_at();

create unique index if not exists bookings_room_start_unique
  on public.bookings (room_id, start_at);

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  );

create or replace function public.validate_booking_rules()
returns trigger
language plpgsql
as $$
declare
  local_start timestamp;
  local_end timestamp;
  week_start timestamp;
  weekly_limit integer;
  existing_minutes integer;
  new_minutes integer;
begin
  if not public.is_admin_user() and not public.is_approved_user() then
    raise exception 'account is not approved';
  end if;

  local_start := timezone('Asia/Seoul', new.start_at);
  local_end := timezone('Asia/Seoul', new.end_at);
  new_minutes := floor(extract(epoch from (new.end_at - new.start_at)) / 60);

  if extract(dow from local_start) not in (1, 2, 3, 4, 5) then
    raise exception 'bookings are only allowed Monday through Friday';
  end if;

  if extract(hour from local_start) < 8
    or (extract(hour from local_end) > 18)
    or (extract(hour from local_end) = 18 and extract(minute from local_end) > 0)
    or (extract(hour from local_end) = 18 and extract(minute from local_end) = 0 and extract(second from local_end) > 0) then
    raise exception 'bookings must stay between 08:00 and 18:00 Asia/Seoul';
  end if;

  if extract(minute from local_start) not in (0, 30)
    or extract(second from local_start) <> 0
    or extract(minute from local_end) not in (0, 30)
    or extract(second from local_end) <> 0 then
    raise exception 'bookings must start and end on 30 minute boundaries';
  end if;

  if new_minutes > 60 then
    raise exception 'bookings cannot exceed 60 minutes';
  end if;

  if not public.is_admin_user() then
    week_start := date_trunc('week', local_start);

    select coalesce(sum(extract(epoch from (b.end_at - b.start_at)) / 60), 0)::integer
    into existing_minutes
    from public.bookings b
    where b.user_id = new.user_id
      and timezone('Asia/Seoul', b.start_at) >= week_start
      and timezone('Asia/Seoul', b.start_at) < week_start + interval '7 days'
      and (tg_op <> 'UPDATE' or b.id <> new.id);

    select weekly_booking_limit_minutes
    into weekly_limit
    from public.booking_settings
    where id = 1;

    if coalesce(existing_minutes, 0) + new_minutes > weekly_limit then
      raise exception 'weekly booking limit exceeded';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_booking_rules on public.bookings;
create trigger enforce_booking_rules
before insert or update on public.bookings
for each row
execute function public.validate_booking_rules();

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles select own or admin"
on public.profiles
for select
to authenticated
using (auth.uid() = id or public.is_admin_user());

create policy "profiles insert own row"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id and role = 'user' and is_approved = false);

create policy "profiles update own approved row"
on public.profiles
for update
to authenticated
using (auth.uid() = id or public.is_admin_user())
with check (
  (auth.uid() = id and role = 'user' and is_approved = true)
  or public.is_admin_user()
);

create policy "profiles delete admin only"
on public.profiles
for delete
to authenticated
using (public.is_admin_user());

create policy "rooms select approved users"
on public.rooms
for select
to authenticated
using (public.is_approved_user() or public.is_admin_user());

create policy "rooms manage admin only"
on public.rooms
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "booking settings select admin only"
on public.booking_settings
for select
to authenticated
using (public.is_admin_user());

create policy "booking settings update admin only"
on public.booking_settings
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "bookings select approved users"
on public.bookings
for select
to authenticated
using (public.is_approved_user() or public.is_admin_user());

create policy "bookings insert approved users"
on public.bookings
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (public.is_approved_user() or public.is_admin_user())
);

create policy "bookings update owner or admin"
on public.bookings
for update
to authenticated
using (user_id = auth.uid() or public.is_admin_user())
with check (user_id = auth.uid() or public.is_admin_user());

create policy "bookings delete owner or admin"
on public.bookings
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin_user());

create policy "audit logs select admin only"
on public.audit_logs
for select
to authenticated
using (public.is_admin_user());
