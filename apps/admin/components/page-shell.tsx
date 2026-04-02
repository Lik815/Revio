import { ReactNode } from 'react';

export function PageShell({
  title,
  description,
  eyebrow = 'Prüfablauf',
  actions,
  stickyHeader = false,
  children,
}: {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  stickyHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="page-shell">
      <div className={`page-header ${stickyHeader ? 'sticky-page-header' : ''}`.trim()}>
        <div>
          <div className="kicker">{eyebrow}</div>
          <h2 className="page-title">{title}</h2>
          {description && <p className="page-description">{description}</p>}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
