import Link from "next/link";
import { redirect } from "next/navigation";
import { approveProfile } from "./actions";
import { createClient } from "@/lib/supabase/server";

const APPROVAL_PAGE = "/admin/approvals";

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

export default async function AdminApprovalsPage({
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
    redirect(`/login?next=${encodeURIComponent(APPROVAL_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(
      profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(APPROVAL_PAGE)}`,
    );
  }

  const { data: pendingProfilesData } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at, updated_at")
    .eq("role", "user")
    .eq("is_approved", false)
    .order("created_at", { ascending: true });
  const pendingProfiles = pendingProfilesData ?? [];

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Admin Approval</p>
          <h1>승인 대기 사용자</h1>
          <p className="dashboard-lede">
            이메일 인증을 마친 계정 중 아직 승인되지 않은 사용자를 검토하고, 승인 시
            `is_approved`, `approved_at`, `approved_by`가 함께 기록됩니다.
          </p>
        </div>

        <div className="dashboard-hero-aside">
          <Link className="ghost-link" href="/account">
            내 계정으로 돌아가기
          </Link>
          <span className="dashboard-chip">{pendingProfiles.length}명 대기 중</span>
        </div>
      </section>

      {errorValue ? <p className="resource-message">승인 처리에 실패했습니다.</p> : null}

      <section className="resource-panel resource-panel-wide">
        <div className="section-head">
          <p className="eyebrow">Pending Profiles</p>
          <h2>가입 요청 목록</h2>
        </div>

        {pendingProfiles.length ? (
          <div className="resource-list">
            {pendingProfiles.map((pendingProfile) => (
              <article key={pendingProfile.id} className="resource-item">
                <div className="resource-item-top">
                  <div>
                    <h3>{pendingProfile.full_name || pendingProfile.email}</h3>
                    <p className="resource-subtitle">{pendingProfile.email}</p>
                  </div>
                  <span className="status-pill is-inactive">승인 대기</span>
                </div>

                <div className="resource-meta">
                  <span>가입: {formatDate(pendingProfile.created_at)}</span>
                  <span>갱신: {formatDate(pendingProfile.updated_at)}</span>
                </div>

                <form action={approveProfile} className="stack-form">
                  <input type="hidden" name="profile_id" value={pendingProfile.id} />
                  <button type="submit">승인하기</button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className="resource-empty">현재 승인 대기 중인 사용자가 없습니다.</p>
        )}
      </section>
    </main>
  );
}
