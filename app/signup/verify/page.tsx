import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";
import { normalizeNextPath } from "@/lib/auth/onboarding";
import { requestSignupVerification, verifySignupCode } from "../actions";

const DEFAULT_NEXT_PATH = "/account";

function resolveErrorMessage(errorValue: string | null | undefined) {
  switch (errorValue) {
    case "expired":
      return "인증번호가 만료되었습니다. 다시 보내 주세요.";
    case "invalid_code":
      return "인증번호가 올바르지 않습니다.";
    case "locked":
      return "이 이메일은 인증이 잠겨 있습니다. 관리자 해제가 필요합니다.";
    case "verification_required":
      return "먼저 이메일 인증을 완료해 주세요.";
    case "missing_session":
      return "인증 세션을 찾을 수 없습니다. 처음부터 다시 시작해 주세요.";
    default:
      return null;
  }
}

export default async function SignupVerifyPage({
  searchParams,
}: {
  searchParams?: { session?: string | string[]; next?: string | string[]; error?: string | string[] };
}) {
  const sessionValue = Array.isArray(searchParams?.session) ? searchParams?.session[0] : searchParams?.session;
  const nextValue = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  const nextPath = normalizeNextPath(nextValue ?? DEFAULT_NEXT_PATH);
  const errorValue = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;
  const message = resolveErrorMessage(errorValue);

  if (!sessionValue) {
    redirect("/signup");
  }

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    redirect("/signup?error=service_unavailable");
  }

  const { data: verification } = await serviceClient
    .from("signup_verifications")
    .select("id, email, code_expires_at, failed_attempts, locked_at")
    .eq("id", sessionValue)
    .maybeSingle();

  if (!verification) {
    redirect("/signup?error=missing_session");
  }

  const isLocked = Boolean(verification.locked_at);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Verification</p>
        <h1>인증번호 확인</h1>
        <p className="auth-copy">
          {verification.email}로 보낸 6자리 인증번호를 입력하세요. 유효 시간은 10분입니다.
        </p>

        <form action={verifySignupCode} className="auth-form">
          <input type="hidden" name="session" value={verification.id} />
          <input type="hidden" name="next" value={nextPath} />
          <label>
            <span>인증번호</span>
            <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} required name="code" placeholder="123456" />
          </label>
          <button type="submit" disabled={isLocked}>
            인증하기
          </button>
        </form>

        <div className="auth-actions">
          <form action={requestSignupVerification}>
            <input type="hidden" name="email" value={verification.email} />
            <input type="hidden" name="next" value={nextPath} />
            <button type="submit" className="link-button" disabled={isLocked}>
              인증번호 재발송
            </button>
          </form>
          <Link className="link-button" href="/signup">
            처음으로
          </Link>
        </div>

        {message ? <p className="auth-message">{message}</p> : null}

        <p className="resource-note">
          실패 횟수: {verification.failed_attempts}회
          {isLocked ? " · 잠금 상태" : ""}
        </p>
      </section>
    </main>
  );
}

