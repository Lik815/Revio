import { ReactNode } from 'react';

export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="page-header">
        <div>
          <div className="kicker">Prüfablauf</div>
          <h2 style={{ margin: '6px 0 8px', fontSize: '2rem' }}>{title}</h2>
          <p style={{ margin: 0, color: 'var(--muted)', maxWidth: 760 }}>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
