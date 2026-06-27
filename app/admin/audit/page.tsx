import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";

const AUDIT_PAGE = "/admin/audit";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

type AuditLogRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type ActorRow = {
  id: string;
  full_name: string | null;
  email: string;
};

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function getActionLabel(action: string) {
  switch (action) {
    case "profile_approved":
      return "사용자 승인";
    case "profile_rejected":
      return "사용자 거부";
    case "group_created":
      return "그룹 생성";
    case "group_updated":
      return "그룹 수정";
    case "group_deleted":
    case "group_deactivated":
      return "그룹 미사용 처리";
    case "group_assignment_updated":
      return "그룹 배정";
    case "room_created":
      return "회의실 생성";
    case "room_updated":
      return "회의실 수정";
    case "room_deleted":
      return "회의실 삭제";
    case "booking_deleted":
      return "예약 삭제";
    case "booking_series_cancelled":
      return "정기 예약 취소";
    case "booking_series_updated":
      return "정기 예약 수정";
    case "booking_policy_updated":
      return "예약 한도 변경";
    case "signup_verification_unlocked":
      return "인증 잠금 해제";
    default:
      return action;
  }
}

function formatDetailValue(value: unknown) {
  if (value === null || value === undefined) {
    return "없음";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function buildDetailChips(details: Record<string, unknown> | null) {
  if (!details) {
    return [] as Array<{ label: string; value: string }>;
  }

  const labelMap: Record<string, string> = {
    name: "이름",
    room_name: "회의실",
    room_number: "번호",
    user_name: "사용자",
    user_email: "이메일",
    recipient_name: "대상자",
    recipient_email: "대상 이메일",
    group_name: "그룹",
    rejection_reason: "거부 사유",
    weekly_booking_limit_minutes: "주간 제한(분)",
    approved_by: "승인자",
    rejected_by: "거부자",
  };

  const priorityKeys = [
    "name",
    "room_name",
    "room_number",
    "user_name",
    "user_email",
    "recipient_name",
    "recipient_email",
    "group_name",
    "rejection_reason",
    "weekly_booking_limit_minutes",
    "approved_by",
    "rejected_by",
  ];

  const selectedKeys = [
    ...priorityKeys.filter((key) => key in details),
    ...Object.keys(details).filter((key) => !priorityKeys.includes(key)),
  ].slice(0, 3);

  return selectedKeys.map((key) => ({
    label: labelMap[key] ?? key.replace(/_/g, " "),
    value: formatDetailValue(details[key]),
  }));
}

export default async function AdminAuditPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(AUDIT_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(AUDIT_PAGE)}`);
  }

  const { data: auditLogsData, error: auditLogsError } = await supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const warnings = [] as string[];
  if (auditLogsError) {
    warnings.push("감사 로그를 일부 불러오지 못했습니다.");
  }

  const auditLogs = (auditLogsData ?? []) as AuditLogRow[];
  const actorIds = [...new Set(auditLogs.map((log) => log.actor_id).filter(Boolean))] as string[];

  const { data: actorRowsData, error: actorRowsError } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds)
    : { data: [], error: null };

  if (actorRowsError) {
    warnings.push("작성자 정보를 일부 불러오지 못했습니다.");
  }

  const actorById = new Map((actorRowsData ?? []).map((actor) => [actor.id, actor] as const));

  return (
    <DashboardShell
      eyebrow="Audit"
      title="감사 로그 뷰어"
      description="승인, 그룹, 회의실, 예약 변경 내역을 최근 50건 기준으로 확인합니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <div className="section-head">
            <p className="eyebrow">Recent Events</p>
            <h2>최근 변경 내역</h2>
          </div>
          <p className="resource-note">
            감사 로그는 관리자 변경 흐름을 확인하는 조회 전용 화면입니다. 상세 데이터는 핵심 항목만
            보여줍니다.
          </p>
          {warnings.length ? (
            <div className="resource-note">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {auditLogs.length ? (
            <div className="resource-list">
              {auditLogs.map((log) => {
                const actor = log.actor_id ? actorById.get(log.actor_id) : null;
                const detailChips = buildDetailChips(log.details);

                return (
                  <article className="resource-item" key={log.id}>
                    <div className="resource-item-top">
                      <div>
                        <h3>{getActionLabel(log.action)}</h3>
                        <p className="resource-subtitle">
                          {log.entity_type}
                          {log.entity_id ? ` · ${log.entity_id}` : ""}
                        </p>
                      </div>
                      <span className="status-pill is-owner">
                        {actor ? actor.full_name || actor.email : "시스템"}
                      </span>
                    </div>

                    <div className="resource-meta">
                      <span>{formatDate(log.created_at)}</span>
                      <span>{log.entity_type}</span>
                      <span>{log.entity_id || "대상 없음"}</span>
                    </div>

                    {detailChips.length ? (
                      <div className="audit-chip-row">
                        {detailChips.map((chip) => (
                          <span className="audit-chip" key={`${log.id}-${chip.label}`}>
                            <strong>{chip.label}</strong>
                            <em>{chip.value}</em>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="resource-empty">아직 감사 로그가 없습니다.</p>
          )}
        </article>

        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">Scope</p>
            <h2>기록 대상</h2>
          </div>
          <div className="resource-list">
            <article className="resource-item">
              <div className="resource-item-top">
                <div>
                  <h3>사용자 승인</h3>
                  <p className="resource-subtitle">승인과 거부를 함께 추적합니다.</p>
                </div>
                <span className="status-pill is-active">profile</span>
              </div>
            </article>
            <article className="resource-item">
              <div className="resource-item-top">
                <div>
                  <h3>회의실 / 그룹 변경</h3>
                  <p className="resource-subtitle">중요 변경 이력을 남깁니다.</p>
                </div>
                <span className="status-pill is-active">admin</span>
              </div>
            </article>
            <article className="resource-item">
              <div className="resource-item-top">
                <div>
                  <h3>예약 삭제 / 한도 변경</h3>
                  <p className="resource-subtitle">삭제와 주간 제한 변경도 함께 보관합니다.</p>
                </div>
                <span className="status-pill is-active">audit</span>
              </div>
            </article>
            <article className="resource-item">
              <div className="resource-item-top">
                <div>
                  <h3>인증 잠금 해제</h3>
                  <p className="resource-subtitle">실패 누적 해제도 감사 로그에 남깁니다.</p>
                </div>
                <span className="status-pill is-inactive">signup</span>
              </div>
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
