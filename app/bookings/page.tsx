import DashboardShell from "@/components/dashboard-shell";
import WeeklyTimetable from "@/components/weekly-timetable";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/server";
import BookingForm from "./booking-form";
import MyBookingsList from "./my-bookings-list";
import QuickSlotPicker from "./quick-slot-picker";
import {
  BOOKING_TONES,
  buildWeeklyTimetableGrid,
  getBookingsForWeek,
  getBookingToneKey,
  type BookingDashboardRow,
  type BookingGroupRow,
} from "./booking-view-model";

const BOOKINGS_PAGE = "/bookings";

type RoomRow = {
  id: string;
  name: string;
  room_number: string;
};

function formatSeoulDateTimeLocal(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function createQuickSlots(referenceWeekStart: Date, roomId: string) {
  const dayOffsets = [0, 1, 2, 3, 4];
  const hours = [9, 11, 14, 16];
  const slots: Array<{ label: string; roomId: string; startAt: string; endAt: string }> = [];
  const dayFormatter = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });

  for (const dayOffset of dayOffsets) {
    for (const hour of hours) {
      const start = addMinutes(referenceWeekStart, 9 * 60 + dayOffset * 24 * 60 + hour * 60);
      const end = addMinutes(start, 30);

      slots.push({
        label: `${dayFormatter.format(start)} ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`,
        roomId,
        startAt: formatSeoulDateTimeLocal(start),
        endAt: formatSeoulDateTimeLocal(end),
      });
    }
  }

  return slots;
}

function getSeoulWeekBounds(referenceDate = new Date()) {
  const seoulNow = new Date(referenceDate.getTime() + 9 * 60 * 60 * 1000);
  const seoulDay = seoulNow.getUTCDay();
  const daysSinceMonday = (seoulDay + 6) % 7;
  const mondaySeoulMidnight = new Date(
    Date.UTC(
      seoulNow.getUTCFullYear(),
      seoulNow.getUTCMonth(),
      seoulNow.getUTCDate() - daysSinceMonday,
      0,
      0,
      0,
      0,
    ),
  );

  const weekStart = new Date(mondaySeoulMidnight.getTime() - 9 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  return { weekStart, weekEnd };
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes <= 0) {
    return "0분";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}분`;
  }

  if (minutes === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${minutes}분`;
}

