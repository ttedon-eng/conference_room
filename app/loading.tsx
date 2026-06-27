import StateScreen from "@/components/state-screen";

export default function Loading() {
  return (
    <StateScreen
      eyebrow="불러오는 중"
      title="화면을 준비하고 있습니다."
      description="예약, 회의실, 관리자 화면 데이터를 불러오는 중입니다. 잠시만 기다려 주세요."
    >
      <div className="state-placeholder-grid" aria-hidden="true">
        <div className="state-placeholder state-placeholder-wide" />
        <div className="state-placeholder" />
        <div className="state-placeholder" />
        <div className="state-placeholder state-placeholder-medium" />
      </div>
    </StateScreen>
  );
}
