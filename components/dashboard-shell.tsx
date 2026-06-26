import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "홈" },
  { href: "/rooms", label: "회의실" },
  { href: "/bookings", label: "예약" },
  { href: "/account", label: "계정" },
];

export default function DashboardShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="dashboard-lede">{description}</p>
        </div>

        <div className="dashboard-hero-aside">
          <div className="dashboard-nav">
            {navItems.map((item) => (
              <Link className="dashboard-chip" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {children}
    </main>
  );
}
