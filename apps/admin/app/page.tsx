import { PageShell } from '../components/page-shell';
import { api } from '../lib/api';

export default async function HomePage() {
  const stats = await api.getStats();

  const cards = [
    { label: 'Ausstehende Therapeut:innen', value: stats.therapists.pending_review, tone: 'warning' },
    { label: 'Ausstehende Praxen', value: stats.practices.pending_review, tone: 'accent' },
    { label: 'Umstrittene Verknüpfungen', value: stats.links.disputed, tone: 'danger' },
    { label: 'Freigegebene Profile', value: stats.therapists.approved + stats.practices.approved, tone: 'success' },
  ];

  const approvalRate = Math.round(
    ((stats.therapists.approved + stats.practices.approved) /
      Math.max(
        1,
        stats.therapists.approved + stats.practices.approved + stats.therapists.pending_review + stats.practices.pending_review,
      )) * 100,
  );

  return (
    <PageShell
      title="Arbeitsübersicht"
      description="Nutze dieses Dashboard, um ausstehende Einreichungen zu prüfen, Konflikte bei Therapeut:innen-Praxis-Verknüpfungen zu klären und das Freigabevolumen zu überwachen."
      eyebrow="Control Center"
      actions={<div className="hero-pill">Freigaberate {approvalRate}%</div>}
    >
      <section className="hero-grid">
        <article className="hero-card hero-card--primary">
          <div className="kicker">Heute im Fokus</div>
          <h3>Halte den Review-Flow schnell, klar und hochwertig.</h3>
          <p>
            Priorisiere offene Therapeut:innen und strittige Verknüpfungen zuerst. So bleibt die öffentliche Suche sauber und vertrauenswürdig.
          </p>
          <div className="hero-stats">
            <div>
              <strong>{stats.therapists.pending_review + stats.practices.pending_review}</strong>
              <span>offene Reviews</span>
            </div>
            <div>
              <strong>{stats.links.disputed}</strong>
              <span>Konflikte</span>
            </div>
          </div>
        </article>
        <article className="hero-card hero-card--secondary">
          <div className="kicker">Systemstatus</div>
          <ul className="health-list">
            <li><span>Therapeut:innen freigegeben</span><strong>{stats.therapists.approved}</strong></li>
            <li><span>Praxen freigegeben</span><strong>{stats.practices.approved}</strong></li>
            <li><span>Bestätigte Verknüpfungen</span><strong>{stats.links.confirmed}</strong></li>
          </ul>
        </article>
      </section>

      <div className="card-grid">
        {cards.map((item) => (
          <article className={`card stat-card stat-card--${item.tone}`} key={item.label}>
            <div className="kicker">Momentaufnahme</div>
            <div className="metric">{item.value}</div>
            <div>{item.label}</div>
          </article>
        ))}
      </div>

      <section className="dashboard-grid">
        <article className="panel">
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
                <p>Prüfe Vollständigkeit, Spezialisierungen und Verknüpfungen.</p>
              </div>
            </div>
            <div className="task-item">
              <span className="task-dot task-dot--accent" />
              <div>
                <strong>{stats.practices.pending_review} Praxen sind noch offen</strong>
                <p>Adresse, Kontakt und verknüpfte Teams zuerst plausibilisieren.</p>
              </div>
            </div>
            <div className="task-item">
              <span className="task-dot task-dot--danger" />
              <div>
                <strong>{stats.links.disputed} Konflikte brauchen Klärung</strong>
                <p>Unstimmige Zuordnungen blockieren Vertrauen in die Plattform.</p>
              </div>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <div className="kicker">Verteilung</div>
              <h3>Review-Status</h3>
            </div>
          </div>
          <div className="stack-bars">
            <div>
              <div className="stack-label"><span>Therapeut:innen</span><strong>{stats.therapists.approved}</strong></div>
              <div className="stack-track"><div className="stack-fill stack-fill--success" style={{ width: `${Math.min(100, stats.therapists.approved)}%` }} /></div>
            </div>
            <div>
              <div className="stack-label"><span>Praxen</span><strong>{stats.practices.approved}</strong></div>
              <div className="stack-track"><div className="stack-fill stack-fill--accent" style={{ width: `${Math.min(100, stats.practices.approved)}%` }} /></div>
            </div>
            <div>
              <div className="stack-label"><span>Disputed Links</span><strong>{stats.links.disputed}</strong></div>
              <div className="stack-track"><div className="stack-fill stack-fill--danger" style={{ width: `${Math.min(100, stats.links.disputed * 10)}%` }} /></div>
            </div>
          </div>
        </article>
      </section>
    </PageShell>
  );
}
