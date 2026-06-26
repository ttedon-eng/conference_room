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
          <p className="eyebrow">Conference Room MVP</p>
          <h1>회의실 예약 시스템의 첫 화면입니다.</h1>
          <p className="lede">
            지금은 Vercel과 Supabase 연동을 위한 초기 개발 단계입니다. 기본
            정책을 지키는 예약 시스템으로 점차 확장해 나갑니다.
          </p>
          <div className="hero-meta">
            <span>Vercel 자동 배포</span>
            <span>Supabase 연동 준비</span>
            <span>Asia/Seoul 기준</span>
          </div>
        </div>

        <aside className="panel">
          <div className="panel-header">
            <span>초기 범위</span>
            <strong>P0 MVP</strong>
          </div>
          <ul className="checklist">
            <li>회사 이메일 가입</li>
            <li>이메일 인증</li>
            <li>관리자 승인</li>
            <li>회의실 CRUD</li>
            <li>예약 생성 / 삭제</li>
          </ul>
        </aside>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">What we are building</p>
          <h2>MVP가 먼저 다져야 할 것들</h2>
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

