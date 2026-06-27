"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeNextPath } from "@/lib/auth/onboarding";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[]; message?: string | string[] };
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nextValue = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  const nextPath = normalizeNextPath(nextValue ?? null);
  const noticeValue = Array.isArray(searchParams?.message) ? searchParams?.message[0] : searchParams?.message;
  const notice = noticeValue === "signup_complete" ? "가입이 완료되었습니다. 로그인해 주세요." : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        throw error;
      }

      const userId = data.user?.id;

      if (!userId) {
        throw new Error("로그인 후 사용자 정보를 확인할 수 없습니다.");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_approved")
        .eq("id", userId)
        .maybeSingle();

      const destination =
        profile?.is_approved || profile?.role === "admin"
          ? nextPath
          : `/pending?next=${encodeURIComponent(nextPath)}`;

      router.push(destination);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">로그인</p>
        <h1>회의실 예약 로그인</h1>
        <p className="auth-copy">이메일 인증과 관리자 승인을 마친 계정만 사용할 수 있습니다.</p>

        {notice ? <p className="auth-message">{notice}</p> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>이메일</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@samsung.com"
            />
          </label>

          <label>
            <span>비밀번호</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "처리 중..." : "로그인"}
          </button>
        </form>

        <div className="auth-actions">
          <Link className="link-button" href={`/signup?next=${encodeURIComponent(nextPath)}`}>
            회원가입 시작
          </Link>
        </div>

        {message ? <p className="auth-message">{message}</p> : null}
      </section>
    </main>
  );
}
