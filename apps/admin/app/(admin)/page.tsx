import Link from 'next/link';
import { PageShell } from '../../components/page-shell';
import { api } from '../../lib/api';

const visibilityReasonLabel: Record<string, string> = {
  publication_incomplete: 'Freigabe noch unvollständig',
  profile_incomplete: 'Profil unvollständig',
  manually_hidden: 'Manuell versteckt',
  publication_missing: 'Freigabe fehlt',
  no_home_visit: 'Hausbesuch fehlt',
  no_service_radius: 'Einzugsgebiet fehlt',
  no_kassenart: 'Kassenart fehlt',
};

function formatVisibilityReason(reason: string) {
  return visibilityReasonLabel[reason] ?? reason.replace(/_/g, ' ');
}

export default async function HomePage() {
  const [stats, visibilityIssues] = await Promise.all([
    api.getStats(),
    api.getVisibilityIssues(),
  ]);

  const totalTherapists = stats.therapists.approved + stats.therapists.pending_review + stats.therapists.draft + stats.therapists.rejected + stats.therapists.changes_requested + stats.therapists.suspended;

  const cards = [
    { kicker: 'Therapeut:innen', label: 'Offene Reviews', value: stats.therapists.pending_review, href: '/therapists?status=PENDING_REVIEW' },
    { kicker: 'Sichtbarkeit', label: 'Profile mit Blockern', value: visibilityIssues.count, href: '/therapists?status=APPROVED' },
    { kicker: 'Review', label: 'Änderungen oder Ablehnung', value: stats.therapists.changes_requested + stats.therapists.rejected, href: '/therapists' },
  ];

  return (
    <PageShell
      title="Übersicht"
      eyebrow="Dashboard"
      description="Die wichtigsten offenen Entscheidungen auf einen Blick."
      actions={<div className="hero-pill">{totalTherapists} Profile</div>}
    >
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
              <h3>Aktuelle Blocker</h3>
            </div>
            <div className="hero-pill">{visibilityIssues.count}</div>
          </div>
          <div className="task-list">
            {visibilityIssues.issues.slice(0, 5).map((issue) => (
              <Link key={issue.therapistId} href={`/therapists/${issue.therapistId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="task-item task-item--clickable">
                  <span className="task-dot task-dot--danger" />
                  <div style={{ flex: 1 }}>
                    <strong>{issue.therapistName}</strong>
                    <p className="table-note">{formatVisibilityReason(issue.reason)}</p>
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
