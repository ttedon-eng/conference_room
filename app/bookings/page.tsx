import DashboardShell from "@/components/dashboard-shell";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookingForm from "./booking-form";

type RoomRow = {
  id: string;
  name: string;
  room_number: string;
};

type BookingRow = {
  id: string;
  room_id: string;
  start_at: string;
  end_at: string;
  title: string | null;
  notes: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

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

  const [
    { data: rooms, error: roomsError },
    { data: bookings, error: bookingsError },
  ] = await Promise.all([
    supabase.from("rooms").select("id, name, room_number").order("name", { ascending: true }),
    supabase
      .from("bookings")
      .select("id, room_id, start_at, end_at, title, notes")
      .order("start_at", { ascending: true }),
  ]);

  if (roomsError) {
    throw roomsError;
  }

  if (bookingsError) {
    throw bookingsError;
  }

  const currentUserId = user.id;
  const roomItems = (rooms ?? []) as RoomRow[];
  const bookingItems = (bookings ?? []) as BookingRow[];
  const roomLabelById = new Map(roomItems.map((room) => [room.id, room]));

  return (
    <DashboardShell
      eyebrow="Bookings"
      title="예약 관리"
      description="현재 예약 현황을 확인하고, 새 예약을 빠르게 추가하는 첫 번째 화면입니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <div className="section-head">
            <p className="eyebrow">List</p>
            <h2>예약 목록</h2>
          </div>

          {bookingItems.length > 0 ? (
            <div className="resource-list">
              {bookingItems.map((booking) => {
                const room = roomLabelById.get(booking.room_id);

                return (
                  <article className="resource-item" key={booking.id}>
                    <div className="resource-item-top">
                      <div>
                        <h3>{booking.title || "제목 없음"}</h3>
                        <p className="resource-subtitle">
                          {room ? `${room.name} · Room ${room.room_number}` : "회의실 정보 없음"}
                        </p>
                      </div>
                      <span className="status-pill">예약됨</span>
                    </div>

                    <div className="resource-meta">
                      <span>{dateTimeFormatter.format(new Date(booking.start_at))}</span>
                      <span>{dateTimeFormatter.format(new Date(booking.end_at))}</span>
                    </div>

                    {booking.notes ? <p className="resource-copy">{booking.notes}</p> : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="resource-empty">아직 예약이 없습니다. 오른쪽 폼으로 첫 예약을 추가하세요.</p>
          )}
        </article>

        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">Create</p>
            <h2>예약 추가</h2>
          </div>
          <p className="resource-note">회의실을 고른 뒤 시작/종료 시간을 넣으면 됩니다. 입력값은 그대로 Supabase에 전달합니다.</p>
          <BookingForm currentUserId={currentUserId} rooms={roomItems} />
        </aside>
      </section>
    </DashboardShell>
  );
}
