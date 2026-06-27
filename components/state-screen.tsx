import Link from "next/link";
import type { ReactNode } from "react";

type Action = {
  href: string;
  label: string;
  primary?: boolean;
};

export default function StateScreen({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: Action[];
  children?: ReactNode;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card state-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="auth-copy">{description}</p>

        {children ? <div className="state-content">{children}</div> : null}

        {actions?.length ? (
          <div className="auth-actions state-actions">
            {actions.map((action) => (
              <Link
                className={action.primary ? "primary-link" : "ghost-link"}
                href={action.href}
                key={action.href}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
