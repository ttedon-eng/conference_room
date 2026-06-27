import Link from "next/link";

export default function Home() {
  return (
    <main className="auth-shell home-shell">
      <section className="auth-card home-card">
        <p className="eyebrow">A동 19층 예약시스템</p>
        <h1>회의실 예약</h1>
        <p className="auth-copy">로그인 후 이번 주 예약 화면으로 바로 들어갑니다.</p>
        <div className="hero-actions">
          <Link className="primary-link" href="/login">
            로그인
          </Link>
          <Link className="ghost-link link-button" href="/signup">
            회원가입
          </Link>
        </div>
      </section>
    </main>
  );
}
