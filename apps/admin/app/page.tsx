import { PageShell } from '../components/page-shell';
import { api } from '../lib/api';

export default async function HomePage() {
  const stats = await api.getStats();

  const cards = [
    { label: 'Ausstehende Therapeut:innen', value: stats.therapists.pending_review },
    { label: 'Ausstehende Praxen',           value: stats.practices.pending_review },
    { label: 'Umstrittene Verknüpfungen',    value: stats.links.disputed },
    { label: 'Freigegebene Profile',          value: stats.therapists.approved },
  ];

  return (
    <PageShell
      title="Arbeitsübersicht"
      description="Nutze dieses Dashboard, um ausstehende Einreichungen zu prüfen, Konflikte bei Therapeut:innen-Praxis-Verknüpfungen zu klären und das Freigabevolumen zu überwachen."
    >
      <div className="card-grid">
        {cards.map((item) => (
          <article className="card" key={item.label}>
            <div className="kicker">Momentaufnahme</div>
            <div className="metric">{item.value}</div>
            <div>{item.label}</div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
