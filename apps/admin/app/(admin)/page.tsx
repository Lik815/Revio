import Link from 'next/link';
import { PageShell } from '../../components/page-shell';
import { MilestoneModal } from '../../components/milestone-modal';
import { api } from '../../lib/api';

export default async function HomePage() {
  const [stats, visibilityIssues] = await Promise.all([
    api.getStats(),
    api.getVisibilityIssues(),
  ]);

  const totalTherapists = stats.therapists.approved + stats.therapists.pending_review + stats.therapists.draft + stats.therapists.rejected + stats.therapists.changes_requested + stats.therapists.suspended;

  const cards = [
    { label: 'Therapeut:innen ausstehend', value: stats.therapists.pending_review, tone: 'warning', href: '/therapists?status=PENDING_REVIEW' },
    { label: 'Praxen ausstehend', value: stats.practices.pending_review, tone: 'accent', href: '/practices?status=PENDING_REVIEW' },
    { label: 'Umstrittene Verknüpfungen', value: stats.links.disputed, tone: 'danger', href: '/links?status=DISPUTED' },
    { label: 'Freigegeben', value: stats.therapists.approved, tone: 'success', href: '/therapists?status=APPROVED' },
  ];

  return (
    <PageShell
      title="Übersicht"
      eyebrow="Dashboard"
      actions={<div className="hero-pill">{totalTherapists} Therapeut:innen registriert</div>}
    >
      <MilestoneModal total={totalTherapists} />

      <div className="card-grid">
        {cards.map((item) => (
          <Link key={item.label} href={item.href} style={{ textDecoration: 'none' }}>
            <article className={`card stat-card stat-card--${item.tone} stat-card--clickable`}>
              <div className="metric">{item.value}</div>
              <div>{item.label}</div>
            </article>
          </Link>
        ))}
      </div>

      {visibilityIssues.count > 0 && (
        <article className="panel" style={{ marginTop: '24px' }}>
          <div className="panel-header">
            <div>
              <div className="kicker">Öffentliche Sichtbarkeit</div>
              <h3>Gerade blockiert</h3>
            </div>
          </div>
          <div className="task-list">
            {visibilityIssues.issues.slice(0, 3).map((issue) => (
              <div key={issue.therapistId} className="task-item">
                <span className="task-dot task-dot--danger" />
                <div>
                  <strong>{issue.fullName}</strong>
                  <p>{issue.pendingPractices.length} Praxisfreigaben und {issue.pendingLinks.length} offene Links blockieren die Sichtbarkeit.</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      <article className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-header">
          <div>
            <div className="kicker">Prioritäten</div>
            <h3>Sofort prüfen</h3>
          </div>
        </div>
        <div className="task-list">
          <div className="task-item">
            <span className="task-dot task-dot--warning" />
            <div>
              <strong>{stats.therapists.pending_review} Therapeut:innen warten auf Review</strong>
            </div>
          </div>
          <div className="task-item">
            <span className="task-dot task-dot--accent" />
            <div>
              <strong>{stats.practices.pending_review} Praxen sind noch offen</strong>
            </div>
          </div>
          <div className="task-item">
            <span className="task-dot task-dot--danger" />
            <div>
              <strong>{stats.links.disputed} Konflikte brauchen Klärung</strong>
            </div>
          </div>
        </div>
      </article>
    </PageShell>
  );
}
