"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RoomForm({
  currentUserId,
}: {
  currentUserId: string | null;
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
      const { error } = await supabase.from("rooms").insert({
        name,
        room_number: roomNumber,
        capacity: Number(capacity),
        description: description || null,
        is_active: isActive,
        created_by: currentUserId,
      });

      if (error) {
        throw error;
      }

      setName("");
      setRoomNumber("");
      setCapacity("8");
      setDescription("");
      setIsActive(true);
      setMessage("회의실을 추가했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "회의실 추가에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
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
        {saving ? "저장 중..." : "회의실 추가"}
      </button>

      {message ? <p className="resource-message">{message}</p> : null}
    </form>
  );
}
