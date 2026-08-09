import Link from 'next/link';
import { PageShell } from '../../../../components/page-shell';
import { AdminNotice } from '../../../../components/admin-notice';
import { AdminSectionCard } from '../../../../components/admin-section-card';
import { api } from '../../../../lib/api';
import { createTherapist } from '../../../../lib/actions';

type SearchParams = Promise<{ formError?: string }>;

const LANGUAGES = [
  { key: 'de', label: 'Deutsch' },
  { key: 'en', label: 'Englisch' },
  { key: 'tr', label: 'Türkisch' },
  { key: 'ar', label: 'Arabisch' },
  { key: 'ru', label: 'Russisch' },
  { key: 'pl', label: 'Polnisch' },
  { key: 'fr', label: 'Französisch' },
  { key: 'es', label: 'Spanisch' },
  { key: 'it', label: 'Italienisch' },
];

const KASSENARTEN = [
  { key: 'gesetzlich', label: 'Gesetzlich' },
  { key: 'privat', label: 'Privat' },
  { key: 'selbstzahler', label: 'Selbstzahler' },
];

function CheckboxGroup({
  name,
  options,
  defaultChecked = [],
}: {
  name: string;
  options: { key: string; label: string }[];
  defaultChecked?: string[];
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
      {options.map((o) => (
        <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input type="checkbox" name={name} value={o.key} defaultChecked={defaultChecked.includes(o.key)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export default async function NewTherapistPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const [specData, certData, heilData] = await Promise.all([
    api.getSpecializationOptions().catch(() => ({ specializations: [] })),
    api.getCertificationOptions().catch(() => ({ certifications: [] })),
    api.getHeilmittelOptions().catch(() => ({ heilmittel: [] })),
  ]);
  const specializations = specData.specializations.filter((o) => o.isActive).map((o) => ({ key: o.label, label: o.label }));
  const certifications = certData.certifications.filter((o) => o.isActive).map((o) => ({ key: o.label, label: o.label }));
  const heilmittel = heilData.heilmittel.filter((o) => o.isActive).map((o) => ({ key: o.label, label: o.label }));

  return (
    <PageShell
      title="Neuen Therapeuten anlegen"
      description="Nur mit dokumentierter Zustimmung — ohne Kanal/Zeitpunkt kein Speichern. Alle weiteren Angaben sind optional und können auch später ergänzt werden."
      eyebrow="Neuanlage"
      actions={<Link href="/therapists" className="secondary-btn secondary-btn--compact">Zurück zur Liste</Link>}
    >
      {params.formError ? (
        <AdminNotice title="Anlegen fehlgeschlagen" tone="warning">{params.formError}</AdminNotice>
      ) : null}

      <form action={createTherapist} style={{ display: 'grid', gap: 20, maxWidth: 640 }}>
        <AdminSectionCard eyebrow="Pflichtangaben" title="Person & Zustimmung">
          <div style={{ display: 'grid', gap: 12 }}>
            <label className="field">
              <span>E-Mail *</span>
              <input className="toolbar-input" name="email" type="email" placeholder="name@beispiel.de" required />
            </label>
            <label className="field">
              <span>Vollständiger Name *</span>
              <input className="toolbar-input" name="fullName" placeholder="Vor- und Nachname" required />
            </label>
            <label className="field">
              <span>Berufsbezeichnung</span>
              <input className="toolbar-input" name="professionalTitle" placeholder="Physiotherapeut" />
            </label>
            <label className="field">
              <span>Geschlecht</span>
              <select className="toolbar-select" name="gender" defaultValue="">
                <option value="">Keine Angabe</option>
                <option value="female">Weiblich</option>
                <option value="male">Männlich</option>
              </select>
            </label>
            <label className="field">
              <span>Zustimmung über welchen Kanal *</span>
              <input className="toolbar-input" name="consentChannel" placeholder="z. B. Telefon 08.08." required />
            </label>
            <label className="field">
              <span>Notiz zur Zustimmung (optional)</span>
              <textarea className="toolbar-input" name="consentNote" rows={2} />
            </label>
          </div>
        </AdminSectionCard>

        <AdminSectionCard eyebrow="Standort & Kontakt" title="Adresse">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <label className="field">
                <span>Straße</span>
                <input className="toolbar-input" name="street" />
              </label>
              <label className="field">
                <span>Hausnummer</span>
                <input className="toolbar-input" name="houseNumber" />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <label className="field">
                <span>PLZ</span>
                <input className="toolbar-input" name="postalCode" />
              </label>
              <label className="field">
                <span>Stadt *</span>
                <input className="toolbar-input" name="city" required />
              </label>
            </div>
            <label className="field">
              <span>Telefon</span>
              <input className="toolbar-input" name="phone" />
            </label>
          </div>
        </AdminSectionCard>

        <AdminSectionCard eyebrow="Profil" title="Fachliche Angaben">
          <div style={{ display: 'grid', gap: 16 }}>
            <label className="field">
              <span>Profilfoto (optional)</span>
              <input className="toolbar-input" type="file" name="photo" accept="image/jpeg,image/png,image/webp" />
            </label>
            <label className="field">
              <span>Kurzbeschreibung / Bio</span>
              <textarea className="toolbar-input" name="bio" rows={3} />
            </label>
            <div>
              <div className="kicker" style={{ marginBottom: 8 }}>Spezialisierungen</div>
              {specializations.length > 0 ? <CheckboxGroup name="specializations" options={specializations} /> : <p style={{ color: 'var(--muted)', fontSize: 13 }}>Keine Optionen vorhanden.</p>}
            </div>
            <div>
              <div className="kicker" style={{ marginBottom: 8 }}>Fortbildungen</div>
              {certifications.length > 0 ? <CheckboxGroup name="certifications" options={certifications} /> : <p style={{ color: 'var(--muted)', fontSize: 13 }}>Keine Optionen vorhanden.</p>}
            </div>
            <div>
              <div className="kicker" style={{ marginBottom: 8 }}>Heilmittel</div>
              {heilmittel.length > 0 ? <CheckboxGroup name="heilmittel" options={heilmittel} /> : <p style={{ color: 'var(--muted)', fontSize: 13 }}>Keine Optionen vorhanden.</p>}
            </div>
            <div>
              <div className="kicker" style={{ marginBottom: 8 }}>Sprachen</div>
              <CheckboxGroup name="languages" options={LANGUAGES} defaultChecked={['de']} />
            </div>
            <div>
              <div className="kicker" style={{ marginBottom: 8 }}>Kassenarten</div>
              <CheckboxGroup name="kassenarten" options={KASSENARTEN} />
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard eyebrow="Hausbesuch" title="Mobilität">
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="homeVisit" value="true" />
              Bietet Hausbesuche an
            </label>
            <label className="field" style={{ maxWidth: 240 }}>
              <span>Einzugsgebiet (km, optional)</span>
              <input className="toolbar-input" name="serviceRadiusKm" type="number" min={1} max={200} />
            </label>
          </div>
        </AdminSectionCard>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="primary-btn" type="submit">Therapeut anlegen</button>
          <Link href="/therapists" className="secondary-btn">Abbrechen</Link>
        </div>
      </form>
    </PageShell>
  );
}
