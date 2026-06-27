export type BookingToneKey = "teal" | "blue" | "amber" | "rose" | "emerald" | "slate";

export type BookingTone = {
  label: string;
  accent: string;
  border: string;
  soft: string;
  ink: string;
  background: string;
};

export const BOOKING_TONES: Record<BookingToneKey, BookingTone> = {
  teal: {
    label: "청록",
    accent: "#0f766e",
    border: "rgba(15, 118, 110, 0.22)",
    soft: "rgba(15, 118, 110, 0.12)",
    ink: "#0b4f4a",
    background: "rgba(236, 253, 245, 0.92)",
  },
  blue: {
    label: "파랑",
    accent: "#2563eb",
    border: "rgba(37, 99, 235, 0.22)",
    soft: "rgba(37, 99, 235, 0.12)",
    ink: "#1d4ed8",
    background: "rgba(239, 246, 255, 0.92)",
  },
  amber: {
    label: "호박",
    accent: "#b45309",
    border: "rgba(180, 83, 9, 0.22)",
    soft: "rgba(180, 83, 9, 0.12)",
    ink: "#92400e",
    background: "rgba(255, 251, 235, 0.92)",
  },
  rose: {
    label: "장미",
    accent: "#be123c",
    border: "rgba(190, 18, 60, 0.22)",
    soft: "rgba(190, 18, 60, 0.12)",
    ink: "#9f1239",
    background: "rgba(255, 241, 242, 0.92)",
  },
  emerald: {
    label: "초록",
    accent: "#047857",
    border: "rgba(4, 120, 87, 0.22)",
    soft: "rgba(4, 120, 87, 0.12)",
    ink: "#065f46",
    background: "rgba(236, 253, 245, 0.92)",
  },
  slate: {
    label: "회색",
    accent: "#475569",
    border: "rgba(71, 85, 105, 0.22)",
    soft: "rgba(71, 85, 105, 0.12)",
    ink: "#334155",
    background: "rgba(248, 250, 252, 0.92)",
  },
};

const BOOKING_TONE_KEYS = Object.keys(BOOKING_TONES) as BookingToneKey[];

export type BookingDashboardRow = {
  id: string;
  room_id: string;
  room_name: string;
  room_number: string;
  user_id: string;
  user_name: string;
  user_email: string;
  group_id: string | null;
  group_name: string | null;
  start_at: string;
  end_at: string;
  title: string | null;
  notes: string | null;
  series_id: string | null;
  occurrence_index: number | null;
  toneKey: BookingToneKey;
};

export type BookingGroupRow = {
  id: string;
  name: string;
  is_active: boolean;
  toneKey: BookingToneKey;
};

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getBookingToneKey(seed: string | null | undefined): BookingToneKey {
  if (!seed) {
    return "slate";
  }

  return BOOKING_TONE_KEYS[hashString(seed) % BOOKING_TONE_KEYS.length];
}
