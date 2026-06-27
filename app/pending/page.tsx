import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT_PATH = "/bookings";

function safeNextPath(value: string | null | undefined) {
  const nextPath = value?.trim();

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.includes("://")) {
    return DEFAULT_NEXT_PATH;
  }

  return nextPath;
}

export default async function PendingPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const nextValue = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  const nextPath = safeNextPath(nextValue);
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_approved || profile?.role === "admin") {
    redirect(nextPath);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">승인 대기</p>
        <h1>승인을 기다리는 중입니다.</h1>
        <p className="auth-copy">이메일 인증은 끝났습니다. 승인되면 예약 화면으로 이동할 수 있습니다.</p>
        <Link className="primary-link" href={`/login?next=${encodeURIComponent(nextPath)}`}>
          로그인으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
