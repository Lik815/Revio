import { PageShell } from '../../../components/page-shell';
import { AdminSectionCard } from '../../../components/admin-section-card';
import { PatientSearch } from '../../../components/patient-search';

export default function PatientsPage() {
  return (
    <PageShell
      title="Patienten"
      description="Gezielte Suche für Support-Fälle — keine durchsuchbare Liste aller Patient:innen. Jede Suche wird protokolliert."
      eyebrow="Support"
    >
      <AdminSectionCard
        eyebrow="Suche"
        title="Patient finden"
        description="Suche nach E-Mail, Name oder Buchungs-ID. Es werden nur die für den Support nötigen Felder angezeigt."
      >
        <PatientSearch />
      </AdminSectionCard>
    </PageShell>
  );
}
