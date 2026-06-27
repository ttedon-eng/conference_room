import Link from "next/link";
import { redirect } from "next/navigation";
import { approveProfile, rejectProfile } from "./actions";
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

function getErrorMessage(errorValue: string | undefined) {
  switch (errorValue) {
    case "approve_failed":
      return "승인 처리에 실패했습니다.";
    case "reject_failed":
      return "거부 처리에 실패했습니다.";
    case "email_failed":
      return "거부 처리 후 이메일 발송에 실패했습니다.";
    case "invalid":
      return "요청 값을 확인할 수 없습니다.";
    default:
      return null;
  }
}

type PendingProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  rejected_at: string | null;
  rejection_reason: string | null;
};

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
    .select("id, email, full_name, created_at, updated_at, rejected_at, rejection_reason")
    .eq("role", "user")
    .eq("is_approved", false)
    .order("rejected_at", { ascending: true })
    .order("created_at", { ascending: true });

  const pendingProfiles = ((pendingProfilesData ?? []) as PendingProfileRow[]).sort((left, right) => {
    const leftRejected = left.rejected_at ? 1 : 0;
    const rightRejected = right.rejected_at ? 1 : 0;

    return leftRejected - rightRejected || left.created_at.localeCompare(right.created_at);
  });

  const pendingCount = pendingProfiles.filter((item) => !item.rejected_at).length;
  const rejectedCount = pendingProfiles.length - pendingCount;

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
        <p className="eyebrow">승인 관리</p>
          <h1>승인 대기 사용자</h1>
          <p className="dashboard-lede">
            이메일 인증을 마친 계정 중 아직 승인되지 않은 사용자를 검토하고, 승인 시
            `is_approved`, `approved_at`, `approved_by`가 함께 기록됩니다. 거부 시에는 사유와 메일 발송
            결과도 함께 남깁니다.
          </p>
        </div>

        <div className="dashboard-hero-aside">
          <Link className="ghost-link" href="/account">
            내 계정으로 돌아가기
          </Link>
          <span className="dashboard-chip">{pendingCount}명 대기 중</span>
          <span className="dashboard-chip">{rejectedCount}명 거부 상태</span>
        </div>
      </section>

      {errorValue ? <p className="resource-message">{getErrorMessage(errorValue) ?? "처리에 실패했습니다."}</p> : null}

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
                  <span className={`status-pill ${pendingProfile.rejected_at ? "is-inactive" : "is-active"}`}>
                    {pendingProfile.rejected_at ? "거부됨" : "승인 대기"}
                  </span>
                </div>

                <div className="resource-meta">
                  <span>가입: {formatDate(pendingProfile.created_at)}</span>
                  <span>갱신: {formatDate(pendingProfile.updated_at)}</span>
                  {pendingProfile.rejected_at ? <span>거부: {formatDate(pendingProfile.rejected_at)}</span> : null}
                </div>

                {pendingProfile.rejection_reason ? (
                  <p className="resource-copy">거부 사유: {pendingProfile.rejection_reason}</p>
                ) : null}

                <div className="approval-actions">
                  <form action={approveProfile} className="stack-form">
                    <input type="hidden" name="profile_id" value={pendingProfile.id} />
                    <button type="submit">승인하기</button>
                  </form>

                  <form action={rejectProfile} className="stack-form">
                    <input type="hidden" name="profile_id" value={pendingProfile.id} />
                    <label>
                      <span>거부 사유</span>
                      <textarea
                        name="rejection_reason"
                        rows={3}
                        placeholder="예: 회사 이메일 확인이 필요합니다."
                        defaultValue={pendingProfile.rejection_reason ?? ""}
                      />
                    </label>
                    <button type="submit" className="danger-button">
                      거부하기
                    </button>
                  </form>
                </div>
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
