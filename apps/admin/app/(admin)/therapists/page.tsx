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

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Ausstehend',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  CHANGES_REQUESTED: 'Änderungen',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
};

const visibilityLabel: Record<string, string> = {
  visible: 'Sichtbar',
  blocked: 'Blockiert',
  not_approved: 'Nicht freigegeben',
};

const visibilityBadgeClass: Record<string, string> = {
  visible: 'badge--APPROVED',
  blocked: 'badge--CHANGES_REQUESTED',
  not_approved: 'badge--DRAFT',
};

const blockingReasonLabel: Record<string, string> = {
  profile_incomplete: 'Profil unvollständig',
  manually_hidden: 'Manuell versteckt',
  publication_missing: 'Freigabe fehlt',
  no_confirmed_link: 'Keine Praxis',
  pending_link_only: 'Praxis ausstehend',
  practice_not_approved: 'Praxis nicht freigegeben',
  no_home_visit: 'Kein Hausbesuch',
  no_service_radius: 'Kein Einzugsgebiet',
  no_kassenart: 'Keine Kassenart',
  no_confirmed_practice_link: 'Keine Praxis bestätigt',
  booking_mode_disabled: 'Direkte Anfragen sind ausgeschaltet',
};

const bookingModeLabel: Record<string, string> = {
  DIRECTORY_ONLY: 'Nur Verzeichnis',
  FIRST_APPOINTMENT_REQUEST: 'Ersttermin anfragbar',
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
            <th>Ort</th>
            <th>Fachliches</th>
            <th>Eingereicht</th>
            <th>Frist (48h)</th>
            <th>Review</th>
            <th>Öffentlich</th>
            <th>Ersttermin</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => (
            (() => {
              const priority = getReviewPriority(t);
              const publicVisibilityBadge =
                t.reviewStatus === 'APPROVED' && t.isVisible
                  ? { label: 'Öffentlich sichtbar', className: 'badge badge--APPROVED' }
                  : t.reviewStatus === 'APPROVED' && !t.isVisible
                    ? { label: 'Freigegeben, aber versteckt', className: 'badge badge--PENDING_REVIEW' }
                    : { label: 'Nicht öffentlich', className: 'badge badge--DRAFT' };
              const bookingModeBadge =
                t.bookingMode === 'FIRST_APPOINTMENT_REQUEST'
                  ? {
                    label: t.requestability?.requestable ? 'Ersttermin anfragbar' : 'Anfragbar geplant',
                    className: t.requestability?.requestable ? 'badge badge--APPROVED' : 'badge badge--PENDING_REVIEW',
                  }
                  : { label: 'Nur Verzeichnis', className: 'badge badge--DRAFT' };
              const isApprovedButNotVisible = t.reviewStatus === 'APPROVED' && t.visibility.visibilityState !== 'visible';
              const isRequestModeBlocked = t.bookingMode === 'FIRST_APPOINTMENT_REQUEST' && !t.requestability?.requestable;
              const blockerReasons = (
                t.visibility.blockingReasons.length > 0
                  ? t.visibility.blockingReasons
                  : isApprovedButNotVisible
                    ? ['manually_hidden']
                    : []
              ).map((reason) => blockingReasonLabel[reason] ?? reason);
              const requestBlockers = (t.requestability?.blockingReasons ?? []).map((reason) => blockingReasonLabel[reason] ?? reason);
              const visibilitySummary = summarizeReasons(blockerReasons);
              const requestSummary = summarizeReasons(requestBlockers);
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
                <td data-label="Priorität">
                  <div className="priority-stack">
                    <span className={`badge ${priority.overdue ? 'badge--REJECTED' : 'badge--PENDING_REVIEW'}`}>{priority.label}</span>
                    {priority.missingCount > 0 && (
                      <span className="entity-meta">{priority.missingCount} Lücken</span>
                    )}
                  </div>
                </td>
                <td data-label="Ort">{t.city}</td>
                <td data-label="Fachliches">
                  <div className="priority-stack">
                    <strong style={{ fontSize: 14 }}>{t.professionalTitle}</strong>
                    <div className="tag-list">
                      {t.specializations.slice(0, 2).map((spec) => <span key={spec} className="tag">{spec}</span>)}
                      {t.specializations.length > 2 && <span className="tag">+{t.specializations.length - 2}</span>}
                    </div>
                  </div>
                </td>
                <td data-label="Eingereicht">{formatDate(t.createdAt)}</td>
                <td data-label="Frist (48h)">
                  <DeadlineTimer createdAt={t.createdAt} status={t.reviewStatus} />
                </td>
                <td data-label="Review">
                  <div className="priority-stack">
                    <span className={`badge badge--${t.reviewStatus}`}>
                      {statusLabel[t.reviewStatus] ?? t.reviewStatus}
                    </span>
                    {priority.missingCount > 0 && t.reviewStatus !== 'APPROVED' ? (
                      <span className="entity-meta">Profil braucht Ergänzungen</span>
                    ) : null}
                  </div>
                </td>
                <td data-label="Öffentlich">
                  <div className="priority-stack">
                    <span className={publicVisibilityBadge.className}>
                      {publicVisibilityBadge.label}
                    </span>
                    {isApprovedButNotVisible && visibilitySummary ? (
                      <span className="entity-meta" title={blockerReasons.join(', ')}>
                        {visibilitySummary}
                      </span>
                    ) : t.visibility.blockingReasons.length > 0 ? (
                      <span className="entity-meta" title={blockerReasons.join(', ')}>
                        {summarizeReasons(t.visibility.blockingReasons.map((r) => blockingReasonLabel[r] ?? r))}
                      </span>
                    ) : (
                      <span className="entity-meta">In der öffentlichen Suche</span>
                    )}
                  </div>
                </td>
                <td data-label="Ersttermin">
                  <div className="priority-stack">
                    <span className={bookingModeBadge.className}>
                      {bookingModeBadge.label}
                    </span>
                    {isRequestModeBlocked && requestSummary ? (
                      <span className="entity-meta" title={requestBlockers.join(', ')}>
                        {requestSummary}
                      </span>
                    ) : t.nextFreeSlotAt ? (
                      <span className="entity-meta">Ab {formatDate(t.nextFreeSlotAt)}</span>
                    ) : t.bookingMode === 'FIRST_APPOINTMENT_REQUEST' ? (
                      <span className="entity-meta">Noch kein Terminfenster</span>
                    ) : (
                      <span className="entity-meta">Keine Direktanfrage</span>
                    )}
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
      )}
    </PageShell>
  );
}
