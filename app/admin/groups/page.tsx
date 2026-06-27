import DashboardShell from "@/components/dashboard-shell";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assignUserGroup, createGroup, deleteGroup, updateGroup } from "./actions";

const GROUPS_PAGE = "/admin/groups";

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

export default async function AdminGroupsPage({
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
    redirect(`/login?next=${encodeURIComponent(GROUPS_PAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect(profile?.is_approved ? "/account" : `/pending?next=${encodeURIComponent(GROUPS_PAGE)}`);
  }

  const [
    { data: groupsData, error: groupsError },
    { data: profilesData, error: profilesError },
  ] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, description, is_active, created_at, updated_at")
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, email, group_id, role, is_approved, created_at")
      .order("full_name", { ascending: true }),
  ]);

  if (groupsError) {
    throw groupsError;
  }

  if (profilesError) {
    throw profilesError;
  }

  const groups = groupsData ?? [];
  const users = (profilesData ?? []).filter((item) => item.role === "user" || item.role === "admin");
  const groupLabelById = new Map(groups.map((group) => [group.id, group]));

  return (
    <DashboardShell
      eyebrow="Groups"
      title="그룹 관리"
      description="그룹을 만들고, 각 사용자를 하나의 그룹에 배정합니다."
    >
      <section className="dashboard-grid">
        <article className="resource-panel resource-panel-wide">
          <div className="section-head">
            <p className="eyebrow">생성</p>
            <h2>그룹 추가</h2>
          </div>

          <form action={createGroup} className="stack-form">
            <label>
              <span>그룹 이름</span>
              <input required name="name" placeholder="기획팀" />
            </label>

            <label>
              <span>설명</span>
              <textarea rows={3} name="description" placeholder="회의실 예약 우선 그룹" />
            </label>

            <label className="checkbox-row">
              <input type="checkbox" name="is_active" defaultChecked />
              <span>활성 상태로 저장</span>
            </label>

            <button type="submit">그룹 추가</button>
          </form>

          {errorValue ? <p className="resource-message">그룹 작업에 실패했습니다.</p> : null}

          <div className="section-head section-head-spaced">
            <p className="eyebrow">List</p>
            <h2>그룹 목록</h2>
          </div>

          {groups.length ? (
            <div className="resource-list">
              {groups.map((group) => (
                <article className="resource-item" key={group.id}>
                  <div className="resource-item-top">
                    <div>
                      <h3>{group.name}</h3>
                      <p className="resource-subtitle">
                        {group.is_active ? "활성 그룹" : "비활성 그룹"}
                      </p>
                    </div>
                    <span className={`status-pill ${group.is_active ? "is-active" : "is-inactive"}`}>
                      {group.is_active ? "사용 중" : "중지"}
                    </span>
                  </div>

                  <p className="resource-copy">{group.description || "설명이 없습니다."}</p>

                  <div className="resource-meta">
                    <span>생성: {formatDate(group.created_at)}</span>
                    <span>갱신: {formatDate(group.updated_at)}</span>
                  </div>

                  <form action={updateGroup} className="stack-form">
                    <input type="hidden" name="group_id" value={group.id} />
                    <label>
                      <span>그룹 이름</span>
                      <input name="name" defaultValue={group.name} required />
                    </label>
                    <label>
                      <span>설명</span>
                      <textarea name="description" rows={3} defaultValue={group.description ?? ""} />
                    </label>
                    <label className="checkbox-row">
                      <input type="checkbox" name="is_active" defaultChecked={group.is_active} />
                      <span>활성 상태</span>
                    </label>
                    <button type="submit">수정 저장</button>
                  </form>

                  <form action={deleteGroup} className="stack-form">
                    <input type="hidden" name="group_id" value={group.id} />
                    <button type="submit" className="danger-button">
                      삭제
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <p className="resource-empty">아직 등록된 그룹이 없습니다.</p>
          )}
        </article>

        <aside className="resource-panel">
          <div className="section-head">
            <p className="eyebrow">Assign</p>
            <h2>사용자 그룹 배정</h2>
          </div>
          <p className="resource-note">
            사용자 한 명은 한 그룹만 가질 수 있습니다. 변경 내역은 히스토리 테이블에 남습니다.
          </p>

          {users.length ? (
            <div className="resource-list">
              {users.map((item) => {
                const group = item.group_id ? groupLabelById.get(item.group_id) : null;

                return (
                  <article className="resource-item" key={item.id}>
                    <div className="resource-item-top">
                      <div>
                        <h3>{item.full_name || item.email}</h3>
                        <p className="resource-subtitle">{item.email}</p>
                      </div>
                      <span className="status-pill is-owner">{group?.name || "미배정"}</span>
                    </div>

                    <div className="resource-meta">
                      <span>가입: {formatDate(item.created_at)}</span>
                      <span>{item.is_approved ? "승인됨" : "승인 대기"}</span>
                    </div>

                    <form action={assignUserGroup} className="stack-form">
                      <input type="hidden" name="user_id" value={item.id} />
                      <label>
                        <span>그룹 선택</span>
                        <select name="group_id" defaultValue={item.group_id ?? ""}>
                          <option value="">미배정</option>
                          {groups.map((groupItem) => (
                            <option key={groupItem.id} value={groupItem.id}>
                              {groupItem.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit">배정 저장</button>
                    </form>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="resource-empty">배정할 사용자가 없습니다.</p>
          )}
        </aside>
      </section>
    </DashboardShell>
  );
}
