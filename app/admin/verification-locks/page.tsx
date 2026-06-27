import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { unlockSignupVerification } from "./actions";

const LOCKS_PAGE = "/admin/verification-locks";

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

export default async function AdminVerificationLocksPage({
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
    redirect(`/login?next=${encodeURIComponent(LOCKS_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(LOCKS_PAGE)}`);
  }

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    redirect(`${LOCKS_PAGE}?error=service_unavailable`);
  }

  const { data: lockedVerificationsData, error } = await serviceClient
    .from("signup_verifications")
    .select("id, email, failed_attempts, locked_at, code_expires_at, verified_at, updated_at, created_at")
    .not("locked_at", "is", null)
    .order("locked_at", { ascending: false });

  if (error) {
    throw error;
  }

  const lockedVerifications = lockedVerificationsData ?? [];

  return (
    <DashboardShell
      eyebrow="인증 잠금"
      title="이메일 인증 잠금 해제"
      description="실패 횟수가 누적되어 잠긴 가입 인증을 확인하고, 필요할 때만 잠금을 해제합니다."
    >
      <section className="resource-panel resource-panel-wide">
        <div className="section-head">
          <p className="eyebrow">관리</p>
          <h2>잠긴 인증 목록</h2>
        </div>

        {errorValue ? <p className="resource-message">잠금 해제 작업에 실패했습니다.</p> : null}

        {lockedVerifications.length ? (
          <div className="resource-list">
            {lockedVerifications.map((verification) => (
              <article className="resource-item" key={verification.id}>
                <div className="resource-item-top">
                  <div>
                    <h3>{verification.email}</h3>
                    <p className="resource-subtitle">인증 세션 {verification.id}</p>
                  </div>
                  <span className="status-pill is-inactive">잠금</span>
                </div>

                <div className="resource-meta">
                  <span>실패: {verification.failed_attempts}회</span>
                  <span>잠금: {formatDate(verification.locked_at)}</span>
                  <span>만료: {formatDate(verification.code_expires_at)}</span>
                </div>

                <p className="resource-copy">
                  검증 완료 여부: {verification.verified_at ? "완료" : "미완료"} · 생성: {formatDate(verification.created_at)}
                </p>

                <form action={unlockSignupVerification} className="stack-form">
                  <input type="hidden" name="verification_id" value={verification.id} />
                  <button type="submit" className="danger-button">
                    잠금 해제
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className="resource-empty">현재 잠긴 인증이 없습니다.</p>
        )}

        <div className="resource-actions">
          <Link className="ghost-link" href="/admin">
            관리자 허브로
          </Link>
        </div>
      </section>
    </DashboardShell>
  );
}
