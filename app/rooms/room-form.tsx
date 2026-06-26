"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoomRow } from "./types";

export default function RoomForm({
  currentUserId,
  selectedRoom,
  onCancelEdit,
  onSaved,
}: {
  currentUserId: string | null;
  selectedRoom: RoomRow | null;
  onCancelEdit: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEditing = selectedRoom !== null;

  useEffect(() => {
    setName(selectedRoom?.name ?? "");
    setRoomNumber(selectedRoom?.room_number ?? "");
    setCapacity(selectedRoom ? String(selectedRoom.capacity) : "8");
    setDescription(selectedRoom?.description ?? "");
    setIsActive(selectedRoom?.is_active ?? true);
  }, [selectedRoom]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    if (!currentUserId) {
      setMessage("로그인 후 회의실을 추가할 수 있습니다.");
      setSaving(false);
      return;
    }

    try {
      const roomPayload = {
        name,
        room_number: roomNumber,
        capacity: Number(capacity),
        description: description || null,
        is_active: isActive,
      };

      const { error } = isEditing
        ? await supabase.from("rooms").update(roomPayload).eq("id", selectedRoom.id)
        : await supabase.from("rooms").insert({
            ...roomPayload,
            created_by: currentUserId,
          });

      if (error) {
        throw error;
      }

      setMessage(isEditing ? "회의실을 수정했습니다." : "회의실을 추가했습니다.");
      onSaved();
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : isEditing
            ? "회의실 수정에 실패했습니다."
            : "회의실 추가에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      {isEditing ? <p className="resource-note">현재 선택된 회의실을 편집 중입니다.</p> : null}

      <label>
        <span>회의실 이름</span>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nexus A"
        />
      </label>

      <label>
        <span>회의실 번호</span>
        <input
          required
          value={roomNumber}
          onChange={(event) => setRoomNumber(event.target.value)}
          placeholder="101"
        />
      </label>

      <label>
        <span>수용 인원</span>
        <input
          type="number"
          min={0}
          required
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
        />
      </label>

      <label>
        <span>설명</span>
        <textarea
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="프로젝터, 화상회의 장비 등"
        />
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        <span>사용 가능 상태로 저장</span>
      </label>

      <button type="submit" disabled={saving}>
        {saving ? "저장 중..." : isEditing ? "수정 저장" : "회의실 추가"}
      </button>

      {isEditing ? (
        <button type="button" className="ghost-button" onClick={onCancelEdit}>
          편집 취소
        </button>
      ) : null}

      {message ? <p className="resource-message">{message}</p> : null}
    </form>
  );
}
