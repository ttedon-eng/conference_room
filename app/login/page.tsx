"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

const DEFAULT_NEXT_PATH = "/account";
const ALLOWED_SIGNUP_DOMAINS = ["samsung.com", "partner.samsung.com"] as const;

function getEmailDomain(value: string) {
  const parts = value.trim().toLowerCase().split("@");
  return parts[parts.length - 1] ?? "";
}

function canSignUpWithEmail(value: string) {
  return ALLOWED_SIGNUP_DOMAINS.includes(getEmailDomain(value) as (typeof ALLOWED_SIGNUP_DOMAINS)[number]);
}

function safeNextPath(value: string | null) {
  const nextPath = value?.trim();

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.includes("://")) {
    return DEFAULT_NEXT_PATH;
  }

  return nextPath;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nextValue = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  const nextPath = safeNextPath(nextValue ?? null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === "signup") {
        if (!canSignUpWithEmail(email)) {
          setMessage(
            `가입은 ${ALLOWED_SIGNUP_DOMAINS.join(", ")} 이메일만 가능합니다.`,
          );
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
          },
        });

        if (error) {
          throw error;
        }

        setMessage("가입 메일을 보냈습니다. 메일 인증 후 로그인해 주세요.");
        return;
      }

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
        <p className="eyebrow">Supabase Auth</p>
        <h1>{mode === "login" ? "로그인" : "회원가입"}</h1>
        <p className="auth-copy">
          삼성 계열 도메인용 회의실 예약 MVP입니다. 이메일 인증과 승인 절차를
          순서대로 붙여 나갑니다.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@samsung.com"
            />
          </label>

          <label>
            <span>Password</span>
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
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        <div className="auth-actions">
          <button
            type="button"
            className="link-button"
            onClick={() => setMode((current) => (current === "login" ? "signup" : "login"))}
          >
            {mode === "login" ? "회원가입으로 전환" : "로그인으로 전환"}
          </button>
        </div>

        {message ? <p className="auth-message">{message}</p> : null}
      </section>
    </main>
  );
}
