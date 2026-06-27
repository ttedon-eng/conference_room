import Link from "next/link";
import type { BookingDashboardRow, WeeklyTimetableCell } from "@/app/bookings/booking-view-model";

const dayFormatter = new Intl.DateTimeFormat("ko-KR", {
  weekday: "short",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

function formatWeekRange(weekStart: Date) {
  const weekEnd = new Date(weekStart.getTime() + 4 * 24 * 60 * 60 * 1000);
  return `${dayFormatter.format(weekStart)} - ${dayFormatter.format(weekEnd)}`;
}

function getDayLabel(weekStart: Date, dayOffset: number) {
  const date = new Date(weekStart.getTime());
  date.setDate(date.getDate() + dayOffset);
  return dayFormatter.format(date);
}

function getHourLabel(hour: number) {
  const date = new Date(Date.UTC(2024, 0, 1, hour - 9, 0, 0));
  return `${timeFormatter.format(date)}:00`;
}

function getBookingSummary(booking: BookingDashboardRow) {
  return `${booking.room_name} · Room ${booking.room_number}`;
}

function cellKey(cell: WeeklyTimetableCell) {
  return `${cell.dayOffset}:${cell.hour}`;
}

export default function WeeklyTimetable({
  title,
  description,
  weekStart,
  previousWeekHref,
  nextWeekHref,
  cells,
  emptyMessage = "표시할 예약이 아직 없습니다.",
}: {
  title: string;
  description?: string;
  weekStart: Date;
  previousWeekHref?: string;
  nextWeekHref?: string;
  cells: WeeklyTimetableCell[];
  emptyMessage?: string;
}) {
  const dayOffsets = [0, 1, 2, 3, 4];
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const cellsByKey = new Map(cells.map((cell) => [cellKey(cell), cell] as const));
  const mobileDays = dayOffsets.map((dayOffset) => {
    const slots = hours
      .map((hour) => {
        const cell = cellsByKey.get(`${dayOffset}:${hour}`);

        return {
          hour,
          cell,
        };
      })
      .filter(({ cell }) => (cell?.bookings.length ?? 0) > 0);

    return {
      dayOffset,
      slots,
    };
  });

  return (
    <section className="weekly-timetable">
      <header className="weekly-timetable-head">
        <div>
          <p className="eyebrow">Time Table</p>
          <h2>{title}</h2>
          {description ? <p className="resource-note">{description}</p> : null}
          <p className="resource-note">기간: {formatWeekRange(weekStart)}</p>
        </div>

        <div className="weekly-timetable-nav">
          {previousWeekHref ? (
            <Link className="ghost-link" href={previousWeekHref}>
              이전 주
            </Link>
          ) : null}
          {nextWeekHref ? (
            <Link className="ghost-link" href={nextWeekHref}>
              다음 주
            </Link>
          ) : null}
        </div>
      </header>

      <div className="weekly-timetable-grid">
        <table className="weekly-timetable-table">
          <thead>
            <tr>
              <th scope="col">시간</th>
              {dayOffsets.map((dayOffset) => (
                <th scope="col" key={dayOffset}>
                  {getDayLabel(weekStart, dayOffset)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <th scope="row">{getHourLabel(hour)}</th>
                {dayOffsets.map((dayOffset) => {
                  const cell = cellsByKey.get(`${dayOffset}:${hour}`);

                  return (
                    <td key={`${dayOffset}-${hour}`}>
                      {cell?.bookings.length ? (
                        <div className="weekly-timetable-cell">
                          {cell.bookings.slice(0, 2).map((booking) => (
                            <article className="weekly-timetable-booking" key={booking.id}>
                              <strong>{booking.title || "제목 없음"}</strong>
                              <span className="weekly-timetable-summary">{getBookingSummary(booking)}</span>
                              <span className="weekly-timetable-user">{booking.user_name}</span>
                              <span className="booking-group-chip weekly-timetable-group">
                                {booking.group_name || "그룹 없음"}
                              </span>
                            </article>
                          ))}
                          {cell.bookings.length > 2 ? (
                            <span className="weekly-timetable-more">외 {cell.bookings.length - 2}건</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="weekly-timetable-empty">{emptyMessage}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="weekly-timetable-mobile" aria-label="모바일 주간 예약 보기">
        {mobileDays.map(({ dayOffset, slots }) => (
          <article className="weekly-timetable-day-card" key={dayOffset}>
            <div className="weekly-timetable-day-head">
              <h3>{getDayLabel(weekStart, dayOffset)}</h3>
              <span>{slots.length ? `${slots.length}개 시간대` : "예약 없음"}</span>
            </div>

            {slots.length ? (
              <div className="weekly-timetable-day-slots">
                {slots.map(({ hour, cell }) => (
                  <section className="weekly-timetable-slot" key={`${dayOffset}:${hour}`}>
                    <div className="weekly-timetable-slot-time">{getHourLabel(hour)}</div>
                    <div className="weekly-timetable-slot-bookings">
                      {cell?.bookings.slice(0, 2).map((booking) => (
                        <article className="weekly-timetable-booking" key={booking.id}>
                          <strong>{booking.title || "제목 없음"}</strong>
                          <span className="weekly-timetable-summary">{getBookingSummary(booking)}</span>
                          <span className="booking-group-chip weekly-timetable-group">
                            {booking.group_name || "그룹 없음"}
                          </span>
                        </article>
                      ))}
                      {cell && cell.bookings.length > 2 ? (
                        <span className="weekly-timetable-more">외 {cell.bookings.length - 2}건</span>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p className="weekly-timetable-day-empty">{emptyMessage}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
