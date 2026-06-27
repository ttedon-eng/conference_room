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
    label: "딥블루",
    accent: "#1d4ed8",
    border: "rgba(29, 78, 216, 0.22)",
    soft: "rgba(29, 78, 216, 0.12)",
    ink: "#1e3a8a",
    background: "rgba(239, 246, 255, 0.92)",
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

export type WeeklyTimetableCell = {
  dateKey: string;
  dayOffset: number;
  hour: number;
  bookings: BookingDashboardRow[];
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

export function getBookingsForWeek(bookings: BookingDashboardRow[], weekStart: Date, weekEnd: Date) {
  return bookings.filter((booking) => {
    const startedAt = new Date(booking.start_at);
    return startedAt >= weekStart && startedAt < weekEnd;
  });
}

function createSlotStart(weekStart: Date, dayOffset: number, hour: number) {
  return new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000);
}

export function buildWeeklyTimetableGrid({
  bookings,
  weekStart,
}: {
  bookings: BookingDashboardRow[];
  weekStart: Date;
}) {
  const weekDays = [0, 1, 2, 3, 4];
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  return weekDays.flatMap((dayOffset) =>
    hours.map((hour) => {
      const slotStart = createSlotStart(weekStart, dayOffset, hour);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      const bookingsForSlot = bookings
        .filter((booking) => {
          const bookingStart = new Date(booking.start_at);
          const bookingEnd = new Date(booking.end_at);
          return bookingStart < slotEnd && bookingEnd > slotStart;
        })
        .sort((left, right) => {
          const startDiff = new Date(left.start_at).getTime() - new Date(right.start_at).getTime();
          if (startDiff !== 0) {
            return startDiff;
          }

          return left.room_name.localeCompare(right.room_name);
        });

      return {
        dateKey: `${dayOffset}:${hour}`,
        dayOffset,
        hour,
        bookings: bookingsForSlot,
      } satisfies WeeklyTimetableCell;
    }),
  );
}
