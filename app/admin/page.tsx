import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";

const ADMIN_PAGE = "/admin";

export default async function AdminHomePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(ADMIN_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(ADMIN_PAGE)}`);
  }

  const cards = [
    {
      href: "/admin/approvals",
      title: "사용자 승인",
      description: "승인 대기 사용자를 검토하고 접근 권한을 열어줍니다.",
    },
    {
      href: "/admin/groups",
      title: "그룹 관리",
      description: "그룹을 만들고 사용자 소속을 조정합니다.",
    },
    {
      href: "/admin/stats",
      title: "예약 통계",
      description: "회의실, 사용자, 그룹 기준의 예약 흐름을 확인합니다.",
    },
    {
      href: "/admin/recurring",
      title: "정기 예약",
      description: "반복 예약 시리즈를 생성하고 취소합니다.",
    },
    {
      href: "/admin/audit",
      title: "감사 로그",
      description: "승인, 회의실, 그룹, 예약, 정책 변경 이력을 확인합니다.",
    },
    {
      href: "/admin/policy",
      title: "주간 예약 정책",
      description: "주간 예약 제한 시간을 코드 수정 없이 조정합니다.",
    },
    {
      href: "/admin/verification-locks",
      title: "인증 잠금",
      description: "실패 누적으로 잠긴 이메일 인증을 해제합니다.",
    },
  ];

  return (
    <DashboardShell
      eyebrow="관리자"
      title="관리자 허브"
      description="운영자가 자주 쓰는 승인, 그룹, 통계, 정책 화면을 한곳에 모았습니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <div className="section-head">
            <p className="eyebrow">메뉴</p>
            <h2>관리 메뉴</h2>
          </div>

          <div className="grid admin-nav-grid">
            {cards.map((card) => (
              <Link className="card admin-nav-card" href={card.href} key={card.href}>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
