import Link from 'next/link';
import { PageShell } from '../../../components/page-shell';
import { TherapistActions } from '../../../components/action-buttons';
import { DeadlineTimer } from '../../../components/deadline-timer';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminNotice } from '../../../components/admin-notice';
import { AdminSectionCard } from '../../../components/admin-section-card';
import { AdminStatusBadge } from '../../../components/admin-status-badge';
import { AdminSummaryCard } from '../../../components/admin-summary-card';
import { AdminToolbar } from '../../../components/admin-toolbar';
import { api } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import { getAdminVisibilityIssues, getReviewPriority, getVisibilityMeta } from '../../../lib/visibility';
import { humanizeBlockingReason } from '../../../lib/review-status';
import {
  approveTherapist,
  rejectTherapist,
  requestChangesTherapist,
  suspendTherapist,
} from '../../../lib/actions';

type SearchParams = Promise<{ status?: string; q?: string; city?: string }>;

function getQueueCopy({
  overdueCount,
  incompleteCount,
}: {
  overdueCount: number;
  incompleteCount: number;
}) {
  if (overdueCount > 0) {
    return `${overdueCount} Profile liegen über dem 48h-Ziel und sollten zuerst geprüft werden.`;
  }
  if (incompleteCount > 0) {
    return `${incompleteCount} Profile haben erkennbare Lücken und brauchen wahrscheinlich Rückfragen.`;
  }
  return 'Keine akuten Eskalationen. Die Queue kann regulär abgearbeitet werden.';
}

