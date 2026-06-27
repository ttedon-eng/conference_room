import DashboardShell from "@/components/dashboard-shell";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoomsClient from "./rooms-client";
import type { RoomRow } from "./types";

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

  const isAdmin = profile?.role === "admin";

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

  const roomItems = (rooms ?? []) as RoomRow[];
  const currentUserId = user.id;

  return (
    <DashboardShell
      eyebrow="Rooms"
      title="회의실 관리"
      description={
        isAdmin
          ? "현재 등록된 회의실을 보고, 필요한 경우 새 회의실을 추가하거나 수정할 수 있습니다."
          : "현재 등록된 회의실을 보고, 사용 가능한 공간만 확인할 수 있습니다."
      }
    >
      <RoomsClient currentUserId={currentUserId} isAdmin={isAdmin} rooms={roomItems} />
    </DashboardShell>
  );
}
