"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RoomForm from "./room-form";
import type { RoomRow } from "./types";

export default function RoomsClient({
  currentUserId,
  isAdmin,
  rooms,
}: {
  currentUserId: string | null;
  isAdmin: boolean;
  rooms: RoomRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleDelete = async (room: RoomRow) => {
    const confirmed = window.confirm(
      `${room.name} (Room ${room.room_number})을 삭제할까요? 이 작업은 되돌릴 수 없으며 연결된 예약도 함께 삭제됩니다.`,
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);

    const { error } = await supabase.from("rooms").delete().eq("id", room.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingRoom?.id === room.id) {
      setEditingRoom(null);
    }

    setMessage("회의실을 삭제했습니다.");
    router.refresh();
  };

  return (
    <section className="dashboard-grid">
      <article className="resource-panel resource-panel-wide">
        <div className="section-head">
          <p className="eyebrow">List</p>
          <h2>회의실 목록</h2>
        </div>

        {message ? <p className="resource-message">{message}</p> : null}

        {rooms.length > 0 ? (
          <div className="resource-list">
            {rooms.map((room) => {
              const isSelected = editingRoom?.id === room.id;

              return (
                <article className={`resource-item ${isSelected ? "is-selected" : ""}`} key={room.id}>
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

                  {isAdmin ? (
                    <div className="resource-item-actions">
                      <button
                        type="button"
                        className="room-action-button"
                        onClick={() => setEditingRoom(room)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="room-action-button is-destructive"
                        onClick={() => handleDelete(room)}
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="resource-empty">
            아직 등록된 회의실이 없습니다.
            {isAdmin ? " 오른쪽 폼으로 첫 회의실을 추가하세요." : " 관리자에게 회의실 추가를 요청해 주세요."}
          </p>
        )}
      </article>

      {isAdmin ? (
        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">{editingRoom ? "수정" : "생성"}</p>
            <h2>{editingRoom ? "회의실 수정" : "회의실 추가"}</h2>
          </div>
          <p className="resource-note">
            {editingRoom
              ? "선택한 회의실의 값을 바꾸고 저장하면 목록이 즉시 갱신됩니다."
              : "관리자만 실제로 저장할 수 있습니다. 이름, 번호, 수용 인원만 먼저 채우면 됩니다."}
          </p>
          <RoomForm
            currentUserId={currentUserId}
            selectedRoom={editingRoom}
            onCancelEdit={() => setEditingRoom(null)}
            onSaved={() => {
              setEditingRoom(null);
            }}
          />
        </aside>
      ) : (
        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">조회</p>
            <h2>회의실 조회 전용</h2>
          </div>
          <p className="resource-note">
            현재 계정은 승인된 일반 사용자입니다. 회의실 추가, 수정, 삭제는 관리자에게만 열려 있습니다.
          </p>
        </aside>
      )}
    </section>
  );
}
