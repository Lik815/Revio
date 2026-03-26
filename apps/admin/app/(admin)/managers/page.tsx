import { PageShell } from '../../../components/page-shell';
import { api } from '../../../lib/api';

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Ausstehend',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  CHANGES_REQUESTED: 'Änderungen',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
};

export default async function ManagersPage() {
  const { managers } = await api.getManagers();

  return (
    <PageShell
      title="Manager-Accounts"
      description="Übersicht aller Praxis-Manager-Accounts und ihrer verknüpften Praxen."
      eyebrow="Verwaltung"
      actions={<div className="hero-pill">{managers.length} Manager-Accounts</div>}
    >
      <table className="table table--elevated">
        <thead>
          <tr>
            <th>E-Mail</th>
            <th>Praxis</th>
            <th>Rolle</th>
            <th>Therapeut</th>
            <th>Praxis-Status</th>
          </tr>
        </thead>
        <tbody>
          {managers.map((m) => (
            <tr key={m.id}>
              <td data-label="E-Mail">
                <div className="entity-cell">
                  <div className="entity-avatar">{m.email.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{m.email}</strong>
                  </div>
                </div>
              </td>
              <td data-label="Praxis">
                {m.practice ? (
                  <>
                    <strong>{m.practice.name}</strong>
                    <div className="entity-meta">{m.practice.city}</div>
                  </>
                ) : (
                  <>
                    <strong>Keine Praxis verknüpft</strong>
                    <div className="entity-meta">Legacy- oder unvollständiger Datensatz</div>
                  </>
                )}
              </td>
              <td data-label="Rolle">
                {m.therapistId ? 'Manager + Therapeut' : 'Nur Manager'}
              </td>
              <td data-label="Therapeut">
                {m.therapist ? m.therapist.fullName : '—'}
              </td>
              <td data-label="Praxis-Status">
                {m.practice ? (
                  <span className={`badge badge--${m.practice.reviewStatus}`}>
                    {statusLabel[m.practice.reviewStatus] ?? m.practice.reviewStatus}
                  </span>
                ) : (
                  <span className="badge badge--DRAFT">Ohne Praxis</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
