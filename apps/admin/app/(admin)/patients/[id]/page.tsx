import Link from 'next/link';
import { PageShell } from '../../../../components/page-shell';
import { AdminSectionCard } from '../../../../components/admin-section-card';
import { AdminEmptyState } from '../../../../components/admin-empty-state';
import { api } from '../../../../lib/api';
import { formatDate, formatDateTime } from '../../../../lib/format';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PatientDetailPage({ params }: Props) {
  const { id } = await params;
  const patient = await api.getPatient(id);
  const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Ohne Namen';

  return (
    <PageShell
      title={fullName}
      description="Diese Ansicht wurde protokolliert (Zugriffsprotokoll für Patientendaten)."
      eyebrow="Patient"
      actions={<Link href="/patients" className="secondary-btn secondary-btn--compact">Zurück zur Suche</Link>}
    >
      <AdminSectionCard eyebrow="Kontakt" title="Stammdaten">
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0 }}>
          <dt style={{ color: 'var(--muted)', fontSize: 13 }}>E-Mail</dt>
          <dd style={{ margin: 0 }}>{patient.email}</dd>
          <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Telefon</dt>
          <dd style={{ margin: 0 }}>{patient.phone ?? '—'}</dd>
          <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Kassenart</dt>
          <dd style={{ margin: 0 }}>{patient.kassenart ?? '—'}</dd>
          <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Registriert seit</dt>
          <dd style={{ margin: 0 }}>{formatDate(patient.createdAt)}</dd>
        </dl>
      </AdminSectionCard>

      <AdminSectionCard eyebrow="Buchungen" title="Letzte Buchungen" description="Die 10 zuletzt erstellten Buchungsanfragen.">
        {patient.bookings.length === 0 ? (
          <AdminEmptyState icon="📅" title="Keine Buchungen" description="Für diesen Patienten liegen keine Buchungsanfragen vor." compact />
        ) : (
          <table className="table table--elevated">
            <thead>
              <tr>
                <th>Therapeut</th>
                <th>Status</th>
                <th>Termin</th>
                <th>Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {patient.bookings.map((booking) => (
                <tr key={booking.id}>
                  <td data-label="Therapeut">{booking.therapistFullName}</td>
                  <td data-label="Status">{booking.status}</td>
                  <td data-label="Termin">{booking.startsAt ? formatDateTime(booking.startsAt) : '—'}</td>
                  <td data-label="Erstellt">{formatDate(booking.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminSectionCard>
    </PageShell>
  );
}
