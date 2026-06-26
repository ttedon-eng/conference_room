"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  title: string | null;
  notes: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export default function MyBookingsList({
  currentUserId,
  bookings,
  rooms,
}: {
  currentUserId: string;
  bookings: BookingRow[];
  rooms: RoomRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const roomLabelById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const cancelDelete = () => {
    setPendingDeleteId(null);
    setMessage(null);
  };

  const confirmDelete = async (bookingId: string) => {
    setDeletingId(bookingId);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", bookingId)
        .eq("user_id", currentUserId);

      if (error) {
        throw error;
      }

      setPendingDeleteId(null);
      setMessage("예약을 삭제했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "예약 삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  if (bookings.length === 0) {
    return <p className="resource-empty">아직 내가 만든 예약이 없습니다.</p>;
  }

  return (
    <div className="resource-list">
      {bookings.map((booking) => {
        const room = roomLabelById.get(booking.room_id);
        const isPendingDelete = pendingDeleteId === booking.id;
        const isDeleting = deletingId === booking.id;

        return (
          <article className="resource-item" key={booking.id}>
            <div className="resource-item-top">
              <div>
                <h3>{booking.title || "제목 없음"}</h3>
                <p className="resource-subtitle">
                  {room ? `${room.name} · Room ${room.room_number}` : "회의실 정보 없음"}
                </p>
              </div>
              <span className="status-pill is-owner">내 예약</span>
            </div>

            <div className="resource-meta">
              <span>{dateTimeFormatter.format(new Date(booking.start_at))}</span>
              <span>{dateTimeFormatter.format(new Date(booking.end_at))}</span>
            </div>

            {booking.notes ? <p className="resource-copy">{booking.notes}</p> : null}

            {isPendingDelete ? (
              <div className="delete-confirm">
                <p>이 예약을 삭제할까요? 이 작업은 되돌릴 수 없습니다.</p>
                <div className="resource-actions">
                  <button type="button" className="ghost-button" onClick={cancelDelete} disabled={isDeleting}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => confirmDelete(booking.id)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "삭제 중..." : "최종 삭제"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="resource-actions">
                <button
                  type="button"
                  className="ghost-button danger-outline"
                  onClick={() => setPendingDeleteId(booking.id)}
                >
                  삭제
                </button>
              </div>
            )}
          </article>
        );
      })}

      {message ? <p className="resource-message">{message}</p> : null}
    </div>
  );
}
