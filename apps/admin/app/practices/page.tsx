import { PageShell } from '../../components/page-shell';
import { PracticeActions } from '../../components/action-buttons';
import { api } from '../../lib/api';
import { approvePractice, rejectPractice, suspendPractice } from '../../lib/actions';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Ausstehend',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
};

export default async function PracticesPage() {
  const practices = await api.getPractices();

  return (
    <PageShell
      title="Praxis-Warteschlange"
      description="Behalte Praxiseinreichungen im Blick, die auf Freigabe warten, und prüfe verknüpfte Therapeut:innen-Aktivitäten, bevor etwas veröffentlicht wird."
    >
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Ort</th>
            <th>Adresse</th>
            <th>Verknüpfte Therapeut:innen</th>
            <th>Eingereicht</th>
            <th>Status</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {practices.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.city}</td>
              <td style={{ color: 'var(--muted)', fontSize: 13 }}>{p.address ?? '—'}</td>
              <td>{p.links?.length ?? 0}</td>
              <td>{formatDate(p.createdAt)}</td>
              <td>
                <span className={`badge badge--${p.reviewStatus}`}>
                  {statusLabel[p.reviewStatus] ?? p.reviewStatus}
                </span>
              </td>
              <td>
                <PracticeActions
                  id={p.id}
                  status={p.reviewStatus}
                  actions={{
                    approve: approvePractice,
                    reject: rejectPractice,
                    suspend: suspendPractice,
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
