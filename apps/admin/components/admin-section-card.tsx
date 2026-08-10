import { ReactNode } from 'react';

export function AdminSectionCard({
  id,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article id={id} className="panel panel--compact" style={id ? { scrollMarginTop: 24 } : undefined}>
      {(eyebrow || title || description || actions) ? (
        <div className="panel-header panel-header--split">
          <div className="panel-header__content">
            {eyebrow ? <div className="kicker">{eyebrow}</div> : null}
            {title ? <h3>{title}</h3> : null}
            {description ? <p className="panel-header__description">{description}</p> : null}
          </div>
          {actions ? <div className="panel-header__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </article>
  );
}
