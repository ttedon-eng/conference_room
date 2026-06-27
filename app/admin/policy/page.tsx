import DashboardShell from "@/components/dashboard-shell";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateWeeklyLimit } from "./actions";

const POLICY_PAGE = "/admin/policy";

export default async function AdminPolicyPage({
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
    redirect(`/login?next=${encodeURIComponent(POLICY_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(POLICY_PAGE)}`);
  }

  const { data: settings, error } = await supabase
    .from("booking_settings")
    .select("weekly_booking_limit_minutes, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const weeklyLimit = settings?.weekly_booking_limit_minutes ?? 180;

  return (
    <DashboardShell
      eyebrow="Policy"
      title="주간 예약 제한 정책"
      description="코드 수정 없이 주간 예약 제한 시간을 조정합니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <div className="section-head">
            <p className="eyebrow">현재</p>
            <h2>현재 정책값</h2>
          </div>

          <div className="stats-summary">
            <div className="stat-card">
              <span className="stat-label">주간 예약 제한</span>
              <strong>{weeklyLimit}분</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">최대 예약 길이</span>
              <strong>60분</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">운영 시간</span>
              <strong>08:00-18:00</strong>
            </div>
          </div>

          {errorValue ? <p className="resource-message">정책 저장에 실패했습니다.</p> : null}
        </article>

        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">수정</p>
            <h2>정책 수정</h2>
          </div>

          <form action={updateWeeklyLimit} className="stack-form">
            <label>
              <span>주간 예약 제한(분)</span>
              <input
                name="weekly_booking_limit_minutes"
                type="number"
                min={1}
                step={1}
                defaultValue={weeklyLimit}
                required
              />
            </label>
            <p className="resource-note">
              이 값은 사용자별 주간 누적 예약 시간의 상한입니다. 저장 후 바로 반영됩니다.
            </p>
            <button type="submit">정책 저장</button>
          </form>
        </aside>
      </section>
    </DashboardShell>
  );
}
