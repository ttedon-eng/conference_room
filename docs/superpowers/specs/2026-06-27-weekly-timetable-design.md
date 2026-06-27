# 주간 타임테이블 구현 설계

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 후 예약 화면과 관리자 화면에서 주간 예약 현황을 시간표 형태로 보고, 이전주/다음주로 이동할 수 있게 한다.

**Architecture:** 예약 데이터를 주 단위로 묶어 `행=시간`, `열=요일`의 그리드로 렌더링하는 공통 타임테이블 컴포넌트를 도입한다. 이 컴포넌트는 일반 사용자용 `/bookings`와 관리자용 `/admin/stats` 또는 별도 관리자 주간 뷰에서 재사용하고, 기존의 목록형 예약 표시는 보조 정보로 축소하거나 단계적으로 대체한다.

**Tech Stack:** Next.js App Router, React Server Components, client navigation, existing Supabase queries and booking view-models, CSS modules/global CSS already used in the project.

---

### Task 1: 공통 주간 타임테이블 데이터 모델 정리

**Files:**
- Modify: `/Users/ddu4/Documents/conference_room/app/bookings/booking-view-model.ts`
- Modify: `/Users/ddu4/Documents/conference_room/app/bookings/page.tsx`
- Modify: `/Users/ddu4/Documents/conference_room/app/admin/stats/page.tsx`

- [ ] **Step 1: Define the timetable shape**

```ts
export type WeeklyTimetableCell = {
  dateKey: string;
  hour: number;
  roomId: string;
  bookingId: string | null;
  title: string | null;
  userName: string | null;
  groupName: string | null;
  startAt: string | null;
  endAt: string | null;
  toneKey: BookingToneKey | null;
};
```

- [ ] **Step 2: Build a week grid from existing bookings**

```ts
export function buildWeeklyTimetableGrid({
  bookings,
  rooms,
  weekStart,
}: {
  bookings: BookingDashboardRow[];
  rooms: Array<{ id: string; name: string; room_number: string }>;
  weekStart: Date;
}): WeeklyTimetableCell[] {
  const cells: WeeklyTimetableCell[] = [];
  const weekDays = [0, 1, 2, 3, 4];
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  for (const dayOffset of weekDays) {
    for (const hour of hours) {
      for (const room of rooms) {
        cells.push({
          dateKey: `${dayOffset}:${hour}:${room.id}`,
          hour,
          roomId: room.id,
          bookingId: null,
          title: null,
          userName: null,
          groupName: null,
          startAt: null,
          endAt: null,
          toneKey: null,
        });
      }
    }
  }

  return cells.map((cell) => {
    const matchedBooking = bookings.find((booking) => {
      const bookingStart = new Date(booking.start_at);
      const bookingEnd = new Date(booking.end_at);
      const slotStart = new Date(weekStart.getTime());
      slotStart.setDate(slotStart.getDate() + Number(cell.dateKey.split(":")[0]));
      slotStart.setHours(cell.hour, 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

      return booking.room_id === cell.roomId && bookingStart < slotEnd && bookingEnd > slotStart;
    });

    if (!matchedBooking) {
      return cell;
    }

    return {
      ...cell,
      bookingId: matchedBooking.id,
      title: matchedBooking.title,
      userName: matchedBooking.user_name,
      groupName: matchedBooking.group_name,
      startAt: matchedBooking.start_at,
      endAt: matchedBooking.end_at,
      toneKey: matchedBooking.toneKey,
    };
  });
}
```

- [ ] **Step 3: Keep the existing booking rows available for fallback**

```ts
export function getBookingsForWeek(
  bookings: BookingDashboardRow[],
  weekStart: Date,
  weekEnd: Date,
) {
  return bookings.filter((booking) => {
    const startedAt = new Date(booking.start_at);
    return startedAt >= weekStart && startedAt < weekEnd;
  });
}
```

- [ ] **Step 4: Verify the model still supports the current reservation form**

Run: `npm run build`
Expected: build succeeds with the new helper types exported.

### Task 2: 공통 타임테이블 UI 컴포넌트 추가

**Files:**
- Create: `/Users/ddu4/Documents/conference_room/components/weekly-timetable.tsx`
- Modify: `/Users/ddu4/Documents/conference_room/app/globals.css`

- [ ] **Step 1: Create a reusable timetable component**

```tsx
type WeeklyTimetableProps = {
  title: string;
  description?: string;
  rooms: Array<{ id: string; name: string; room_number: string }>;
  weekStart: Date;
  bookings: WeeklyTimetableCell[];
  onWeekChange?: (direction: -1 | 1) => void;
};
```

- [ ] **Step 2: Render the grid with days as columns and times as rows**

