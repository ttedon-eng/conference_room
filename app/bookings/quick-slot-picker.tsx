"use client";

import { useRouter } from "next/navigation";

type QuickSlot = {
  label: string;
  roomId: string;
  startAt: string;
  endAt: string;
};

export default function QuickSlotPicker({
  slots,
  anchorId = "booking-form",
  weekOffset,
}: {
  slots: QuickSlot[];
  anchorId?: string;
  weekOffset?: number;
}) {
  const router = useRouter();

  const applySlot = (slot: QuickSlot) => {
    const params = new URLSearchParams({
      roomId: slot.roomId,
      startAt: slot.startAt,
      endAt: slot.endAt,
    });

    if (typeof weekOffset === "number" && Number.isFinite(weekOffset) && weekOffset !== 0) {
      params.set("week", String(weekOffset));
    }

    router.push(`/bookings?${params.toString()}#${anchorId}`);
  };

  if (!slots.length) {
    return null;
  }

  return (
    <div className="quick-slot-panel">
      <div className="section-head">
        <p className="eyebrow">빠른 예약</p>
        <h2>빈 시간 슬롯 선택</h2>
      </div>
      <p className="resource-note">선택한 슬롯의 시간이 아래 예약 폼에 미리 들어갑니다.</p>
      <div className="quick-slot-grid">
        {slots.map((slot) => (
          <button type="button" className="quick-slot-button" key={slot.label} onClick={() => applySlot(slot)}>
            {slot.label}
          </button>
        ))}
      </div>
    </div>
  );
}
