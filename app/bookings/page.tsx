import DashboardShell from "@/components/dashboard-shell";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/server";
import BookingForm from "./booking-form";
import MyBookingsList from "./my-bookings-list";
import {
  BOOKING_TONES,
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

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

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

export default async function BookingsPage() {
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

  const { weekStart, weekEnd } = getSeoulWeekBounds();

  const [
    { data: roomRowsData, error: roomRowsError },
    { data: bookingRowsData, error: bookingRowsError },
    { data: groupRowsData, error: groupRowsError },
  ] = await Promise.all([
    supabase.from("rooms").select("id, name, room_number").order("name", { ascending: true }),
    supabase.rpc("get_booking_dashboard_rows"),
    supabase.rpc("list_booking_groups"),
  ]);

  if (roomRowsError) {
    throw roomRowsError;
  }

  if (bookingRowsError) {
    throw bookingRowsError;
  }

  if (groupRowsError) {
    throw groupRowsError;
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

  const currentWeekBookings = allBookings.filter((booking) => {
    const startedAt = new Date(booking.start_at);
    return startedAt >= weekStart && startedAt < weekEnd;
  });

  const currentUserBookings = allBookings.filter((booking) => booking.user_id === user.id);
  const currentWeekMinutes = currentWeekBookings.reduce(
    (total, booking) => total + getBookingDurationMinutes(booking),
    0,
  );

  return (
    <DashboardShell
      eyebrow="Bookings"
      title="예약 관리"
      description="이번 주 예약 테이블과 내 예약을 함께 확인하면서, 회의실과 그룹 흐름을 한눈에 봅니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <div className="section-head">
            <p className="eyebrow">Week View</p>
            <h2>이번 주 예약 테이블</h2>
          </div>
          <p className="resource-note">
            서울시간 기준 월요일 00:00부터 일요일 24:00까지의 예약을 표시합니다. 그룹 색상은 색상 범례와
            표 행에 함께 반영됩니다.
          </p>

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

          {currentWeekBookings.length > 0 ? (
            <div className="booking-table-shell">
              <table className="booking-table">
                <thead>
                  <tr>
                    <th scope="col">시간</th>
                    <th scope="col">회의실</th>
                    <th scope="col">예약자</th>
                    <th scope="col">그룹</th>
                    <th scope="col">제목</th>
                  </tr>
                </thead>
                <tbody>
                  {currentWeekBookings.map((booking) => {
                    const tone = BOOKING_TONES[booking.toneKey];

                    return (
                      <tr
                        key={booking.id}
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
                        <td>
                          <span className="booking-time-range">
                            {dateTimeFormatter.format(new Date(booking.start_at))}
                            <span>→</span>
                            {dateTimeFormatter.format(new Date(booking.end_at))}
                          </span>
                        </td>
                        <td>
                          <strong>{booking.room_name}</strong>
                          <span className="booking-cell-subtitle">Room {booking.room_number}</span>
                        </td>
                        <td>
                          <strong>{booking.user_name}</strong>
                          <span className="booking-cell-subtitle">{booking.user_email}</span>
                        </td>
                        <td>
                          <span className="booking-group-chip">{booking.group_name || "그룹 없음"}</span>
                        </td>
                        <td>
                          <strong>{booking.title || "제목 없음"}</strong>
                          {booking.notes ? <span className="booking-cell-subtitle">{booking.notes}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="resource-empty">이번 주에 표시할 예약이 아직 없습니다.</p>
          )}

          <div className="own-bookings-section">
            <div className="section-head">
              <p className="eyebrow">Mine</p>
              <h2>내 예약</h2>
            </div>
            <p className="resource-note">
              내가 만든 예약만 보여줍니다. 삭제는 한 번 더 확인한 뒤에만 진행됩니다.
            </p>
            <MyBookingsList bookings={currentUserBookings} />
          </div>
        </article>

        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">Create</p>
            <h2>예약 추가</h2>
          </div>
          <p className="resource-note">
            회의실을 고른 뒤 시작/종료 시간을 넣으면 됩니다. 입력값은 그대로 Supabase에 전달합니다.
          </p>
          <BookingForm currentUserId={user.id} rooms={roomItems} />
        </aside>
      </section>
    </DashboardShell>
  );
}
