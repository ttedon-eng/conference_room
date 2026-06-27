create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_allowed_signup_email(new.email) then
    raise exception 'email domain is not allowed';
  end if;

  insert into public.profiles (id, email, full_name, role, is_approved)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    'user',
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.prevent_profile_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.email is distinct from old.email then
    raise exception 'profile email is managed by auth';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_email_change on public.profiles;
create trigger prevent_profile_email_change
before update on public.profiles
for each row
execute function public.prevent_profile_email_change();

create table if not exists public.signup_verifications (
  id uuid primary key,
  email text not null unique,
  code_hash text not null,
  code_expires_at timestamptz not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists signup_verifications_email_idx
  on public.signup_verifications (email);

create index if not exists signup_verifications_locked_at_idx
  on public.signup_verifications (locked_at);

drop trigger if exists touch_signup_verifications_updated_at on public.signup_verifications;
create trigger touch_signup_verifications_updated_at
before update on public.signup_verifications
for each row
execute function public.touch_updated_at();

alter table public.signup_verifications enable row level security;

