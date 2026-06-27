import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";

type RoomRow = {
  id: string;
  name: string;
  room_number: string;
};

type BookingRow = {
  id: string;
  user_id: string;
  room_id: string;
  start_at: string;
  end_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  role: "user" | "admin";
  is_approved: boolean;
  group_id: string | null;
};

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type AuditLogRow = {
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};

type EmailLogRow = {
  id: number;
  booking_id: string | null;
  notification_type: "booking_created" | "booking_deleted" | "profile_rejected";
  recipient_email: string;
  subject: string;
  status: "success" | "failure";
  error_message: string | null;
  created_at: string;
};

const STATS_PAGE = "/admin/stats";
const ACCOUNT_PAGE = "/account";

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

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
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

function getBookingDurationMinutes(booking: BookingRow) {
  return Math.round((new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 60000);
}

function getEmailNotificationLabel(notificationType: EmailLogRow["notification_type"]) {
  switch (notificationType) {
    case "booking_created":
      return "예약 생성";
    case "booking_deleted":
      return "예약 삭제";
    case "profile_rejected":
      return "승인 거부";
  }
}

export default async function AdminStatsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(STATS_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? ACCOUNT_PAGE : `/pending?next=${encodeURIComponent(STATS_PAGE)}`);
  }

  const { weekStart, weekEnd } = getSeoulWeekBounds();

  const [
    { data: rooms, error: roomsError },
    { data: bookings, error: bookingsError },
    { data: groups, error: groupsError },
    { data: profiles, error: profilesError },
    { data: auditLogs, error: auditLogsError },
    { data: emailLogs, error: emailLogsError },
  ] = await Promise.all([
    supabase.from("rooms").select("id, name, room_number").order("name", { ascending: true }),
    supabase
      .from("bookings")
      .select("id, user_id, room_id, start_at, end_at")
      .order("start_at", { ascending: false }),
    supabase
      .from("groups")
      .select("id, name, description, is_active")
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, is_approved, group_id")
      .order("full_name", { ascending: true }),
    supabase
      .from("audit_logs")
      .select("actor_id, action, entity_type, entity_id, created_at")
      .eq("action", "booking_deleted")
      .eq("entity_type", "booking")
      .order("created_at", { ascending: false }),
    supabase
      .from("email_delivery_logs")
      .select("id, booking_id, notification_type, recipient_email, subject, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (roomsError) {
    throw roomsError;
  }

  if (bookingsError) {
    throw bookingsError;
  }

  if (groupsError) {
    throw groupsError;
  }

  if (profilesError) {
    throw profilesError;
  }

  if (auditLogsError) {
    throw auditLogsError;
  }

  if (emailLogsError) {
    throw emailLogsError;
  }

  const roomItems = (rooms ?? []) as RoomRow[];
  const bookingItems = (bookings ?? []) as BookingRow[];
  const groupItems = (groups ?? []) as GroupRow[];
  const profileItems = (profiles ?? []) as ProfileRow[];
  const auditLogItems = (auditLogs ?? []) as AuditLogRow[];
  const emailLogItems = (emailLogs ?? []) as EmailLogRow[];
  const currentWeekBookings = bookingItems.filter((booking) => {
    const startedAt = new Date(booking.start_at);
    return startedAt >= weekStart && startedAt < weekEnd;
  });
  const currentWeekCancellations = auditLogItems.filter((log) => {
    const createdAt = new Date(log.created_at);
    return createdAt >= weekStart && createdAt < weekEnd;
  });

  const roomStats = roomItems
    .map((room) => {
      const bookingsForRoom = bookingItems.filter((booking) => booking.room_id === room.id);
      const bookingCount = bookingsForRoom.length;
      const occupancyMinutes = bookingsForRoom.reduce((total, booking) => total + getBookingDurationMinutes(booking), 0);

      return {
        ...room,
        bookingCount,
        occupancyMinutes,
      };
    })
    .sort((left, right) => right.bookingCount - left.bookingCount || right.occupancyMinutes - left.occupancyMinutes);

  const groupStats = groupItems
    .map((group) => {
      const members = profileItems.filter((profileItem) => profileItem.group_id === group.id);
      const memberIds = new Set(members.map((member) => member.id));
      const groupBookings = bookingItems.filter((booking) => memberIds.has(booking.user_id));
      const bookingCount = groupBookings.length;
      const occupancyMinutes = groupBookings.reduce(
        (total, booking) => total + getBookingDurationMinutes(booking),
        0,
      );

      return {
        ...group,
        memberCount: members.length,
        bookingCount,
        occupancyMinutes,
      };
    })
    .sort((left, right) => right.memberCount - left.memberCount || right.bookingCount - left.bookingCount);

  const userStats = profileItems
    .filter((profileItem) => profileItem.is_approved || profileItem.role === "admin")
    .map((profileItem) => {
      const userBookings = currentWeekBookings.filter((booking) => booking.user_id === profileItem.id);
      const weeklyBookingCount = userBookings.length;
      const weeklyBookingMinutes = userBookings.reduce(
        (total, booking) => total + getBookingDurationMinutes(booking),
        0,
      );
      const cancellationCount = currentWeekCancellations.filter(
        (log) => log.actor_id === profileItem.id,
      ).length;

      return {
        ...profileItem,
        displayName: profileItem.full_name?.trim() || profileItem.email,
        weeklyBookingCount,
        weeklyBookingMinutes,
        cancellationCount,
      };
    })
    .sort(
      (left, right) =>
        right.weeklyBookingMinutes - left.weeklyBookingMinutes ||
        right.weeklyBookingCount - left.weeklyBookingCount ||
        right.cancellationCount - left.cancellationCount,
    );

  const totalRoomBookings = bookingItems.length;
  const totalOccupancyMinutes = bookingItems.reduce(
    (total, booking) => total + getBookingDurationMinutes(booking),
    0,
  );
  const totalWeeklyBookings = currentWeekBookings.length;
  const totalWeeklyCancellations = currentWeekCancellations.length;

  return (
    <DashboardShell
      eyebrow="Admin Stats"
      title="예약 통계"
      description="현재 스키마에서 계산 가능한 예약 통계를 한 화면에 모았습니다. 회의실별 집계, 사용자별 주간 집계, 그룹별 집계를 모두 확인할 수 있습니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <div className="section-head">
            <p className="eyebrow">Rooms</p>
            <h2>회의실별 예약 통계</h2>
          </div>
          <p className="resource-note">
            예약 건수는 전체 기간 기준, 점유 시간은 예약 시작/종료 시간 차이를 분 단위로 합산했습니다.
          </p>

          {roomStats.length > 0 ? (
            <div className="resource-list">
              {roomStats.map((room) => (
                <article className="resource-item" key={room.id}>
                  <div className="resource-item-top">
                    <div>
                      <h3>{room.name}</h3>
                      <p className="resource-subtitle">Room {room.room_number}</p>
                    </div>
                    <span className="status-pill is-active">{formatCount(room.bookingCount)}건</span>
                  </div>

                  <div className="resource-meta">
                    <span>예약 {formatCount(room.bookingCount)}건</span>
                    <span>점유 {formatMinutes(room.occupancyMinutes)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="resource-empty">집계할 예약이 아직 없습니다.</p>
          )}
        </article>

        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">Users</p>
            <h2>사용자별 주간 예약 통계</h2>
          </div>
          <p className="resource-note">
            이번 주 월요일 00:00(서울시간)부터 지금까지의 예약 건수, 예약 시간, 취소 건수를 표시합니다.
          </p>

          <div className="stats-summary">
            <div className="stat-card">
              <span className="stat-label">주간 예약</span>
              <strong>{formatCount(totalWeeklyBookings)}건</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">주간 예약 시간</span>
              <strong>{formatMinutes(
                currentWeekBookings.reduce((total, booking) => total + getBookingDurationMinutes(booking), 0),
              )}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">주간 취소</span>
              <strong>{formatCount(totalWeeklyCancellations)}건</strong>
            </div>
          </div>

          {userStats.length > 0 ? (
            <div className="resource-list">
              {userStats.map((item) => (
                <article className="resource-item" key={item.id}>
                  <div className="resource-item-top">
                    <div>
                      <h3>{item.displayName}</h3>
                      <p className="resource-subtitle">{item.email}</p>
                    </div>
                    <span className="status-pill is-owner">
                      {item.role === "admin" ? "관리자" : "사용자"}
                    </span>
                  </div>

                  <div className="resource-meta">
                    <span>예약 {formatCount(item.weeklyBookingCount)}건</span>
                    <span>시간 {formatMinutes(item.weeklyBookingMinutes)}</span>
                    <span>취소 {formatCount(item.cancellationCount)}건</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="resource-empty">이번 주에 집계할 사용자 통계가 아직 없습니다.</p>
          )}
        </aside>
      </section>

      <section className="resource-panel resource-panel-wide">
        <div className="section-head">
          <p className="eyebrow">Groups</p>
          <h2>그룹별 예약 통계</h2>
        </div>
        <p className="resource-copy">
          현재 프로필의 `group_id`를 기준으로 그룹별 예약 건수, 누적 예약 시간, 그룹 인원을 집계합니다.
        </p>
        <div className="resource-meta">
          <span>기준: profiles.group_id</span>
          <span>집계: 그룹별 예약 건수 / 누적 예약 시간</span>
          <span>인원: 현재 그룹별 사용자 수</span>
        </div>

        {groupStats.length > 0 ? (
          <div className="resource-list">
            {groupStats.map((group) => (
              <article className="resource-item" key={group.id}>
                <div className="resource-item-top">
                  <div>
                    <h3>{group.name}</h3>
                    <p className="resource-subtitle">
                      {group.is_active ? "활성 그룹" : "비활성 그룹"}
                    </p>
                  </div>
                  <span className="status-pill is-active">{formatCount(group.memberCount)}명</span>
                </div>

                <div className="resource-meta">
                  <span>예약 {formatCount(group.bookingCount)}건</span>
                  <span>점유 {formatMinutes(group.occupancyMinutes)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="resource-empty">등록된 그룹이 없어서 집계할 수 없습니다.</p>
        )}
      </section>

      <section className="resource-panel resource-panel-wide">
        <div className="section-head">
          <p className="eyebrow">Reference</p>
          <h2>집계 기준 요약</h2>
        </div>
        <div className="resource-list">
          <article className="resource-item">
            <div className="resource-item-top">
              <div>
                <h3>전체 예약 데이터</h3>
                <p className="resource-subtitle">bookings 테이블 기준</p>
              </div>
              <span className="status-pill">{formatCount(totalRoomBookings)}건</span>
            </div>
            <div className="resource-meta">
              <span>총 점유 {formatMinutes(totalOccupancyMinutes)}</span>
              <span>현재 주간 예약 {formatCount(totalWeeklyBookings)}건</span>
              <span>현재 주간 취소 {formatCount(totalWeeklyCancellations)}건</span>
            </div>
          </article>
          <article className="resource-item">
            <div className="resource-item-top">
              <div>
                <h3>취소 집계 기준</h3>
                <p className="resource-subtitle">audit_logs의 booking_deleted 이벤트</p>
              </div>
              <span className="status-pill is-inactive">서버 추적</span>
            </div>
            <p className="resource-copy">
              예약 삭제 시점마다 서버에서 감사 로그를 남기고, 그 로그의 actor_id를 기준으로 사용자별 취소
              건수를 계산합니다.
            </p>
          </article>
        </div>
      </section>

      <section className="resource-panel resource-panel-wide">
        <div className="section-head">
          <p className="eyebrow">Email</p>
          <h2>이메일 발송 로그</h2>
        </div>
        <p className="resource-note">
          예약 생성과 삭제 시도마다 발송 결과를 저장합니다. 실패하더라도 예약은 계속 진행됩니다.
        </p>

        {emailLogItems.length > 0 ? (
          <div className="resource-list">
            {emailLogItems.map((log) => (
              <article className="resource-item" key={log.id}>
                <div className="resource-item-top">
                  <div>
                    <h3>{log.subject}</h3>
                    <p className="resource-subtitle">{log.recipient_email}</p>
                  </div>
                  <span className={`status-pill ${log.status === "success" ? "is-active" : "is-inactive"}`}>
                    {log.status === "success" ? "전송됨" : "실패"}
                  </span>
                </div>

                <div className="resource-meta">
                  <span>{getEmailNotificationLabel(log.notification_type)}</span>
                  <span>{new Date(log.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
                </div>

                {log.error_message ? <p className="resource-copy">{log.error_message}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="resource-empty">아직 이메일 발송 로그가 없습니다.</p>
        )}
      </section>
    </DashboardShell>
  );
}
