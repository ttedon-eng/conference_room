import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeNextPath, UNSPECIFIED_GROUP_NAME } from "@/lib/auth/onboarding";
import { requestSignupVerification } from "./actions";

const DEFAULT_NEXT_PATH = "/bookings";

function resolveErrorMessage(errorValue: string | null | undefined) {
  switch (errorValue) {
    case "invalid_email":
      return "회사 이메일만 사용할 수 있습니다.";
    case "locked":
      return "이 이메일은 인증이 잠겨 있습니다. 관리자 해제가 필요합니다.";
    case "rejected":
      return "거절된 계정입니다. 처음부터 다시 가입해 주세요.";
    case "pending":
      return "이미 승인 대기 중인 가입이 있습니다. 승인 결과를 기다려 주세요.";
    case "already_registered":
      return "이미 승인된 계정입니다. 로그인해 주세요.";
    case "service_unavailable":
      return "가입 서비스를 사용할 수 없습니다.";
    default:
      return null;
  }
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[]; error?: string | string[] };
}) {
  const nextValue = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  const nextPath = normalizeNextPath(nextValue ?? DEFAULT_NEXT_PATH);
  const errorValue = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;
  const message = resolveErrorMessage(errorValue);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    redirect(nextPath);
  }

  const serviceClient = createServiceClient();
  const { data: groupsData } = serviceClient
    ? await serviceClient
        .from("groups")
        .select("id, name")
        .eq("is_active", true)
        .neq("name", UNSPECIFIED_GROUP_NAME)
        .order("name", { ascending: true })
    : { data: [] as Array<{ id: string; name: string }> };

  const groups = groupsData ?? [];

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">회원가입</p>
        <h1>이메일로 가입을 시작합니다.</h1>
        <p className="auth-copy">
          회사 이메일로 인증번호를 보낸 뒤 이름, 비밀번호, 그룹을 입력하면 가입이 완료됩니다.
        </p>

        <form action={requestSignupVerification} className="auth-form">
          <input type="hidden" name="next" value={nextPath} />
          <label>
            <span>이메일</span>
            <input type="email" required name="email" placeholder="name@samsung.com" />
          </label>

          <button type="submit">인증번호 보내기</button>
        </form>

        <div className="auth-actions">
          <Link className="ghost-link link-button" href={`/login?next=${encodeURIComponent(nextPath)}`}>
            로그인으로 돌아가기
          </Link>
        </div>

        {message ? (
          <p className="auth-message" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}

        <div className="resource-note" style={{ marginTop: 24 }}>
          <strong>선택 가능한 그룹</strong>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {groups.length ? (
              groups.map((group) => (
                <span key={group.id} className="dashboard-chip">
                  {group.name}
                </span>
              ))
            ) : (
              <span>활성 그룹이 없습니다.</span>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
