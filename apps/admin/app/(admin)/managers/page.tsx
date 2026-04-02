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
  const linkedPracticeCount = managers.filter((manager) => manager.practice).length;
  const dualRoleCount = managers.filter((manager) => manager.therapistId).length;
  const orphanedCount = managers.filter((manager) => !manager.practice).length;

  return (
    <PageShell
      title="Manager-Accounts"
      description="Übersicht aller Praxis-Manager-Accounts und ihrer verknüpften Praxen."
      eyebrow="Verwaltung"
      actions={<div className="hero-pill">{managers.length} Manager-Accounts</div>}
    >
      <div className="review-summary-grid">
        <article className="review-summary-card">
          <div className="kicker">Mit Praxis</div>
          <strong>{linkedPracticeCount}</strong>
          <span>Manager-Accounts mit sauber verknüpfter Praxis</span>
        </article>
        <article className="review-summary-card">
          <div className="kicker">Doppelrolle</div>
          <strong>{dualRoleCount}</strong>
          <span>Accounts, die auch ein Therapeut:innen-Profil haben</span>
        </article>
        <article className="review-summary-card review-summary-card--warning">
          <div className="kicker">Ohne Praxis</div>
          <strong>{orphanedCount}</strong>
          <span>Diese Datensätze wirken unvollständig oder historisch</span>
        </article>
      </div>

      {managers.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <div className="empty-illustration">◈</div>
          <strong>Keine Manager-Accounts vorhanden</strong>
          <p>Aktuell gibt es noch keine verknüpften Praxis-Manager:innen im System.</p>
        </div>
      ) : (
      <table className="table table--elevated">
        <thead>
          <tr>
            <th>Account</th>
            <th>Praxis</th>
            <th>Rolle</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {managers.map((m) => (
            <tr key={m.id}>
              <td data-label="Account">
                <div className="entity-cell">
                  <div className="entity-avatar">{m.email.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{m.email}</strong>
                    <div className="entity-meta">Seit {new Date(m.createdAt).toLocaleDateString('de-DE')}</div>
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
                <div className="priority-stack">
                  <strong style={{ fontSize: 14 }}>{m.therapistId ? 'Manager + Therapeut' : 'Nur Manager'}</strong>
                  <span className="entity-meta">{m.therapist ? m.therapist.fullName : 'Kein Therapeut:innen-Profil'}</span>
                </div>
              </td>
              <td data-label="Status">
                <div className="priority-stack">
                  {m.practice ? (
                    <span className={`badge badge--${m.practice.reviewStatus}`}>
                      {statusLabel[m.practice.reviewStatus] ?? m.practice.reviewStatus}
                    </span>
                  ) : (
                    <span className="badge badge--DRAFT">Ohne Praxis</span>
                  )}
                  <span className="entity-meta">{m.practice ? 'Praxis verknüpft' : 'Prüfen, ob Datensatz bereinigt werden sollte'}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </PageShell>
  );
}
