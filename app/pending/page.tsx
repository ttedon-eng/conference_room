import { redirect } from "next/navigation";
import StateScreen from "@/components/state-screen";
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
    <StateScreen
      eyebrow="승인 대기"
      title="관리자 승인을 기다리는 중입니다."
      description="가입 신청은 완료되었습니다. 관리자가 승인하면 예약 화면으로 이동할 수 있습니다."
      actions={[
        { href: "/", label: "홈으로" },
        { href: `/login?next=${encodeURIComponent(nextPath)}`, label: "로그인으로 돌아가기", primary: true },
      ]}
    />
  );
}
