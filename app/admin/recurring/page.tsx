import DashboardShell from "@/components/dashboard-shell";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookingForm from "@/app/bookings/booking-form";
import RecurringOccurrenceList from "./occurrence-list";
import { cancelRecurringSeries, updateRecurringSeries } from "./actions";

const RECURRING_PAGE = "/admin/recurring";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "없음";
  }

  return dateFormatter.format(new Date(value));
}

export default async function AdminRecurringPage({
  searchParams,
}: {
  searchParams?: { error?: string | string[] };
}) {
  const errorValue = Array.isArray(searchParams?.error)
    ? searchParams?.error[0]
    : searchParams?.error;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(RECURRING_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(RECURRING_PAGE)}`);
  }

  const [
    { data: roomsData, error: roomsError },
    { data: seriesData, error: seriesError },
  ] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, name, room_number")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.rpc("list_booking_series_overview"),
  ]);

  const warnings = [] as string[];
  if (roomsError) {
    warnings.push("회의실 목록을 불러오지 못했습니다.");
  }

  if (seriesError) {
    warnings.push("정기 예약 목록을 불러오지 못했습니다.");
  }

  const rooms = roomsData ?? [];
  const seriesItems = (seriesData ?? []) as Array<{
    id: string;
    room_name: string;
    room_number: string;
    user_name: string;
    user_email: string;
    title: string | null;
    notes: string | null;
    status: string;
    starts_at: string;
    ends_at: string;
    repeat_count: number;
    upcoming_booking_count: number;
    created_at: string;
    updated_at: string;
  }>;
  type OccurrenceRow = {
    id: string;
    series_id: string | null;
    occurrence_index: number;
    start_at: string;
    end_at: string;
    title: string | null;
  };

  const seriesIds = seriesItems.map((series) => series.id);
  const { data: occurrenceData, error: occurrenceError } = seriesIds.length
    ? await supabase
        .from("bookings")
        .select("id, series_id, occurrence_index, start_at, end_at, title")
        .in("series_id", seriesIds)
        .order("start_at", { ascending: true })
    : { data: [] as OccurrenceRow[], error: null };

  if (occurrenceError) {
    warnings.push("회차 목록을 일부 불러오지 못했습니다.");
  }

  const occurrencesBySeries = new Map<string, OccurrenceRow[]>();
  for (const occurrence of (occurrenceData ?? []) as OccurrenceRow[]) {
    const key = occurrence.series_id ?? "";
    const current = occurrencesBySeries.get(key) ?? [];
    current.push(occurrence);
    occurrencesBySeries.set(key, current);
  }

  return (
    <DashboardShell
      eyebrow="정기 예약"
      title="정기 예약 관리"
      description="주간 반복 예약을 생성하고, 활성 시리즈를 확인하고, 시리즈 단위로 취소할 수 있습니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <div className="section-head">
            <p className="eyebrow">생성</p>
            <h2>정기 예약 생성</h2>
          </div>
          <p className="resource-note">
            정기 예약은 최대 12회까지 생성됩니다. 반복은 1주 간격으로 적용됩니다.
          </p>
          {warnings.length ? (
            <div className="resource-note">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <BookingForm currentUserId={user.id} rooms={rooms} />
        </article>

        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">시리즈</p>
            <h2>활성 시리즈</h2>
          </div>

          {errorValue ? <p className="resource-message">정기 예약 작업에 실패했습니다.</p> : null}

          {seriesItems.length ? (
            <div className="resource-list">
              {seriesItems.map((series) => (
                <article className="resource-item" key={series.id}>
                  <div className="resource-item-top">
                    <div>
                      <h3>{series.title || "제목 없음"}</h3>
                      <p className="resource-subtitle">
                        {series.room_name} · Room {series.room_number}
                      </p>
                    </div>
                    <span className={`status-pill ${series.status === "active" ? "is-active" : "is-inactive"}`}>
                      {series.status === "active" ? "활성" : "취소됨"}
                    </span>
                  </div>

                  <p className="resource-copy">
                    {series.user_name} · {series.user_email}
                  </p>
                  {series.notes ? <p className="resource-copy">{series.notes}</p> : null}

                  <div className="resource-meta">
                    <span>시작: {formatDate(series.starts_at)}</span>
                    <span>종료: {formatDate(series.ends_at)}</span>
                    <span>총 {series.repeat_count}회</span>
                    <span>남은 예약 {series.upcoming_booking_count}건</span>
                  </div>

                  <form action={updateRecurringSeries} className="stack-form">
                    <input type="hidden" name="series_id" value={series.id} />
                    <label>
                      <span>제목</span>
                      <input name="title" defaultValue={series.title ?? ""} placeholder="주간 스탠드업" />
                    </label>
                    <label>
                      <span>메모</span>
                      <textarea name="notes" rows={3} defaultValue={series.notes ?? ""} />
                    </label>
                    <label>
                      <span>정기 횟수</span>
                      <input
                        name="repeat_count"
                        type="number"
                        min={1}
                        max={12}
                        step={1}
                        defaultValue={series.repeat_count}
                      />
                    </label>
                    <button type="submit">시리즈 저장</button>
                  </form>

                  <div className="section-head section-head-spaced">
                    <p className="eyebrow">회차</p>
                    <h2>회차 목록</h2>
                  </div>

                  <RecurringOccurrenceList
                    seriesId={series.id}
                    occurrences={occurrencesBySeries.get(series.id) ?? []}
                  />

                  <form action={cancelRecurringSeries} className="stack-form">
                    <input type="hidden" name="series_id" value={series.id} />
                    <button type="submit" className="danger-button" disabled={series.status !== "active"}>
                      시리즈 취소
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <p className="resource-empty">아직 등록된 정기 예약이 없습니다.</p>
          )}
        </aside>
      </section>
    </DashboardShell>
  );
}
