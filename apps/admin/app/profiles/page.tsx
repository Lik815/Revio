import { PageShell } from '../../components/page-shell';

export default function ProfilesPage() {
  return (
    <PageShell
      title="Alle Profile"
      description="Diese Suchansicht wird Therapeut:innen und Praxen über alle Prüfzustände hinweg zusammenführen, damit sich Profile leichter finden und bei Bedarf später sperren lassen."
    >
      <div className="card">
        <div className="kicker">Geplantes Feature</div>
        <h3 style={{ marginTop: 8 }}>Übergreifende Suche</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Ergänze hier eine serverseitige Suchroute und Filteroptionen, sobald die Listen-Endpunkte der Admin-API implementiert sind.
        </p>
      </div>
    </PageShell>
  );
}
