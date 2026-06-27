"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { BOOKING_TONES, type BookingDashboardRow } from "./booking-view-model";

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

type BookingListRow = BookingDashboardRow;

export default function MyBookingsList({
  bookings,
}: {
  bookings: BookingListRow[];
}) {
  const router = useRouter();
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
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "예약 삭제에 실패했습니다.");
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
        const tone = BOOKING_TONES[booking.toneKey];
        const isPendingDelete = pendingDeleteId === booking.id;
        const isDeleting = deletingId === booking.id;

        return (
          <article
            className="resource-item booking-accented"
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
            <div className="resource-item-top">
              <div>
                <h3>{booking.title || "제목 없음"}</h3>
                <p className="resource-subtitle">
                  {booking.room_name} · Room {booking.room_number}
                </p>
              </div>
              <span className="status-pill is-owner">
                {booking.series_id ? `정기 ${booking.occurrence_index ?? 1}회차` : booking.group_name || "그룹 없음"}
              </span>
            </div>

            <div className="resource-meta">
              <span>{dateTimeFormatter.format(new Date(booking.start_at))}</span>
              <span>{dateTimeFormatter.format(new Date(booking.end_at))}</span>
            </div>

            <p className="resource-copy">
              예약자 {booking.user_name} · {booking.user_email}
            </p>

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
