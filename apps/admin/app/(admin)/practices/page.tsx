import { PageShell } from '../../../components/page-shell';
import { PracticeActions } from '../../../components/action-buttons';
import { DeadlineTimer } from '../../../components/deadline-timer';
import { api } from '../../../lib/api';
import { approvePractice, rejectPractice, suspendPractice } from '../../../lib/actions';

type SearchParams = Promise<{ status?: string; q?: string; city?: string }>;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Ausstehend',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
};

const statusPriority: Record<string, number> = {
  PENDING_REVIEW: 0,
  DRAFT: 1,
  REJECTED: 2,
  SUSPENDED: 3,
  APPROVED: 4,
};

function getPracticePriority(p: { reviewStatus: string; createdAt: string; links?: { status: string }[] }) {
  const ageHours = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
  const proposedLinks = p.links?.filter((link) => link.status === 'PROPOSED').length ?? 0;
  const overdue = p.reviewStatus === 'PENDING_REVIEW' && ageHours >= 48;
  const label = overdue
    ? 'Über SLA'
    : p.reviewStatus === 'PENDING_REVIEW'
      ? 'Freigabe offen'
      : proposedLinks > 0
        ? 'Verknüpfungen prüfen'
        : p.reviewStatus === 'APPROVED'
          ? 'Stabil'
          : 'Beobachten';

  return {
    overdue,
    proposedLinks,
    label,
    weight: (statusPriority[p.reviewStatus] ?? 9) * 1000 - ageHours - proposedLinks * 5 - (overdue ? 500 : 0),
  };
}

export default async function PracticesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const practices = await api.getPractices();
  const statusFilter = params.status ?? 'ALL';
  const q = (params.q ?? '').toLowerCase();
  const city = (params.city ?? '').toLowerCase();

  const filtered = practices.filter((p) => {
    const matchesStatus = statusFilter === 'ALL' || p.reviewStatus === statusFilter;
    const haystack = [p.name, p.city, p.address ?? ''].join(' ').toLowerCase();
    const matchesQuery = !q || haystack.includes(q);
    const matchesCity = !city || p.city.toLowerCase().includes(city);
    return matchesStatus && matchesQuery && matchesCity;
  }).sort((a, b) => getPracticePriority(a).weight - getPracticePriority(b).weight);

  const pendingCount = filtered.filter((p) => p.reviewStatus === 'PENDING_REVIEW').length;
  const overdueCount = filtered.filter((p) => getPracticePriority(p).overdue).length;
  const linkedCount = filtered.filter((p) => getPracticePriority(p).proposedLinks > 0).length;

  return (
    <PageShell
      title="Praxis-Warteschlange"
      description="Behalte Praxiseinreichungen im Blick, die auf Freigabe warten, und prüfe verknüpfte Therapeut:innen-Aktivitäten, bevor etwas veröffentlicht wird."
      eyebrow="Reviews"
      actions={<div className="hero-pill">{filtered.length} Ergebnisse</div>}
    >
      <div className="review-summary-grid">
        <article className="review-summary-card">
          <div className="kicker">Jetzt prüfen</div>
          <strong>{pendingCount}</strong>
          <span>Praxen warten aktuell auf Freigabe</span>
        </article>
        <article className="review-summary-card review-summary-card--warning">
          <div className="kicker">SLA-Risiko</div>
          <strong>{overdueCount}</strong>
          <span>Praxen liegen länger als 48 Stunden offen</span>
        </article>
        <article className="review-summary-card">
          <div className="kicker">Mit Links</div>
          <strong>{linkedCount}</strong>
          <span>Diese Praxen haben parallele Verknüpfungen im Review</span>
        </article>
      </div>

      <form className="toolbar" action="/practices">
        <input name="q" defaultValue={params.q ?? ''} className="toolbar-input" placeholder="Nach Praxisname oder Adresse suchen" />
        <input name="city" defaultValue={params.city ?? ''} className="toolbar-input toolbar-input--sm" placeholder="Stadt" />
        <select name="status" defaultValue={statusFilter} className="toolbar-select">
          <option value="ALL">Alle Status</option>
          <option value="PENDING_REVIEW">Ausstehend</option>
          <option value="APPROVED">Freigegeben</option>
          <option value="REJECTED">Abgelehnt</option>
          <option value="SUSPENDED">Gesperrt</option>
        </select>
        <button className="primary-btn" type="submit">Filtern</button>
      </form>

      {filtered.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <div className="empty-illustration">🏥</div>
          <strong>Keine Praxen für diese Filter</strong>
          <p>Es gibt aktuell keine passenden Praxiseinreichungen in diesem Ausschnitt der Warteschlange.</p>
        </div>
      ) : (
      <table className="table table--elevated">
        <thead>
          <tr>
            <th>Name</th>
            <th>Priorität</th>
            <th>Ort</th>
            <th>Adresse</th>
            <th>Verknüpfte Therapeut:innen</th>
            <th>Eingereicht</th>
            <th>Frist (48h)</th>
            <th>Status</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            (() => {
              const priority = getPracticePriority(p);
              return (
            <tr key={p.id}>
              <td data-label="Name">
                <div className="entity-cell">
                  <div className="entity-avatar entity-avatar--soft">{p.name.slice(0, 1)}</div>
                  <div>
                    <strong>{p.name}</strong>
                    <div className="entity-meta">{p.phone ?? 'Keine Telefonnummer'}</div>
                  </div>
                </div>
              </td>
              <td data-label="Priorität">
                <div className="priority-stack">
                  <span className={`badge ${priority.overdue ? 'badge--REJECTED' : 'badge--PENDING_REVIEW'}`}>{priority.label}</span>
                  {priority.proposedLinks > 0 && (
                    <span className="entity-meta">{priority.proposedLinks} offene Links</span>
                  )}
                </div>
              </td>
              <td data-label="Ort">{p.city}</td>
              <td data-label="Adresse" style={{ color: 'var(--muted)', fontSize: 13 }}>{p.address ?? '—'}</td>
              <td data-label="Verknüpfte Therapeut:innen">{p.links?.length ?? 0}</td>
              <td data-label="Eingereicht">{formatDate(p.createdAt)}</td>
              <td data-label="Frist (48h)">
                <DeadlineTimer createdAt={p.createdAt} status={p.reviewStatus} />
              </td>
              <td data-label="Status">
                <span className={`badge badge--${p.reviewStatus}`}>
                  {statusLabel[p.reviewStatus] ?? p.reviewStatus}
                </span>
              </td>
              <td data-label="Aktionen">
                <PracticeActions
                  id={p.id}
                  status={p.reviewStatus}
                  actions={{
                    approve: approvePractice,
                    reject: rejectPractice,
                    suspend: suspendPractice,
                  }}
                />
              </td>
            </tr>
            );
            })()
          ))}
        </tbody>
      </table>
      )}
    </PageShell>
  );
}
