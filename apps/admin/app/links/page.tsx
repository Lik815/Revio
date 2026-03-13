import { PageShell } from '../../components/page-shell';
import { LinkActions } from '../../components/action-buttons';
import { api } from '../../lib/api';
import { confirmLink, rejectLink, disputeLink } from '../../lib/actions';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const statusLabel: Record<string, string> = {
  PROPOSED: 'Vorgeschlagen',
  CONFIRMED: 'Bestätigt',
  DISPUTED: 'Umstritten',
  REJECTED: 'Abgelehnt',
};

export default async function LinksPage() {
  const links = await api.getLinks();

  return (
    <PageShell
      title="Verknüpfungsübersicht"
      description="Prüfe vorgeschlagene und umstrittene Verknüpfungen zwischen Therapeut:innen und Praxen, damit nur bestätigte Beziehungen in der öffentlichen Suche sichtbar werden."
      eyebrow="Review-Konflikte"
      actions={<div className="hero-pill">{links.length} Verknüpfungen</div>}
    >
      <table className="table table--elevated">
        <thead>
          <tr>
            <th>Therapeut:in</th>
            <th>Praxis</th>
            <th>Status</th>
            <th>Eingereicht</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => (
            <tr key={l.id}>
              <td>{l.therapist.fullName}</td>
              <td>{l.practice.name}</td>
              <td>
                <span className={`badge badge--${l.status}`}>
                  {statusLabel[l.status] ?? l.status}
                </span>
              </td>
              <td>{formatDate(l.createdAt)}</td>
              <td>
                <LinkActions
                  id={l.id}
                  status={l.status}
                  actions={{
                    confirm: confirmLink,
                    reject: rejectLink,
                    dispute: disputeLink,
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
