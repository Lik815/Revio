import Link from 'next/link';
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

function summarizeReasons(reasons: string[]) {
  if (reasons.length === 0) return null;
  const [first, ...rest] = reasons;
  return rest.length > 0 ? `${first} +${rest.length}` : first;
}

function humanizeReason(reason: string) {
  return blockingReasonLabel[reason] ?? reason.replace(/_/g, ' ');
}

function getVisibilityMeta(t: {
  reviewStatus: string;
  isVisible: boolean;
  visibility: { visibilityState: string; blockingReasons: string[] };
}) {
  if (t.reviewStatus !== 'APPROVED') {
    return 'Wird nach Freigabe sichtbar.';
  }
  if (!t.isVisible) {
    return 'Manuell ausgeblendet.';
  }
  if (t.visibility.visibilityState === 'visible') {
    return 'Sichtbar in der Suche.';
  }
  const reasons = t.visibility.blockingReasons.map(humanizeReason);
  return summarizeReasons(reasons) ?? 'Noch nicht sichtbar.';
}

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Ausstehend',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  CHANGES_REQUESTED: 'Änderungen',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
};

const blockingReasonLabel: Record<string, string> = {
  profile_incomplete: 'Profil unvollständig',
  manually_hidden: 'Manuell versteckt',
  publication_missing: 'Freigabe fehlt',
  no_home_visit: 'Kein Hausbesuch',
  no_service_radius: 'Kein Einzugsgebiet',
  no_kassenart: 'Keine Kassenart',
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
      title="Therapeut:innen"
      description="Review, Öffentlichkeit und die nächste sinnvolle Entscheidung."
      eyebrow="Reviews"
      actions={<div className="hero-pill">{filtered.length} Ergebnisse</div>}
    >
      <div className="review-summary-grid">
        <article className="review-summary-card">
          <div className="kicker">Offen</div>
          <strong>{pendingCount}</strong>
          <span>Warten auf Review</span>
        </article>
        <article className="review-summary-card review-summary-card--warning">
          <div className="kicker">Überfällig</div>
          <strong>{overdueCount}</strong>
          <span>Länger als 48 Stunden offen</span>
        </article>
        <article className="review-summary-card">
          <div className="kicker">Mit Lücken</div>
          <strong>{incompleteCount}</strong>
          <span>Brauchen Rückfragen</span>
        </article>
      </div>

      <form className="toolbar" action="/therapists">
        <input name="q" defaultValue={params.q ?? ''} className="toolbar-input" placeholder="Name, Stadt oder Spezialisierung" />
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
      <>
      <p className="table-note">Die Liste zeigt nur die Kernsignale. Fachdetails liegen auf der Detailseite.</p>
      <table className="table table--elevated focus-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Profil</th>
            <th>Review</th>
            <th>Öffentlich</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => (
            (() => {
              const priority = getReviewPriority(t);
              const publicVisibilityBadge =
                t.reviewStatus === 'APPROVED' && t.isVisible
                  ? { label: 'Öffentlich', className: 'badge badge--APPROVED' }
                  : t.reviewStatus === 'APPROVED' && !t.isVisible
                    ? { label: 'Versteckt', className: 'badge badge--PENDING_REVIEW' }
                    : { label: 'Noch nicht', className: 'badge badge--DRAFT' };
              const isApprovedButNotVisible = t.reviewStatus === 'APPROVED' && t.visibility.visibilityState !== 'visible';
              const blockerReasons = (
                t.visibility.blockingReasons.length > 0
                  ? t.visibility.blockingReasons
                  : isApprovedButNotVisible
                    ? ['manually_hidden']
                    : []
              ).map((reason) => blockingReasonLabel[reason] ?? reason);
              return (
              <tr key={t.id}>
                <td data-label="Name">
                  <div className="entity-cell">
                    <div className="entity-avatar">{t.fullName.slice(0, 1)}</div>
                    <div>
                      <Link href={`/therapists/${t.id}`} style={{ fontWeight: 600 }}>{t.fullName}</Link>
                      <div className="entity-meta">{t.email}</div>
                    </div>
                  </div>
                </td>
                <td data-label="Überblick">
                    <div className="priority-stack">
                      <strong style={{ fontSize: 14 }}>{t.city}</strong>
                      <span className="entity-meta">{t.professionalTitle}</span>
                      <div className="tag-list">
                      {t.specializations.slice(0, 2).map((spec) => <span key={spec} className="tag">{spec}</span>)}
                      {t.specializations.length > 2 && <span className="tag">+{t.specializations.length - 2}</span>}
                    </div>
                    <span className="entity-meta">Eingereicht {formatDate(t.createdAt)}</span>
                  </div>
                </td>
                <td data-label="Review">
                  <div className="priority-stack">
                    <span className={`badge badge--${t.reviewStatus}`}>
                      {statusLabel[t.reviewStatus] ?? t.reviewStatus}
                    </span>
                    {priority.overdue ? (
                      <span className="entity-meta">Seit über 48 Stunden offen</span>
                    ) : t.reviewStatus === 'PENDING_REVIEW' ? (
                      <DeadlineTimer createdAt={t.createdAt} status={t.reviewStatus} />
                    ) : priority.missingCount > 0 && t.reviewStatus !== 'APPROVED' ? (
                      <span className="entity-meta">Profil braucht Ergänzungen</span>
                    ) : t.reviewStatus === 'APPROVED' ? (
                      <span className="entity-meta">Kein offener Review</span>
                    ) : null}
                  </div>
                </td>
                <td data-label="Öffentlich">
                  <div className="priority-stack">
                    <span className={publicVisibilityBadge.className}>
                      {publicVisibilityBadge.label}
                    </span>
                    <span className="entity-meta" title={blockerReasons.join(', ')}>
                      {getVisibilityMeta(t)}
                    </span>
                  </div>
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
      </>
      )}
    </PageShell>
  );
}