export default async function TherapistsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const therapists = await api.getTherapists();

  const statusFilter = params.status ?? 'ALL';
  const q = (params.q ?? '').toLowerCase();
  const city = (params.city ?? '').toLowerCase();

  const filtered = therapists
    .filter((therapist) => {
      const matchesStatus = statusFilter === 'ALL' || therapist.reviewStatus === statusFilter;
      const matchesQuery = !q || [therapist.fullName, therapist.professionalTitle, therapist.city, therapist.specializations.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(q);
      const matchesCity = !city || therapist.city.toLowerCase().includes(city);
      return matchesStatus && matchesQuery && matchesCity;
    })
    .sort((a, b) => getReviewPriority(a).weight - getReviewPriority(b).weight);

  const pendingCount = filtered.filter((therapist) => therapist.reviewStatus === 'PENDING_REVIEW').length;
  const overdueCount = filtered.filter((therapist) => getReviewPriority(therapist).overdue).length;
  const incompleteCount = filtered.filter((therapist) => getReviewPriority(therapist).missingCount > 0 && therapist.reviewStatus !== 'APPROVED').length;
  const visibleCount = filtered.filter((therapist) => therapist.reviewStatus === 'APPROVED' && therapist.visibility.visibilityState === 'visible' && therapist.isVisible).length;
  const activeFilters = [params.q, params.city, statusFilter !== 'ALL' ? statusFilter : ''].filter(Boolean).length;

  return (
    <PageShell
      title="Therapeut:innen"
      description="Review-Queue, Sichtbarkeit und die nächste sinnvolle Entscheidung in einer Arbeitsansicht."
      eyebrow="Reviews"
      actions={<div className="hero-pill">{filtered.length} Profile in der Ansicht</div>}
    >
      <div className="review-summary-grid">
        <AdminSummaryCard
          kicker="Offen"
          value={pendingCount}
          label="Warten auf Review"
          href="/therapists?status=PENDING_REVIEW"
        />
        <AdminSummaryCard
          kicker="Überfällig"
          value={overdueCount}
          label="Länger als 48 Stunden offen"
          tone="warning"
          href="/therapists?status=PENDING_REVIEW"
        />
        <AdminSummaryCard
          kicker="Mit Lücken"
          value={incompleteCount}
          label="Brauchen Rückfragen"
          tone="danger"
          href="/therapists?status=CHANGES_REQUESTED"
        />
        <AdminSummaryCard
          kicker="Öffentlich"
          value={visibleCount}
          label="Sichtbar in der Suche"
          tone="success"
          href="/therapists?status=APPROVED"
        />
      </div>

      <AdminNotice title="Queue-Einschätzung" tone={overdueCount > 0 ? 'warning' : 'default'}>
        {getQueueCopy({ overdueCount, incompleteCount })}
      </AdminNotice>

      <AdminSectionCard
        eyebrow="Filter"
        title="Arbeitsliste eingrenzen"
        description="Suche nach Person, Stadt oder Spezialisierung und fokussiere die Queue auf den nächsten sinnvollen Review-Schritt."
        actions={activeFilters > 0 ? <Link href="/therapists" className="secondary-btn secondary-btn--compact">Filter zurücksetzen</Link> : null}
      >
        <AdminToolbar>
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
              <option value="DRAFT">Entwurf</option>
            </select>
            <button className="primary-btn" type="submit">Anwenden</button>
          </form>
        </AdminToolbar>
      </AdminSectionCard>

      {filtered.length === 0 ? (
        <AdminEmptyState
          icon="🗂️"
          title="Keine Therapeut:innen für diese Filter"
          description="Versuche einen anderen Status, entferne Suchbegriffe oder prüfe die gesamte Queue ohne Stadtfilter."
          compact
          action={<Link href="/therapists" className="secondary-btn secondary-btn--compact">Alle Profile anzeigen</Link>}
        />
      ) : (
        <AdminSectionCard
          eyebrow="Queue"
          title="Review-Arbeitsliste"
          description="Die Liste ist nach Dringlichkeit sortiert. Sie zeigt zuerst überfällige Reviews, dann Profile mit Rückfragen oder fehlenden Angaben."
          actions={<div className="hero-pill">{activeFilters > 0 ? `${activeFilters} aktive Filter` : 'Keine aktiven Filter'}</div>}
        >
          <p className="table-note table-note--spacious">
            Öffne die Detailseite, wenn du Fachangaben, Dokumente oder Sichtbarkeitsgründe im Kontext prüfen möchtest.
          </p>
          <table className="table table--elevated focus-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Review</th>
                <th>Öffentlichkeit</th>
                <th>Nächster Schritt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((therapist) => {
                const priority = getReviewPriority(therapist);
                const adminVisibilityIssues = getAdminVisibilityIssues(therapist);
                const blockerSummary = adminVisibilityIssues.length > 0 ? humanizeBlockingReason(adminVisibilityIssues[0].reason) : null;
                const publicVisibilityBadge =
                  therapist.reviewStatus === 'APPROVED' && therapist.isVisible
                    ? { label: 'Öffentlich', status: 'APPROVED' }
                    : therapist.reviewStatus === 'APPROVED' && !therapist.isVisible
                      ? { label: 'Versteckt', status: 'PENDING_REVIEW' }
                      : { label: 'Noch nicht', status: 'DRAFT' };

                return (
                  <tr key={therapist.id}>
                    <td data-label="Person">
                      <div className="entity-cell entity-cell--top">
                        <div className="entity-avatar">{therapist.fullName.slice(0, 1)}</div>
                        <div className="entity-block">
                          <Link href={`/therapists/${therapist.id}`} className="entity-link">
                            {therapist.fullName}
                          </Link>
                          <div className="entity-meta">{therapist.email}</div>
                          <div className="entity-meta">
                            {therapist.professionalTitle} · {therapist.city}
                          </div>
                          <div className="tag-list">
                            {therapist.specializations.slice(0, 2).map((spec) => <span key={spec} className="tag">{spec}</span>)}
                            {therapist.specializations.length > 2 ? <span className="tag">+{therapist.specializations.length - 2}</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Review">
                      <div className="priority-stack">
                        <div className="cluster-row">
                          <AdminStatusBadge status={therapist.reviewStatus} />
                          <span className={`priority-pill${priority.overdue ? ' priority-pill--warning' : ''}`}>
                            {priority.label}
                          </span>
                        </div>
                        {priority.overdue ? (
                          <span className="entity-meta entity-meta--strong">Seit über 48 Stunden offen</span>
                        ) : therapist.reviewStatus === 'PENDING_REVIEW' ? (
                          <DeadlineTimer createdAt={therapist.createdAt} status={therapist.reviewStatus} />
                        ) : priority.missingCount > 0 && therapist.reviewStatus !== 'APPROVED' ? (
                          <span className="entity-meta entity-meta--strong">{priority.missingCount} Kernfelder unvollständig</span>
                        ) : (
                          <span className="entity-meta">Eingereicht {formatDate(therapist.createdAt)}</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Öffentlichkeit">
                      <div className="priority-stack">
                        <AdminStatusBadge status={publicVisibilityBadge.status} label={publicVisibilityBadge.label} />
                        <span className="entity-meta" title={blockers.join(', ')}>
                          {getVisibilityMeta(therapist)}
                        </span>
                        {blockerSummary ? (
                          <span className="entity-meta entity-meta--strong">{blockerSummary}</span>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Nächster Schritt">
                      <div className="priority-stack">
                        <strong className="table-strong">
                          {priority.overdue
                            ? 'Jetzt prüfen'
                            : therapist.reviewStatus === 'CHANGES_REQUESTED'
                              ? 'Rückmeldung nachhalten'
                              : therapist.reviewStatus === 'APPROVED' && adminVisibilityIssues.length > 0
                                ? 'Sichtbarkeitsblocker lösen'
                                : therapist.reviewStatus === 'DRAFT'
                                  ? 'Profil ergänzen lassen'
                                  : therapist.reviewStatus === 'APPROVED'
                                    ? 'Nur beobachten'
                                    : 'Review abschließen'}
                        </strong>
                        <span className="entity-meta">
                          {priority.overdue
                            ? 'SLA gerissen, Entscheidung priorisieren.'
                            : therapist.reviewStatus === 'CHANGES_REQUESTED'
                              ? 'Prüfen, ob Rückfragen beantwortet wurden.'
                              : therapist.reviewStatus === 'APPROVED' && adminVisibilityIssues.length > 0
                                ? 'Profil ist freigegeben, aber noch nicht sauber öffentlich.'
                                : therapist.reviewStatus === 'APPROVED'
                                  ? 'Kein akuter Handlungsbedarf.'
                                  : 'Details aufrufen und Freigabe-Entscheidung treffen.'}
                        </span>
                      </div>
                    </td>
                    <td data-label="Aktionen">
                      <TherapistActions
                        id={therapist.id}
                        status={therapist.reviewStatus}
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
              })}
            </tbody>
          </table>
        </AdminSectionCard>
      )}
    </PageShell>
  );
}
