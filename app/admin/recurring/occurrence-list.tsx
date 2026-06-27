"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OccurrenceRow = {
  id: string;
  occurrence_index: number;
  start_at: string;
  end_at: string;
  title: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export default function RecurringOccurrenceList({
  seriesId,
  occurrences,
}: {
  seriesId: string;
  occurrences: OccurrenceRow[];
}) {
  const router = useRouter();
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const cancelOccurrence = async (bookingId: string) => {
    const confirmed = window.confirm("이 회차만 삭제할까요? 삭제 시 이메일 알림이 발송됩니다.");

    if (!confirmed) {
      return;
    }

    setPendingBookingId(bookingId);
    setMessage(null);

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "회차 삭제에 실패했습니다.");
      }

      setMessage("회차를 삭제했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "회차 삭제에 실패했습니다.");
    } finally {
      setPendingBookingId(null);
    }
  };

  if (occurrences.length === 0) {
    return <p className="resource-empty">표시할 회차가 없습니다.</p>;
  }

  return (
    <div className="resource-list">
      {occurrences.map((occurrence) => (
        <article className="resource-item" key={`${seriesId}-${occurrence.id}`}>
          <div className="resource-item-top">
            <div>
              <h3>{occurrence.title || "제목 없음"}</h3>
              <p className="resource-subtitle">회차 {occurrence.occurrence_index}</p>
            </div>
            <span className="status-pill is-owner">개별 회차</span>
          </div>

          <div className="resource-meta">
            <span>{dateFormatter.format(new Date(occurrence.start_at))}</span>
            <span>{dateFormatter.format(new Date(occurrence.end_at))}</span>
          </div>

          <div className="resource-actions">
            <button
              type="button"
              className="danger-outline"
              onClick={() => cancelOccurrence(occurrence.id)}
              disabled={pendingBookingId === occurrence.id}
            >
              {pendingBookingId === occurrence.id ? "삭제 중..." : "회차 삭제"}
            </button>
          </div>
        </article>
      ))}

      {message ? <p className="resource-message">{message}</p> : null}
    </div>
  );
}
