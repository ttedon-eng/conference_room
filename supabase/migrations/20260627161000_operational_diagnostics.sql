create or replace function public.get_operational_diagnostics()
returns table (
  check_name text,
  status text,
  details text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  has_profile_columns boolean;
  has_profiles_index boolean;
  has_email_delivery_constraint boolean;
  has_booking_rows_fn boolean;
  has_booking_groups_fn boolean;
  has_signup_verifications boolean;
  booking_settings_count integer;
  group_count integer;
  room_count integer;
begin
  if not public.is_admin_user() then
    raise exception 'not allowed';
  end if;

  select count(*) = 3
    into has_profile_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name in ('rejected_at', 'rejected_by', 'rejection_reason');

  select exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'profiles'
      and indexname = 'profiles_rejected_at_idx'
  ) into has_profiles_index;

  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'email_delivery_logs'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%profile_rejected%'
  ) into has_email_delivery_constraint;

  select to_regprocedure('public.get_booking_dashboard_rows()') is not null
    into has_booking_rows_fn;

  select to_regprocedure('public.list_booking_groups()') is not null
    into has_booking_groups_fn;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'signup_verifications'
  ) into has_signup_verifications;

  select count(*) into booking_settings_count
  from public.booking_settings
  where id = 1;

  select count(*) into group_count
  from public.groups
  where name in ('미지정', '데이터', '프론트코어', 'GA선진화');

  select count(*) into room_count
  from public.rooms
  where is_active = true;

  return query
    select
      'profiles.rejected fields'::text,
      case when has_profile_columns then 'ok' else 'error' end,
      case
        when has_profile_columns then 'rejected_at, rejected_by, rejection_reason present'
        else 'missing one or more rejected profile columns'
      end
    union all
    select
      'profiles.rejected index'::text,
      case when has_profiles_index then 'ok' else 'warn' end,
      case
        when has_profiles_index then 'profiles_rejected_at_idx present'
        else 'profiles_rejected_at_idx missing'
      end
    union all
    select
      'email_delivery_logs constraint'::text,
      case when has_email_delivery_constraint then 'ok' else 'error' end,
      case
        when has_email_delivery_constraint then 'profile_rejected allowed'
        else 'profile_rejected missing from notification_type check'
      end
    union all
    select
      'booking dashboard functions'::text,
      case when has_booking_rows_fn and has_booking_groups_fn then 'ok' else 'error' end,
      case
        when has_booking_rows_fn and has_booking_groups_fn then 'get_booking_dashboard_rows and list_booking_groups present'
        else 'one or more booking dashboard functions missing'
      end
    union all
    select
      'signup_verifications table'::text,
      case when has_signup_verifications then 'ok' else 'error' end,
      case
        when has_signup_verifications then 'signup_verifications present'
        else 'signup_verifications missing'
      end
    union all
    select
      'booking_settings seed'::text,
      case when booking_settings_count > 0 then 'ok' else 'warn' end,
      case
        when booking_settings_count > 0 then 'booking_settings row exists'
        else 'booking_settings row missing'
      end
    union all
    select
      'group seed'::text,
      case when group_count = 4 then 'ok' else 'warn' end,
      case
        when group_count = 4 then 'default groups present'
        else format('expected 4 default groups, found %s', group_count)
      end
    union all
    select
      'room seed'::text,
      case when room_count > 0 then 'ok' else 'warn' end,
      case
        when room_count > 0 then format('%s active rooms present', room_count)
        else 'no active rooms present'
      end;
end;
$$;

grant execute on function public.get_operational_diagnostics() to authenticated;
