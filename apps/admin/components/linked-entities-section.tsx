import Link from 'next/link';
import { LinkActions } from './action-buttons';

export const LINK_STATUS_LABEL: Record<string, string> = {
  PROPOSED: 'Vorgeschlagen',
  CONFIRMED: 'Bestätigt',
  DISPUTED: 'Umstritten',
  REJECTED: 'Abgelehnt',
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Freigegeben',
  LISTED: 'Gelistet (ungeprüft)',
  PENDING_REVIEW: 'Ausstehend',
  REJECTED: 'Abgelehnt',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
  CHANGES_REQUESTED: 'Änderungen',
};

export type LinkedRow = {
  linkId: string;
  /** Linkstatus: PROPOSED | CONFIRMED | DISPUTED | REJECTED */
  status: string;
  name: string;
  sublabel?: string;
  href: string;
  /** Freigabestatus der verknüpften Entität (reviewStatus). */
  reviewStatus?: string;
  /** Ist die verknüpfte Entität öffentlich sichtbar? undefined = unbekannt. */
  publiclyVisible?: boolean;
  archived?: boolean;
};

/**
 * Sektion „Verknüpfte Therapeut:innen/Praxen" auf den Admin-Detailseiten.
 * Zeigt pro Zeile Linkstatus UND Freigabestatus — beides muss stimmen, damit
 * die Verknüpfung öffentlich trägt (siehe practice-visibility.ts).
 */
export function LinkedEntitiesSection({
  kicker,
  title,
  description,
  rows,
  emptyLabel,
  linkActions,
  children,
}: {
  kicker: string;
  title: string;
  description?: string;
  rows: LinkedRow[];
  emptyLabel: string;
  linkActions: {
    confirm: (id: string) => Promise<void>;
    reject: (id: string) => Promise<void>;
    dispute: (id: string) => Promise<void>;
  };
  /** Verknüpfungsformular — wird unter der Tabelle gerendert. */
  children?: React.ReactNode;
}) {
  return (
    <article className="panel panel--compact" style={{ marginTop: 20 }}>
      <div className="panel-header">
        <div className="panel-header__content">
          <div className="kicker">{kicker}</div>
          <h3>{title}</h3>
          {description ? (
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>{description}</p>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>{emptyLabel}</p>
      ) : (
        <table className="table table--elevated">
          <thead>
            <tr>
              <th>Name</th>
              <th>Verknüpfung</th>
              <th>Freigabe</th>
              <th>Öffentlich</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.linkId}>
                <td data-label="Name">
                  <Link href={row.href}>{row.name}</Link>
                  {row.sublabel ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{row.sublabel}</div>
                  ) : null}
                  {row.archived ? (
                    <div style={{ color: 'var(--warning, #b45309)', fontSize: 12 }}>Archiviert</div>
                  ) : null}
                </td>
                <td data-label="Verknüpfung">
                  <span className={`badge badge--${row.status}`}>
                    {LINK_STATUS_LABEL[row.status] ?? row.status}
                  </span>
                </td>
                <td data-label="Freigabe">
                  {row.reviewStatus ? (
                    <span className={`badge badge--${row.reviewStatus}`}>
                      {REVIEW_STATUS_LABEL[row.reviewStatus] ?? row.reviewStatus}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  )}
                </td>
                <td data-label="Öffentlich">
                  {row.publiclyVisible === undefined ? (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  ) : row.publiclyVisible ? (
                    'Ja'
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>Nein</span>
                  )}
                </td>
                <td data-label="Aktionen">
                  <LinkActions id={row.linkId} status={row.status} actions={linkActions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {children ? <div style={{ marginTop: 16 }}>{children}</div> : null}
    </article>
  );
}
