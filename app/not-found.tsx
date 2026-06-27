import StateScreen from "@/components/state-screen";

export default function NotFound() {
  return (
    <StateScreen
      eyebrow="404"
      title="찾을 수 없는 화면입니다."
      description="요청한 주소가 없거나 이동된 상태입니다. 홈에서 다시 이동해 보세요."
      actions={[
        { href: "/", label: "홈으로", primary: true },
        { href: "/bookings", label: "예약 화면", primary: false },
        { href: "/rooms", label: "회의실", primary: false },
      ]}
    />
  );
}
