insert into public.booking_settings (id, weekly_booking_limit_minutes)
values (1, 180)
on conflict (id) do update
  set weekly_booking_limit_minutes = excluded.weekly_booking_limit_minutes,
      updated_at = now();

insert into public.groups (id, name, description, is_active)
values
  ('10000000-0000-4000-8000-000000000001', '미지정', '기본 통계와 대시보드 기준 그룹', false),
  ('10000000-0000-4000-8000-000000000002', '데이터', '데이터 분석 및 운영 그룹', true),
  ('10000000-0000-4000-8000-000000000003', '프론트코어', '프론트엔드 핵심 기능 그룹', true),
  ('10000000-0000-4000-8000-000000000004', 'GA선진화', 'GA 및 운영 고도화 그룹', true)
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      is_active = excluded.is_active,
      updated_at = now();

insert into public.rooms (id, name, room_number, capacity, description, is_active)
values
  ('20000000-0000-4000-8000-000000000001', 'Nexus A', '101', 8, '소규모 운영 회의용 샘플 회의실', true),
  ('20000000-0000-4000-8000-000000000002', 'Nexus B', '102', 12, '중간 규모 회의 및 리뷰용 샘플 회의실', true),
  ('20000000-0000-4000-8000-000000000003', 'Nexus C', '201', 16, '다부서 협업용 샘플 회의실', true)
on conflict (id) do update
  set name = excluded.name,
      room_number = excluded.room_number,
      capacity = excluded.capacity,
      description = excluded.description,
      is_active = excluded.is_active,
      updated_at = now();
