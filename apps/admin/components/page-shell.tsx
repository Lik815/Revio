import { ReactNode } from 'react';

export function PageShell({
  title,
  description,
  eyebrow = 'Prüfablauf',
  actions,
  children,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="page-shell">
      <div className="page-header sticky-page-header">
        <div>
          <div className="kicker">{eyebrow}</div>
          <h2 className="page-title">{title}</h2>
          <p className="page-description">{description}</p>
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
