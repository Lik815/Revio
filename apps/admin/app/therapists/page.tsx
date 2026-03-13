import { PageShell } from '../../components/page-shell';
import { TherapistActions } from '../../components/action-buttons';
import { api } from '../../lib/api';
import {
  approveTherapist,
  rejectTherapist,
  requestChangesTherapist,
  suspendTherapist,
} from '../../lib/actions';

type SearchParams = Promise<{ status?: string; q?: string; city?: string }>;

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

export default async function TherapistsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const therapists = await api.getTherapists();
  const statusFilter = params.status ?? 'ALL';
  const q = (params.q ?? '').toLowerCase();
  const city = (params.city ?? '').toLowerCase();

  const filtered = therapists.filter((t) => {
    const matchesStatus = statusFilter === 'ALL' || t.reviewStatus === statusFilter;
    const matchesQuery = !q || [t.fullName, t.professionalTitle, t.city, t.specializations.join(' ')].join(' ').toLowerCase().includes(q);
    const matchesCity = !city || t.city.toLowerCase().includes(city);
    return matchesStatus && matchesQuery && matchesCity;
  });

  return (
    <PageShell
      title="Therapeut:innen-Warteschlange"
      description="Prüfe neu eingereichte Therapeut:innen, fordere Korrekturen bei unvollständigen Profildaten an und halte Freigaben bewusst und nachvollziehbar."
      eyebrow="Reviews"
      actions={<div className="hero-pill">{filtered.length} Ergebnisse</div>}
    >
      <form className="toolbar" action="/therapists">
        <input name="q" defaultValue={params.q ?? ''} className="toolbar-input" placeholder="Nach Name, Stadt oder Spezialisierung suchen" />
        <input name="city" defaultValue={params.city ?? ''} className="toolbar-input toolbar-input--sm" placeholder="Stadt" />
        <select name="status" defaultValue={statusFilter} className="toolbar-select">
          <option value="ALL">Alle Status</option>
          <option value="PENDING_REVIEW">Ausstehend</option>
          <option value="APPROVED">Freigegeben</option>
          <option value="CHANGES_REQUESTED">Änderungen</option>
          <option value="REJECTED">Abgelehnt</option>
          <option value="SUSPENDED">Gesperrt</option>
        </select>
        <button className="primary-btn" type="submit">Filtern</button>
      </form>

      <table className="table table--elevated">
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
          {filtered.map((t) => (
            <tr key={t.id}>
              <td data-label="Name">
                <div className="entity-cell">
                  <div className="entity-avatar">{t.fullName.slice(0, 1)}</div>
                  <div>
                    <strong>{t.fullName}</strong>
                    <div className="entity-meta">{t.email}</div>
                  </div>
                </div>
              </td>
              <td data-label="Titel">{t.professionalTitle}</td>
              <td data-label="Ort">{t.city}</td>
              <td data-label="Spezialisierungen"><div className="tag-list">{t.specializations.slice(0, 3).map((spec) => <span key={spec} className="tag">{spec}</span>)}</div></td>
              <td data-label="Eingereicht">{formatDate(t.createdAt)}</td>
              <td data-label="Status">
                <span className={`badge badge--${t.reviewStatus}`}>
                  {statusLabel[t.reviewStatus] ?? t.reviewStatus}
                </span>
              </td>
              <td data-label="Aktionen">
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
