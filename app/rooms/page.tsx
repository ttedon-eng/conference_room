import DashboardShell from "@/components/dashboard-shell";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoomForm from "./room-form";

type RoomRow = {
  id: string;
  name: string;
  room_number: string;
  capacity: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export default async function RoomsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/login?next=%2Frooms");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_approved && profile?.role !== "admin") {
    redirect("/pending?next=%2Frooms");
  }

  const [
    { data: rooms, error },
  ] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, name, room_number, capacity, description, is_active, created_at")
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
  ]);

  if (error) {
    throw error;
  }

  const currentUserId = user.id;
  const roomItems = (rooms ?? []) as RoomRow[];

  return (
    <DashboardShell
      eyebrow="Rooms"
      title="회의실 관리"
      description="현재 등록된 회의실을 보고, 필요한 경우 새 회의실을 추가하는 첫 번째 화면입니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <div className="section-head">
            <p className="eyebrow">List</p>
            <h2>회의실 목록</h2>
          </div>

          {roomItems.length > 0 ? (
            <div className="resource-list">
              {roomItems.map((room) => (
                <article className="resource-item" key={room.id}>
                  <div className="resource-item-top">
                    <div>
                      <h3>{room.name}</h3>
                      <p className="resource-subtitle">Room {room.room_number}</p>
                    </div>
                    <span className={`status-pill ${room.is_active ? "is-active" : "is-inactive"}`}>
                      {room.is_active ? "사용 중" : "비활성"}
                    </span>
                  </div>

                  <div className="resource-meta">
                    <span>{room.capacity}명</span>
                    <span>{new Date(room.created_at).toLocaleDateString("ko-KR")}</span>
                  </div>

                  {room.description ? <p className="resource-copy">{room.description}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="resource-empty">아직 등록된 회의실이 없습니다. 오른쪽 폼으로 첫 회의실을 추가하세요.</p>
          )}
        </article>

        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">Create</p>
            <h2>회의실 추가</h2>
          </div>
          <p className="resource-note">관리자만 실제로 저장할 수 있습니다. 이름, 번호, 수용 인원만 먼저 채우면 됩니다.</p>
          <RoomForm currentUserId={currentUserId} />
        </aside>
      </section>
    </DashboardShell>
  );
}
