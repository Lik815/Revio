import { PageShell } from '../../../components/page-shell';
import { LinkActions } from '../../../components/action-buttons';
import { api } from '../../../lib/api';
import { confirmLink, rejectLink, disputeLink } from '../../../lib/actions';

type SearchParams = Promise<{ status?: string; q?: string }>;

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

const statusPriority: Record<string, number> = {
  DISPUTED: 0,
  PROPOSED: 1,
  REJECTED: 2,
  CONFIRMED: 3,
};

export default async function LinksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const links = await api.getLinks();
  const statusFilter = params.status ?? 'ALL';
  const q = (params.q ?? '').toLowerCase();

  // A link is "broken chain" when both therapist + practice are approved, but link itself is not confirmed
  const brokenChains = links.filter(
    (l) =>
      l.status !== 'CONFIRMED' &&
      (l.therapist as unknown as { reviewStatus?: string } & typeof l.therapist).reviewStatus === 'APPROVED' &&
      (l.practice as unknown as { reviewStatus?: string } & typeof l.practice).reviewStatus === 'APPROVED',
  );

  const filtered = links
    .filter((l) => {
      const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
      const haystack = [l.therapist.fullName, l.practice.name].join(' ').toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      return matchesStatus && matchesQuery;
    })
    .sort((a, b) => {
      const aBroken = brokenChains.some((item) => item.id === a.id) ? 0 : 1;
      const bBroken = brokenChains.some((item) => item.id === b.id) ? 0 : 1;
      if (aBroken !== bBroken) return aBroken - bBroken;
      return (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9);
    });

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
      <div className="review-summary-grid">
        <article className="review-summary-card review-summary-card--warning">
          <div className="kicker">Blockiert</div>
          <strong>{brokenChains.length}</strong>
          <span>Freigegebene Profile bleiben ohne bestätigten Link unsichtbar</span>
        </article>
        <article className="review-summary-card">
          <div className="kicker">Umstritten</div>
          <strong>{links.filter((l) => l.status === 'DISPUTED').length}</strong>
          <span>Diese Beziehungen brauchen aktive Klärung</span>
        </article>
        <article className="review-summary-card">
          <div className="kicker">Vorgeschlagen</div>
          <strong>{links.filter((l) => l.status === 'PROPOSED').length}</strong>
          <span>Noch unbestätigte Verknüpfungen zwischen Praxis und Profil</span>
        </article>
      </div>

      {brokenChains.length > 0 && (
        <div className="notice-box notice-box--warning">
          <strong>⚠️ Blockierte Sichtbarkeit:</strong>{' '}
          {brokenChains.length} Verknüpfung{brokenChains.length !== 1 ? 'en sind' : ' ist'} noch nicht bestätigt,
          obwohl Therapeut:in und Praxis bereits freigegeben sind — diese Einträge erscheinen noch nicht in der Suche.
        </div>
      )}

      <form className="toolbar toolbar--compact" action="/links">
        <input name="q" defaultValue={params.q ?? ''} className="toolbar-input" placeholder="Nach Therapeut:in oder Praxis suchen" />
        <select name="status" defaultValue={statusFilter} className="toolbar-select">
          <option value="ALL">Alle Status</option>
          <option value="DISPUTED">Umstritten</option>
          <option value="PROPOSED">Vorgeschlagen</option>
          <option value="CONFIRMED">Bestätigt</option>
          <option value="REJECTED">Abgelehnt</option>
        </select>
        <button className="primary-btn" type="submit">Filtern</button>
      </form>

      {filtered.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <div className="empty-illustration">🔗</div>
          <strong>Keine Verknüpfungen für diese Filter</strong>
          <p>Im gewählten Ausschnitt gibt es aktuell keine passenden Link-Fälle.</p>
        </div>
      ) : (
      <table className="table table--elevated">
        <thead>
          <tr>
            <th>Priorität</th>
            <th>Therapeut:in</th>
            <th>Praxis</th>
            <th>Link-Status</th>
            <th>Eingereicht</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((l) => {
            const tStatus = (l.therapist as unknown as { reviewStatus?: string } & typeof l.therapist).reviewStatus;
            const pStatus = (l.practice as unknown as { reviewStatus?: string } & typeof l.practice).reviewStatus;
            const isBroken = l.status !== 'CONFIRMED' && tStatus === 'APPROVED' && pStatus === 'APPROVED';

            return (
              <tr key={l.id} className={isBroken ? 'row--warning' : undefined}>
                <td data-label="Priorität">
                  <div className="priority-stack">
                    <span className={`badge ${isBroken ? 'badge--REJECTED' : l.status === 'DISPUTED' ? 'badge--DISPUTED' : 'badge--PROPOSED'}`}>
                      {isBroken ? 'Blockiert' : l.status === 'DISPUTED' ? 'Konflikt' : l.status === 'PROPOSED' ? 'Offen' : 'Stabil'}
                    </span>
                    {isBroken && <span className="entity-meta">Suche blockiert</span>}
                  </div>
                </td>
                <td data-label="Therapeut:in">
                  <div>{l.therapist.fullName}</div>
                  {tStatus && (
                    <span className={`badge badge--${tStatus}`} style={{ fontSize: 11 }}>
                      {reviewLabel[tStatus] ?? tStatus}
                    </span>
                  )}
                </td>
                <td data-label="Praxis">
                  <div>{l.practice.name}</div>
                  {pStatus && (
                    <span className={`badge badge--${pStatus}`} style={{ fontSize: 11 }}>
                      {reviewLabel[pStatus] ?? pStatus}
                    </span>
                  )}
                </td>
                <td data-label="Link-Status">
                  <span className={`badge badge--${l.status}`}>
                    {statusLabel[l.status] ?? l.status}
                  </span>
                  {isBroken && <span style={{ marginLeft: 6, fontSize: 13 }}>⚠️</span>}
                </td>
                <td data-label="Eingereicht">{formatDate(l.createdAt)}</td>
                <td data-label="Aktionen">
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
      )}
    </PageShell>
  );
}