function getBookingDurationMinutes(booking: BookingDashboardRow) {
  return Math.round((new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 60000);
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams?: {
    week?: string | string[];
    roomId?: string | string[];
    startAt?: string | string[];
    endAt?: string | string[];
    title?: string | string[];
    notes?: string | string[];
    repeatCount?: string | string[];
  };
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/login?next=%2Fbookings");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_approved && profile?.role !== "admin") {
    redirect("/pending?next=%2Fbookings");
  }

  const weekValue = Array.isArray(searchParams?.week) ? searchParams?.week[0] : searchParams?.week;
  const weekOffset = Number(weekValue ?? "0") || 0;
  const { weekStart, weekEnd } = getSeoulWeekBounds(
    new Date(Date.now() + weekOffset * 7 * 24 * 60 * 60 * 1000),
  );

  const [
    { data: roomRowsData, error: roomRowsError },
    { data: bookingRowsData, error: bookingRowsError },
    { data: groupRowsData, error: groupRowsError },
  ] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, name, room_number")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.rpc("get_booking_dashboard_rows"),
    supabase.rpc("list_booking_groups"),
  ]);

  const warnings = [] as string[];
  if (roomRowsError) {
    warnings.push("회의실 목록을 불러오지 못했습니다.");
  }

  if (bookingRowsError) {
    warnings.push("예약 현황을 불러오지 못했습니다.");
  }

  if (groupRowsError) {
    warnings.push("그룹 목록을 불러오지 못했습니다.");
  }

  const allBookings = ((bookingRowsData ?? []) as Omit<BookingDashboardRow, "toneKey">[]).map((booking) => ({
    ...booking,
    toneKey: getBookingToneKey(booking.group_id ?? booking.user_id),
  })) satisfies BookingDashboardRow[];

  const groupItems = ((groupRowsData ?? []) as Omit<BookingGroupRow, "toneKey">[]).map((group) => ({
    ...group,
    toneKey: getBookingToneKey(group.id),
  })) satisfies BookingGroupRow[];

  const roomItems = (roomRowsData ?? []) as RoomRow[];

  const currentWeekBookings = getBookingsForWeek(allBookings, weekStart, weekEnd);
  const timetableCells = buildWeeklyTimetableGrid({
    bookings: currentWeekBookings,
    weekStart,
  });

  const currentUserBookings = allBookings.filter((booking) => booking.user_id === user.id);
  const currentWeekMinutes = currentWeekBookings.reduce(
    (total, booking) => total + getBookingDurationMinutes(booking),
    0,
  );
  const roomIdValue = Array.isArray(searchParams?.roomId) ? searchParams?.roomId[0] : searchParams?.roomId;
  const startAtValue = Array.isArray(searchParams?.startAt) ? searchParams?.startAt[0] : searchParams?.startAt;
  const endAtValue = Array.isArray(searchParams?.endAt) ? searchParams?.endAt[0] : searchParams?.endAt;
  const titleValue = Array.isArray(searchParams?.title) ? searchParams?.title[0] : searchParams?.title;
  const notesValue = Array.isArray(searchParams?.notes) ? searchParams?.notes[0] : searchParams?.notes;
  const repeatCountValue = Array.isArray(searchParams?.repeatCount)
    ? searchParams?.repeatCount[0]
    : searchParams?.repeatCount;

  const quickSlots = roomItems.length ? createQuickSlots(weekStart, roomItems[0].id) : [];
  const previousWeekHref = `${BOOKINGS_PAGE}?week=${weekOffset - 1}`;
  const nextWeekHref = `${BOOKINGS_PAGE}?week=${weekOffset + 1}`;

  return (
    <DashboardShell
      eyebrow="예약"
      title="예약 관리"
      description="이번 주 예약 시간표와 내 예약을 함께 확인하면서, 회의실과 그룹 흐름을 한눈에 봅니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <WeeklyTimetable
            title="이번 주 예약 시간표"
            description="월요일부터 금요일까지 08:00-18:00 사이의 예약을 시간표 형태로 보여줍니다."
            weekStart={weekStart}
            previousWeekHref={previousWeekHref}
            nextWeekHref={nextWeekHref}
            cells={timetableCells}
          />
          {warnings.length ? (
            <div className="resource-note">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <div className="stats-summary">
            <div className="stat-card">
              <span className="stat-label">이번 주 예약</span>
              <strong>{currentWeekBookings.length}건</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">이번 주 예약 시간</span>
              <strong>{formatMinutes(currentWeekMinutes)}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">내 예약</span>
              <strong>{currentUserBookings.length}건</strong>
            </div>
          </div>

          {groupItems.length ? (
            <div className="booking-legend" aria-label="그룹 색상 범례">
              {groupItems.map((group) => {
                const tone = BOOKING_TONES[group.toneKey];

                return (
                  <span
                    className={`booking-legend-item ${group.is_active ? "" : "is-inactive"}`}
                    key={group.id}
                    style={
                      {
                        "--booking-accent": tone.accent,
                        "--booking-border": tone.border,
                        "--booking-soft": tone.soft,
                        "--booking-ink": tone.ink,
                        "--booking-bg": tone.background,
                      } as CSSProperties
                    }
                  >
                    <span className="booking-legend-swatch" />
                    {group.name}
                  </span>
                );
              })}
            </div>
          ) : null}

          <div className="own-bookings-section">
            <div className="section-head">
              <p className="eyebrow">내 예약</p>
              <h2>내 예약</h2>
            </div>
            <p className="resource-note">
              내가 만든 예약만 보여줍니다. 삭제는 한 번 더 확인한 뒤에만 진행됩니다.
            </p>
            <MyBookingsList bookings={currentUserBookings} />
          </div>
        </article>

        <aside className="resource-panel">
          <QuickSlotPicker slots={quickSlots} weekOffset={weekOffset} />

          <div className="section-head">
            <p className="eyebrow">추가</p>
            <h2>예약 추가</h2>
          </div>
          <p className="resource-note">
            회의실을 고른 뒤 시작/종료 시간을 넣으면 됩니다. 입력값은 그대로 Supabase에 전달합니다.
          </p>
          <BookingForm
            currentUserId={user.id}
            rooms={roomItems}
            initialValues={{
              roomId: roomIdValue ?? roomItems[0]?.id,
              startAt: startAtValue ?? "",
              endAt: endAtValue ?? "",
              title: titleValue ?? "",
              notes: notesValue ?? "",
              repeatCount: repeatCountValue ? Number(repeatCountValue) : 1,
            }}
          />
        </aside>
      </section>
    </DashboardShell>
  );
}
