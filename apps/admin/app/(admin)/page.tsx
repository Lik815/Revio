import Link from 'next/link';
import { PageShell } from '../../components/page-shell';
import { AdminApiError, api } from '../../lib/api';
import { humanizeBlockingReason } from '../../lib/review-status';

export default async function HomePage() {
  let dashboardError: string | null = null;
  const [statsResult, visibilityIssuesResult] = await Promise.allSettled([
    api.getStats(),
    api.getVisibilityIssues(),
  ]);

  const stats = statsResult.status === 'fulfilled'
    ? statsResult.value
    : {
        therapists: { approved: 0, pending_review: 0, draft: 0, rejected: 0, changes_requested: 0, suspended: 0 },
        practices: { approved: 0, pending_review: 0, draft: 0, rejected: 0, changes_requested: 0, suspended: 0 },
        links: { proposed: 0, confirmed: 0, disputed: 0, rejected: 0 },
      };
  const visibilityIssues = visibilityIssuesResult.status === 'fulfilled'
    ? visibilityIssuesResult.value
    : { count: 0, issues: [] };

  const failedReasons = [statsResult, visibilityIssuesResult]
    .filter((result) => result.status === 'rejected')
    .map((result) => {
      const error = result.reason;
      if (error instanceof AdminApiError) return error.message;
      if (error instanceof Error) return error.message;
      return 'Die Admin-API hat die Daten nicht rechtzeitig geliefert.';
    });

  if (failedReasons.length > 0) {
    dashboardError = failedReasons[0] ?? 'Dashboard-Daten konnten nicht vollständig geladen werden.';
  }

  const totalTherapists = stats.therapists.approved + stats.therapists.pending_review + stats.therapists.draft + stats.therapists.rejected + stats.therapists.changes_requested + stats.therapists.suspended;

  const cards = [
    { kicker: 'Therapeut:innen', label: 'Offene Reviews', value: stats.therapists.pending_review, href: '/therapists?status=PENDING_REVIEW' },
    { kicker: 'Sichtbarkeit', label: 'Profile mit offenen Punkten', value: visibilityIssues.count, href: '/therapists?status=APPROVED' },
    { kicker: 'Review', label: 'Änderungen oder Ablehnung', value: stats.therapists.changes_requested + stats.therapists.rejected, href: '/therapists' },
  ];

  return (
    <PageShell
      title="Übersicht"
      eyebrow="Dashboard"
      description="Die wichtigsten offenen Entscheidungen auf einen Blick."
      actions={<div className="hero-pill">{totalTherapists} Profile</div>}
    >
      {dashboardError ? (
        <article className="panel panel--compact" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-header__content">
              <div className="kicker">Dashboard</div>
              <h3>Daten aktuell nur teilweise verfügbar</h3>
              <p className="panel-header__description">
                Die Admin-App konnte einen Teil der Uebersicht gerade nicht laden. Die Seite bleibt benutzbar und versucht es beim naechsten Reload erneut.
              </p>
            </div>
          </div>
          <p className="table-note" style={{ marginTop: 0 }}>{dashboardError}</p>
        </article>
      ) : null}

      <div className="review-summary-grid">
        {cards.map((item) => (
          <Link key={item.label} href={item.href} className="summary-link">
            <article className="review-summary-card review-summary-card--interactive">
              <div className="kicker">{item.kicker}</div>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          </Link>
        ))}
      </div>

      {visibilityIssues.count > 0 && (
        <article className="panel panel--compact">
          <div className="panel-header">
            <div>
              <div className="kicker">Öffentliche Sichtbarkeit</div>
              <h3>Offene Punkte</h3>
            </div>
            <div className="hero-pill">{visibilityIssues.count}</div>
          </div>
          <div className="task-list">
            {visibilityIssues.issues.slice(0, 5).map((issue) => (
              <Link
                key={issue.therapistId}
                href={`/therapists/${issue.therapistId}?source=dashboard-open-issues&issue=${encodeURIComponent(issue.reason)}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="task-item task-item--clickable">
                  <span className="task-dot task-dot--danger" />
                  <div style={{ flex: 1 }}>
                    <strong>{issue.therapistName}</strong>
                    <p className="table-note">{humanizeBlockingReason(issue.reason)}</p>
                  </div>
                </div>
              </Link>
            ))}
            {visibilityIssues.count > 5 && (
              <div className="table-note" style={{ padding: '8px 2px 0' }}>
                + {visibilityIssues.count - 5} weitere unter <Link href="/therapists?status=APPROVED">Therapeut:innen → Freigegeben</Link>
              </div>
            )}
          </div>
        </article>
      )}
    </PageShell>
  );
}
