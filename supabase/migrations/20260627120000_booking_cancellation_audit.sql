create or replace function public.log_booking_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    'booking_deleted',
    'booking',
    old.id,
    jsonb_build_object(
      'room_id', old.room_id,
      'user_id', old.user_id,
      'start_at', old.start_at,
      'end_at', old.end_at
    )
  );

  return old;
end;
$$;

drop trigger if exists record_booking_cancellation on public.bookings;
create trigger record_booking_cancellation
after delete on public.bookings
for each row
execute function public.log_booking_cancellation();
