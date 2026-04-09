import { PageShell } from '../../../components/page-shell';

export default function ProfilesPage() {
  return (
    <PageShell
      title="Alle Profile"
      description="Diese Suchansicht wird Therapeut:innen und Praxen über alle Prüfzustände hinweg zusammenführen, damit sich Profile leichter finden und bei Bedarf später sperren lassen."
      eyebrow="Explorer"
      actions={<div className="hero-pill">Geplantes Kernfeature</div>}
    >
      <div className="empty-state">
        <div className="empty-illustration">⌕</div>
        <div className="kicker">Nächster Ausbauschritt</div>
        <h3>Übergreifende Suche mit Sofortfiltern</h3>
        <p>
          Hier sollte als Nächstes eine globale Suche für Therapeut:innen, Praxen und Status entstehen – inklusive Schnellfiltern, Bulk-Aktionen und Detailvorschau.
        </p>
      </div>
    </PageShell>
  );
}
