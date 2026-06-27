import Link from "next/link";

const highlights = [
  {
    title: "승인된 사용자만 예약",
    description:
      "회사 이메일 가입, 이메일 인증, 관리자 승인까지 이어지는 접근 흐름을 먼저 고정합니다.",
  },
  {
    title: "서울시간 기준 예약",
    description:
      "월~금, 08:00~18:00, 30분 단위, 1회 최대 1시간 규칙을 서버 기준으로 통일합니다.",
  },
  {
    title: "예약 이력과 알림",
    description:
      "생성/삭제 이벤트를 기록하고, 예약자에게 이메일 알림을 보내는 구조로 확장합니다.",
  },
];

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Conference Room</p>
          <h1>회의실 예약과 운영을 한곳에서 관리합니다.</h1>
          <p className="lede">
            회사 이메일 가입, 관리자 승인, 예약 정책, 통계와 감사 로그까지 한 흐름으로 이어지는
            회의실 예약 시스템입니다.
          </p>
          <div className="hero-meta">
            <span>회사 이메일 가입</span>
            <span>서울시간 기준 정책</span>
            <span>관리자 운영 도구</span>
          </div>
          <div className="hero-actions">
            <Link className="primary-link" href="/login">
              로그인
            </Link>
            <Link className="ghost-link" href="/signup">
              회원가입
            </Link>
          </div>
        </div>

        <aside className="panel">
          <div className="panel-header">
            <span>주요 기능</span>
            <strong>운영용</strong>
          </div>
          <ul className="checklist">
            <li>회사 이메일 가입</li>
            <li>이메일 인증</li>
            <li>관리자 승인</li>
            <li>정기 예약 관리</li>
            <li>회의실 CRUD</li>
            <li>예약 생성 / 삭제</li>
          </ul>
        </aside>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">Overview</p>
          <h2>서비스가 제공하는 기준</h2>
        </div>
        <div className="grid">
          {highlights.map((item) => (
            <article className="card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
