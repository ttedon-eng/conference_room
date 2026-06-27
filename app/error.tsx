"use client";

import Link from "next/link";
import { useEffect } from "react";
import StateScreen from "@/components/state-screen";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StateScreen
      eyebrow="오류"
      title="문제가 생겼습니다."
      description="화면을 다시 불러오면 대부분의 오류는 해결됩니다. 계속되면 홈에서 다시 시도해 주세요."
      actions={[
        { href: "/", label: "홈으로", primary: false },
        { href: "/bookings", label: "예약 화면", primary: false },
      ]}
    >
      <div className="state-actions">
        <button className="primary-link state-button" type="button" onClick={reset}>
          다시 시도
        </button>
        <Link className="ghost-link" href="/admin">
          관리자 허브
        </Link>
      </div>
    </StateScreen>
  );
}