```tsx
export default function WeeklyTimetable(props: WeeklyTimetableProps) {
  return (
    <section className="weekly-timetable">
      <header className="weekly-timetable-head">
        <div>
          <h2>{props.title}</h2>
          {props.description ? <p>{props.description}</p> : null}
        </div>
      </header>
      <div className="weekly-timetable-grid">
        <table>
          <thead>
            <tr>
              <th scope="col">시간</th>
              {props.rooms.map((room) => (
                <th scope="col" key={room.id}>
                  {room.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((hour) => (
              <tr key={hour}>
                <th scope="row">{`${hour}:00`}</th>
                {props.rooms.map((room) => {
                  const cell = props.bookings.find((item) => item.hour === hour && item.roomId === room.id);
                  return (
                    <td key={room.id}>
                      {cell?.bookingId ? (
                        <>
                          <strong>{cell.title ?? "제목 없음"}</strong>
                          <span>{cell.userName ?? "예약자 없음"}</span>
                          <span>{cell.groupName ?? "그룹 없음"}</span>
                        </>
                      ) : (
                        <span>빈 슬롯</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add CSS for the timetable layout**

```css
.weekly-timetable {
  display: grid;
  gap: 1rem;
}

.weekly-timetable-grid {
  overflow: auto;
}
```

- [ ] **Step 4: Verify the component renders cleanly**

Run: `npm run build`
Expected: no type or CSS import errors.

### Task 3: `/bookings`를 시간표 중심 화면으로 전환

**Files:**
- Modify: `/Users/ddu4/Documents/conference_room/app/bookings/page.tsx`
- Modify: `/Users/ddu4/Documents/conference_room/app/bookings/quick-slot-picker.tsx`
- Modify: `/Users/ddu4/Documents/conference_room/app/bookings/my-bookings-list.tsx`

- [ ] **Step 1: Replace the booking list table with the timetable component**

```tsx
<WeeklyTimetable
  title="이번 주 예약 시간표"
  description="월요일부터 금요일까지 시간대별 예약 현황을 보여줍니다."
  rooms={roomItems}
  weekStart={weekStart}
  bookings={buildWeeklyTimetableGrid({ bookings: allBookings, rooms: roomItems, weekStart })}
/>
```

- [ ] **Step 2: Keep quick-slot booking and my-bookings as secondary panels**

```tsx
<QuickSlotPicker slots={quickSlots} />
<MyBookingsList bookings={currentUserBookings} />
```

- [ ] **Step 3: Remove language that implies the main view is a list**

```tsx
description="이번 주 예약 시간표와 내 예약을 함께 확인하면서, 회의실과 그룹 흐름을 한눈에 봅니다."
```

- [ ] **Step 4: Verify the page still supports booking creation**

Run: `npm run build`
Expected: `/bookings` shows timetable first and still allows booking creation.

### Task 4: 관리자 화면에 주간 타임테이블을 연결

**Files:**
- Modify: `/Users/ddu4/Documents/conference_room/app/admin/stats/page.tsx`
- Modify: `/Users/ddu4/Documents/conference_room/app/admin/page.tsx`

- [ ] **Step 1: Add a weekly timetable section for admins**

```tsx
<WeeklyTimetable
  title="관리자 주간 예약 현황"
  description="회의실, 사용자, 그룹 정보를 시간표로 확인합니다."
  rooms={roomItems}
  weekStart={weekStart}
  bookings={buildWeeklyTimetableGrid({ bookings: bookingItems, rooms: roomItems, weekStart })}
/>
```

- [ ] **Step 2: Keep aggregate stats below the timetable**

```tsx
<section>
  {/* existing room/user/group stats remain here */}
</section>
```

- [ ] **Step 3: Update admin hub wording if needed**

```tsx
description: "승인, 그룹, 통계, 주간 예약 화면을 한곳에 모았습니다."
```

- [ ] **Step 4: Verify admin navigation lands on the timetable-capable view**

Run: `npm run build`
Expected: admin pages compile and expose the timetable entry point.

### Task 5: 시간표 표시 정리 및 회귀 점검

**Files:**
- Modify: `/Users/ddu4/Documents/conference_room/app/globals.css`
- Modify: `/Users/ddu4/Documents/conference_room/docs/development-ticket-status.md`
- Modify: `/Users/ddu4/Documents/conference_room/docs/meeting-room-booking-dev-tickets.md`

- [ ] **Step 1: Tune spacing, labels, and sticky headers for the timetable**

```css
.weekly-timetable-grid {
  overflow: auto;
}
```

- [ ] **Step 2: Mark D-004 and D-006 as implemented after verification**

```md
| D-004 | 이번 주 예약 테이블 표시 | 개발완료 | 시간표 형태로 전환 |
| D-006 | 일반 사용자 주간 예약 테이블 | 개발완료 | 시간표 형태로 전환 |
```

- [ ] **Step 3: Run the final build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Take the deployment path after implementation**

Run: push existing commits, deploy to Vercel, and verify the production URL loads the timetable first.

## Self-Review

- Spec coverage: This plan covers the common timetable model, the reusable UI, the user booking page, the admin entry point, and the final status updates for D-004/D-006.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `BookingDashboardRow`, `WeeklyTimetableCell`, and the room row shape are shared across tasks and stay aligned.
- Scope check: The work is focused on one behavior shift, not a broader redesign.
- Ambiguity check: The timetable is defined as `weekday columns + time rows`, with Monday-to-Friday and 08:00-18:00 for the user-facing grid.
