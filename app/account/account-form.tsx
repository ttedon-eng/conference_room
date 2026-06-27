"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin" | null;
  is_approved: boolean;
};

export default function AccountForm({
  user,
  initialProfile,
}: {
  user: Pick<User, "id" | "email">;
  initialProfile: Profile | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [fullName, setFullName] = useState(initialProfile?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatar_url ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isApproved = initialProfile?.is_approved ?? false;
  const isAdmin = initialProfile?.role === "admin";

  const updateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      setMessage("프로필을 저장했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login?next=%2Faccount");
    router.refresh();
  };

  return (
    <section className="account-card">
      <div className="account-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>내 계정</h1>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "flex-end" }}>
          {isAdmin ? (
            <>
              <Link className="ghost-link" href="/admin">
                관리자 허브
              </Link>
              <Link className="ghost-link" href="/admin/approvals">
                승인 관리
              </Link>
              <Link className="ghost-link" href="/admin/stats">
                예약 통계
              </Link>
            </>
          ) : null}
          <button type="button" className="ghost-button" onClick={signOut}>
            로그아웃
          </button>
        </div>
      </div>

      <div className="account-badges">
        <span>{user.email ?? "이메일 없음"}</span>
        <span>{isApproved ? "승인됨" : "승인 대기"}</span>
        {isAdmin ? <span>관리자</span> : null}
      </div>

      <form className="auth-form" onSubmit={updateProfile}>
        <label>
          <span>Full name</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="홍길동"
          />
        </label>

        <label>
          <span>Avatar URL</span>
          <input
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://..."
          />
        </label>

        <button type="submit" disabled={saving}>
          {saving ? "저장 중..." : "프로필 저장"}
        </button>
      </form>

      {message ? (
        <p className="auth-message" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
