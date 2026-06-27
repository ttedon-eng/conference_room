import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A동 19층 예약시스템</p>
          <h1>회의실 예약</h1>
          <p className="lede">
            로그인하거나 회원가입하면 회의실 예약과 운영 화면으로 들어갈 수 있습니다.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/login">
              로그인
            </Link>
            <Link className="ghost-link" href="/signup">
              회원가입
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
