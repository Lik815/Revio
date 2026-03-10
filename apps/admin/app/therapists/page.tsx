import { PageShell } from '../../components/page-shell';
import { TherapistActions } from '../../components/action-buttons';
import { api } from '../../lib/api';
import {
  approveTherapist,
  rejectTherapist,
  requestChangesTherapist,
  suspendTherapist,
} from '../../lib/actions';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Ausstehend',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  CHANGES_REQUESTED: 'Änderungen',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
};

export default async function TherapistsPage() {
  const therapists = await api.getTherapists();

  return (
    <PageShell
      title="Therapeut:innen-Warteschlange"
      description="Prüfe neu eingereichte Therapeut:innen, fordere Korrekturen bei unvollständigen Profildaten an und halte Freigaben bewusst und nachvollziehbar."
    >
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Titel</th>
            <th>Ort</th>
            <th>Spezialisierungen</th>
            <th>Eingereicht</th>
            <th>Status</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {therapists.map((t) => (
            <tr key={t.id}>
              <td>{t.fullName}</td>
              <td>{t.professionalTitle}</td>
              <td>{t.city}</td>
              <td>{t.specializations.join(', ')}</td>
              <td>{formatDate(t.createdAt)}</td>
              <td>
                <span className={`badge badge--${t.reviewStatus}`}>
                  {statusLabel[t.reviewStatus] ?? t.reviewStatus}
                </span>
              </td>
              <td>
                <TherapistActions
                  id={t.id}
                  status={t.reviewStatus}
                  actions={{
                    approve: approveTherapist,
                    reject: rejectTherapist,
                    requestChanges: requestChangesTherapist,
                    suspend: suspendTherapist,
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
