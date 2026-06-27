"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type RoomOption = {
  id: string;
  name: string;
  room_number: string;
};

type BookingFormInitialValues = {
  roomId?: string;
  startAt?: string;
  endAt?: string;
  title?: string;
  notes?: string;
  repeatCount?: number;
};

function toIsoString(datetimeLocal: string) {
  return new Date(datetimeLocal).toISOString();
}

export default function BookingForm({
  currentUserId,
  rooms,
  initialValues,
}: {
  currentUserId: string | null;
  rooms: RoomOption[];
  initialValues?: BookingFormInitialValues;
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState(initialValues?.roomId ?? rooms[0]?.id ?? "");
  const [startAt, setStartAt] = useState(initialValues?.startAt ?? "");
  const [endAt, setEndAt] = useState(initialValues?.endAt ?? "");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [repeatCount, setRepeatCount] = useState(initialValues?.repeatCount ?? 1);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRoomId(initialValues?.roomId ?? rooms[0]?.id ?? "");
    setStartAt(initialValues?.startAt ?? "");
    setEndAt(initialValues?.endAt ?? "");
    setTitle(initialValues?.title ?? "");
    setNotes(initialValues?.notes ?? "");
    setRepeatCount(initialValues?.repeatCount ?? 1);
  }, [initialValues, rooms]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    if (!currentUserId) {
      setMessage("로그인 후 예약을 생성할 수 있습니다.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          startAt: toIsoString(startAt),
          endAt: toIsoString(endAt),
          title,
          notes,
          repeatCount,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        if (payload?.error === "room_inactive") {
          throw new Error("비활성 회의실은 예약할 수 없습니다.");
        }
        throw new Error(payload?.error ?? "예약 추가에 실패했습니다.");
      }

      setRoomId(rooms[0]?.id ?? "");
      setStartAt("");
      setEndAt("");
      setTitle("");
      setNotes("");
      setRepeatCount(1);
      setMessage("예약을 추가했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "예약 추가에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack-form" id="booking-form" onSubmit={handleSubmit}>
      <label>
        <span>회의실</span>
        <select required value={roomId} onChange={(event) => setRoomId(event.target.value)}>
          {rooms.length === 0 ? <option value="">등록된 회의실 없음</option> : null}
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name} · Room {room.room_number}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>시작 시간</span>
        <input
          type="datetime-local"
          required
          value={startAt}
          onChange={(event) => setStartAt(event.target.value)}
        />
      </label>

      <label>
        <span>종료 시간</span>
        <input
          type="datetime-local"
          required
          value={endAt}
          onChange={(event) => setEndAt(event.target.value)}
        />
      </label>

      <label>
        <span>제목</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="주간 스탠드업"
        />
      </label>

      <label>
        <span>메모</span>
        <textarea
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="참석자, 준비물, 목적 등을 적어두세요."
        />
      </label>

      <label>
        <span>정기 예약 횟수</span>
        <input
          type="number"
          min={1}
          max={12}
          step={1}
          value={repeatCount}
          onChange={(event) => setRepeatCount(Number(event.target.value) || 1)}
        />
      </label>

      <p className="resource-note">
        시간은 Asia/Seoul 기준 30분 단위, 1회 최대 60분 규칙을 따릅니다. 정기 예약은 최대 12회까지
        생성할 수 있습니다.
      </p>

      <button type="submit" disabled={saving || rooms.length === 0}>
        {saving ? "저장 중..." : "예약 추가"}
      </button>

      {message ? (
        <p className="resource-message" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </form>
  );
}
