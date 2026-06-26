import Link from "next/link";

export default function PendingPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Approval Pending</p>
        <h1>관리자 승인을 기다리는 중입니다.</h1>
        <p className="auth-copy">
          이메일 인증은 끝났지만 아직 서비스 승인 전입니다. 승인되면 회의실
          예약 화면으로 이동할 수 있습니다.
        </p>
        <Link className="primary-link" href="/login">
          로그인으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
