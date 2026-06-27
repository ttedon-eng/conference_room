import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";
import { completeSignup } from "../actions";
import { normalizeNextPath, UNSPECIFIED_GROUP_NAME } from "@/lib/auth/onboarding";

const DEFAULT_NEXT_PATH = "/account";

function resolveErrorMessage(errorValue: string | null | undefined) {
  switch (errorValue) {
    case "invalid":
      return "필수 정보가 부족합니다.";
    case "invalid_group":
      return "선택한 그룹이 올바르지 않습니다.";
    case "create_failed":
      return "계정 생성에 실패했습니다.";
    default:
      return null;
  }
}

export default async function SignupCompletePage({
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
    .select("id, email, verified_at")
    .eq("id", sessionValue)
    .maybeSingle();

  if (!verification) {
    redirect("/signup?error=missing_session");
  }

  if (!verification.verified_at) {
    redirect(`/signup/verify?session=${encodeURIComponent(verification.id)}&next=${encodeURIComponent(nextPath)}&error=verification_required`);
  }

  const { data: groupsData } = await serviceClient
    .from("groups")
    .select("id, name")
    .eq("is_active", true)
    .neq("name", UNSPECIFIED_GROUP_NAME)
    .order("name", { ascending: true });

  const groups = groupsData ?? [];

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Complete</p>
        <h1>이름, 비밀번호, 그룹 선택</h1>
        <p className="auth-copy">
          {verification.email} 계정의 기본 정보를 입력하면 가입이 완료됩니다.
        </p>

        <form action={completeSignup} className="auth-form">
          <input type="hidden" name="session" value={verification.id} />
          <input type="hidden" name="next" value={nextPath} />
          <label>
            <span>이름</span>
            <input required name="full_name" placeholder="홍길동" />
          </label>

          <label>
            <span>비밀번호</span>
            <input type="password" required minLength={8} name="password" placeholder="8자 이상" />
          </label>

          <label>
            <span>그룹</span>
            <select required name="group_id" defaultValue="">
              <option value="" disabled>
                그룹을 선택하세요
              </option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <button type="submit">가입 완료</button>
        </form>

        {message ? <p className="auth-message">{message}</p> : null}
      </section>
    </main>
  );
}

