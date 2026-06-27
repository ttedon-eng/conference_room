import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";

const DIAGNOSTICS_PAGE = "/admin/diagnostics";

type DiagnosticRow = {
  check_name: string;
  status: "ok" | "warn" | "error";
  details: string;
};

export default async function AdminDiagnosticsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(DIAGNOSTICS_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(DIAGNOSTICS_PAGE)}`);
  }

  const { data: diagnosticRowsData, error } = await supabase.rpc("get_operational_diagnostics");
  const warnings = [] as string[];

  if (error) {
    warnings.push("DB 진단 정보를 불러오지 못했습니다.");
  }

  const diagnosticRows = (diagnosticRowsData ?? []) as DiagnosticRow[];

  return (
    <DashboardShell
      eyebrow="진단"
      title="DB 정합성 진단"
      description="배포 DB가 현재 소스가 기대하는 스키마와 기본 데이터를 갖추고 있는지 빠르게 확인합니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <div className="section-head">
            <p className="eyebrow">Checks</p>
            <h2>핵심 점검 항목</h2>
          </div>
          <p className="resource-note">
            profiles의 거부 컬럼, 예약 화면 함수, 이메일 발송 제약, 기본 seed를 함께 점검합니다.
          </p>

          {warnings.length ? (
            <div className="resource-note">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {diagnosticRows.length ? (
            <div className="resource-list">
              {diagnosticRows.map((row) => (
                <article className="resource-item" key={row.check_name}>
                  <div className="resource-item-top">
                    <div>
                      <h3>{row.check_name}</h3>
                      <p className="resource-subtitle">{row.details}</p>
                    </div>
                    <span
                      className={`status-pill ${
                        row.status === "ok" ? "is-active" : row.status === "warn" ? "is-owner" : "is-inactive"
                      }`}
                    >
                      {row.status === "ok" ? "정상" : row.status === "warn" ? "확인 필요" : "오류"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="resource-empty">진단 결과가 아직 없습니다.</p>
          )}
        </article>

        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">Guide</p>
            <h2>해석 기준</h2>
          </div>
          <div className="resource-list">
            <article className="resource-item">
              <h3>오류</h3>
              <p className="resource-copy">배포 전에 반드시 고쳐야 하는 누락입니다.</p>
            </article>
            <article className="resource-item">
              <h3>확인 필요</h3>
              <p className="resource-copy">기능은 살아 있지만 seed 부족이나 권장값 미설정 상태입니다.</p>
            </article>
            <article className="resource-item">
              <h3>정상</h3>
              <p className="resource-copy">현재 소스가 기대하는 상태와 일치합니다.</p>
            </article>
          </div>
          <Link className="ghost-link" href="/admin">
            관리자 허브로 돌아가기
          </Link>
        </aside>
      </section>
    </DashboardShell>
  );
}
