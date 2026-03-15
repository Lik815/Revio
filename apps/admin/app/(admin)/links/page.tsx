import { PageShell } from '../../../components/page-shell';
import { LinkActions } from '../../../components/action-buttons';
import { api } from '../../../lib/api';
import { confirmLink, rejectLink, disputeLink } from '../../../lib/actions';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const statusLabel: Record<string, string> = {
  PROPOSED: 'Vorgeschlagen',
  CONFIRMED: 'Bestätigt',
  DISPUTED: 'Umstritten',
  REJECTED: 'Abgelehnt',
};

const reviewLabel: Record<string, string> = {
  APPROVED: 'Freigegeben',
  PENDING_REVIEW: 'Ausstehend',
  REJECTED: 'Abgelehnt',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
  CHANGES_REQUESTED: 'Änderungen',
};

export default async function LinksPage() {
  const links = await api.getLinks();

  // A link is "broken chain" when both therapist + practice are approved, but link itself is not confirmed
  const brokenChains = links.filter(
    (l) =>
      l.status !== 'CONFIRMED' &&
      (l.therapist as unknown as { reviewStatus?: string } & typeof l.therapist).reviewStatus === 'APPROVED' &&
      (l.practice as unknown as { reviewStatus?: string } & typeof l.practice).reviewStatus === 'APPROVED',
  );

  return (
    <PageShell
      title="Verknüpfungsübersicht"
      description="Prüfe vorgeschlagene und umstrittene Verknüpfungen zwischen Therapeut:innen und Praxen, damit nur bestätigte Beziehungen in der öffentlichen Suche sichtbar werden."
      eyebrow="Review-Konflikte"
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {brokenChains.length > 0 && (
            <span className="badge badge--REJECTED">⚠️ {brokenChains.length} blockiert</span>
          )}
          <div className="hero-pill">{links.length} Verknüpfungen</div>
        </div>
      }
    >
      {brokenChains.length > 0 && (
        <div className="notice-box notice-box--warning">
          <strong>⚠️ Blockierte Sichtbarkeit:</strong>{' '}
          {brokenChains.length} Verknüpfung{brokenChains.length !== 1 ? 'en sind' : ' ist'} noch nicht bestätigt,
          obwohl Therapeut:in und Praxis bereits freigegeben sind — diese Einträge erscheinen noch nicht in der Suche.
        </div>
      )}

      <table className="table table--elevated">
        <thead>
          <tr>
            <th>Therapeut:in</th>
            <th>Praxis</th>
            <th>Link-Status</th>
            <th>Eingereicht</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => {
            const tStatus = (l.therapist as unknown as { reviewStatus?: string } & typeof l.therapist).reviewStatus;
            const pStatus = (l.practice as unknown as { reviewStatus?: string } & typeof l.practice).reviewStatus;
            const isBroken = l.status !== 'CONFIRMED' && tStatus === 'APPROVED' && pStatus === 'APPROVED';

            return (
              <tr key={l.id} style={isBroken ? { background: 'var(--warning-bg, #FFF8E1)' } : undefined}>
                <td>
                  <div>{l.therapist.fullName}</div>
                  {tStatus && (
                    <span className={`badge badge--${tStatus}`} style={{ fontSize: 11 }}>
                      {reviewLabel[tStatus] ?? tStatus}
                    </span>
                  )}
                </td>
                <td>
                  <div>{l.practice.name}</div>
                  {pStatus && (
                    <span className={`badge badge--${pStatus}`} style={{ fontSize: 11 }}>
                      {reviewLabel[pStatus] ?? pStatus}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`badge badge--${l.status}`}>
                    {statusLabel[l.status] ?? l.status}
                  </span>
                  {isBroken && <span style={{ marginLeft: 6, fontSize: 13 }}>⚠️</span>}
                </td>
                <td>{formatDate(l.createdAt)}</td>
                <td>
                  <LinkActions
                    id={l.id}
                    status={l.status}
                    actions={{
                      confirm: confirmLink,
                      reject: rejectLink,
                      dispute: disputeLink,
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PageShell>
  );
}
