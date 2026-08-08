import Link from 'next/link';
import { PageShell } from '../../../../components/page-shell';
import { AdminNotice } from '../../../../components/admin-notice';
import { AdminSectionCard } from '../../../../components/admin-section-card';
import { createTherapist } from '../../../../lib/actions';

type SearchParams = Promise<{ formError?: string }>;

export default async function NewTherapistPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return (
    <PageShell
      title="Neuen Therapeuten anlegen"
      description="Nur mit dokumentierter Zustimmung — ohne Kanal/Zeitpunkt kein Speichern. Läuft danach durch die Freigabe-Warteschlange; der echte Therapeut kann das Profil später mit derselben E-Mail selbst übernehmen."
      eyebrow="Neuanlage"
      actions={<Link href="/therapists" className="secondary-btn secondary-btn--compact">Zurück zur Liste</Link>}
    >
      <AdminSectionCard eyebrow="Therapeut" title="Angaben">
        {params.formError ? (
          <AdminNotice title="Anlegen fehlgeschlagen" tone="warning">{params.formError}</AdminNotice>
        ) : null}
        <form action={createTherapist} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <label className="field">
            <span>E-Mail</span>
            <input className="toolbar-input" name="email" type="email" placeholder="name@beispiel.de" required />
          </label>
          <label className="field">
            <span>Vollständiger Name</span>
            <input className="toolbar-input" name="fullName" placeholder="Vor- und Nachname" required />
          </label>
          <label className="field">
            <span>Stadt</span>
            <input className="toolbar-input" name="city" placeholder="Stadt" required />
          </label>
          <label className="field">
            <span>Zustimmung über welchen Kanal</span>
            <input className="toolbar-input" name="consentChannel" placeholder="z. B. Telefon 08.08." required />
          </label>
          <label className="field">
            <span>Notiz zur Zustimmung (optional)</span>
            <textarea className="toolbar-input" name="consentNote" rows={2} />
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="primary-btn" type="submit">Therapeut anlegen</button>
            <Link href="/therapists" className="secondary-btn">Abbrechen</Link>
          </div>
        </form>
      </AdminSectionCard>
    </PageShell>
  );
}
