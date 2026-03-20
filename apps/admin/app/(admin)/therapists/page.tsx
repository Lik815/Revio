import { PageShell } from '../../../components/page-shell';
import { TherapistActions } from '../../../components/action-buttons';
import { DeadlineTimer } from '../../../components/deadline-timer';
import { api } from '../../../lib/api';
import {
  approveTherapist,
  rejectTherapist,
  requestChangesTherapist,
  suspendTherapist,
} from '../../../lib/actions';

type SearchParams = Promise<{ status?: string; q?: string; city?: string }>;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Ausstehend',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  CHANGES_REQUESTED: 'Änderungen',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
};

const statusPriority: Record<string, number> = {
  PENDING_REVIEW: 0,
  CHANGES_REQUESTED: 1,
  DRAFT: 2,
  REJECTED: 3,
  SUSPENDED: 4,
  APPROVED: 5,
};

function missingProfileCount(t: {
  bio?: string | null;
  specializations?: string[];
  languages?: string[];
}) {
  let count = 0;
  if (!t.bio?.trim()) count++;
  if (!t.specializations?.length) count++;
  if (!t.languages?.length) count++;
  return count;
}

function getReviewPriority(t: {
  reviewStatus: string;
  createdAt: string;
  bio?: string | null;
  specializations?: string[];
  languages?: string[];
}) {
  const ageHours = (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
  const missingCount = missingProfileCount(t);
  const overdue = t.reviewStatus === 'PENDING_REVIEW' && ageHours >= 48;
  const label = overdue
    ? 'Über SLA'
    : t.reviewStatus === 'PENDING_REVIEW'
      ? 'Review offen'
      : t.reviewStatus === 'CHANGES_REQUESTED'
        ? 'Nachfassen'
        : t.reviewStatus === 'DRAFT'
          ? 'Unvollständig'
          : t.reviewStatus === 'APPROVED'
            ? 'Stabil'
            : 'Beobachten';

  const weight = (statusPriority[t.reviewStatus] ?? 9) * 1000 - ageHours + missingCount * 10 - (overdue ? 500 : 0);
  return { overdue, missingCount, label, weight };
}

export default async function TherapistsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const therapists = await api.getTherapists();

  const statusFilter = params.status ?? 'ALL';
  const q = (params.q ?? '').toLowerCase();
  const city = (params.city ?? '').toLowerCase();

  const filtered = therapists.filter((t) => {
    const matchesStatus = statusFilter === 'ALL' || t.reviewStatus === statusFilter;
    const matchesQuery = !q || [t.fullName, t.professionalTitle, t.city, t.specializations.join(' ')].join(' ').toLowerCase().includes(q);
    const matchesCity = !city || t.city.toLowerCase().includes(city);
    return matchesStatus && matchesQuery && matchesCity;
  }).sort((a, b) => getReviewPriority(a).weight - getReviewPriority(b).weight);

  const pendingCount = filtered.filter((t) => t.reviewStatus === 'PENDING_REVIEW').length;
  const overdueCount = filtered.filter((t) => getReviewPriority(t).overdue).length;
  const incompleteCount = filtered.filter((t) => getReviewPriority(t).missingCount > 0 && t.reviewStatus !== 'APPROVED').length;

  return (
    <PageShell
      title="Therapeut:innen-Warteschlange"
      description="Prüfe neu eingereichte Therapeut:innen, fordere Korrekturen bei unvollständigen Profildaten an und halte Freigaben bewusst und nachvollziehbar."
      eyebrow="Reviews"
      actions={<div className="hero-pill">{filtered.length} Ergebnisse</div>}
    >
      <div className="review-summary-grid">
        <article className="review-summary-card">
          <div className="kicker">Jetzt prüfen</div>
          <strong>{pendingCount}</strong>
          <span>Therapeut:innen warten aktuell auf Erstreview</span>
        </article>
        <article className="review-summary-card review-summary-card--warning">
          <div className="kicker">SLA-Risiko</div>
          <strong>{overdueCount}</strong>
          <span>Fälle liegen schon länger als 48 Stunden offen</span>
        </article>
        <article className="review-summary-card">
          <div className="kicker">Unvollständig</div>
          <strong>{incompleteCount}</strong>
          <span>Profile brauchen vermutlich Rückfragen oder Änderungen</span>
        </article>
      </div>

      <form className="toolbar" action="/therapists">
        <input name="q" defaultValue={params.q ?? ''} className="toolbar-input" placeholder="Nach Name, Stadt oder Spezialisierung suchen" />
        <input name="city" defaultValue={params.city ?? ''} className="toolbar-input toolbar-input--sm" placeholder="Stadt" />
        <select name="status" defaultValue={statusFilter} className="toolbar-select">
          <option value="ALL">Alle Status</option>
          <option value="PENDING_REVIEW">Ausstehend</option>
          <option value="APPROVED">Freigegeben</option>
          <option value="CHANGES_REQUESTED">Änderungen</option>
          <option value="REJECTED">Abgelehnt</option>
          <option value="SUSPENDED">Gesperrt</option>
        </select>
        <button className="primary-btn" type="submit">Filtern</button>
      </form>

      {filtered.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <div className="empty-illustration">🗂️</div>
          <strong>Keine Therapeut:innen für diese Filter</strong>
          <p>Versuche einen anderen Status, entferne Suchbegriffe oder prüfe die Warteschlange ohne Standortfilter.</p>
        </div>
      ) : (
      <table className="table table--elevated">
        <thead>
          <tr>
            <th>Name</th>
            <th>Priorität</th>
            <th>Titel</th>
            <th>Ort</th>
            <th>Spezialisierungen</th>
            <th>Eingereicht</th>
            <th>Frist (48h)</th>
            <th>Status</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => (
            (() => {
              const priority = getReviewPriority(t);
              return (
              <tr key={t.id}>
                <td data-label="Name">
                  <div className="entity-cell">
                    <div className="entity-avatar">{t.fullName.slice(0, 1)}</div>
                    <div>
                      <strong>{t.fullName}</strong>
                      <div className="entity-meta">{t.email}</div>
                    </div>
                  </div>
                </td>
                <td data-label="Priorität">
                  <div className="priority-stack">
                    <span className={`badge ${priority.overdue ? 'badge--REJECTED' : 'badge--PENDING_REVIEW'}`}>{priority.label}</span>
                    {priority.missingCount > 0 && (
                      <span className="entity-meta">{priority.missingCount} Lücken</span>
                    )}
                  </div>
                </td>
                <td data-label="Titel">{t.professionalTitle}</td>
                <td data-label="Ort">{t.city}</td>
                <td data-label="Spezialisierungen"><div className="tag-list">{t.specializations.slice(0, 3).map((spec) => <span key={spec} className="tag">{spec}</span>)}</div></td>
                <td data-label="Eingereicht">{formatDate(t.createdAt)}</td>
                <td data-label="Frist (48h)">
                  <DeadlineTimer createdAt={t.createdAt} status={t.reviewStatus} />
                </td>
                <td data-label="Status">
                  <span className={`badge badge--${t.reviewStatus}`}>
                    {statusLabel[t.reviewStatus] ?? t.reviewStatus}
                  </span>
                </td>
                <td data-label="Aktionen">
                  <TherapistActions
                    id={t.id}
                    status={t.reviewStatus}
                    actions={{
                      approve: approveTherapist,
                      reject: rejectTherapist,
                      requestChanges: requestChangesTherapist,
                      suspend: suspendTherapist,
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
