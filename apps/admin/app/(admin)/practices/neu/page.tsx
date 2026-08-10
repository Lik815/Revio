import Link from 'next/link';
import { PageShell } from '../../../../components/page-shell';
import { AdminNotice } from '../../../../components/admin-notice';
import { AdminSectionCard } from '../../../../components/admin-section-card';
import { ChipToggle } from '../../../../components/chip-toggle';
import { FileDropzone } from '../../../../components/file-dropzone';
import { FormSectionNav } from '../../../../components/form-section-nav';
import { createPractice } from '../../../../lib/actions';

type SearchParams = Promise<{ formError?: string }>;

const SECTIONS = [
  { id: 'praxis', label: 'Praxis' },
  { id: 'adresse', label: 'Adresse' },
  { id: 'beschreibung', label: 'Beschreibung' },
  { id: 'medien', label: 'Logo & Fotos' },
];

export default async function NewPracticePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return (
    <PageShell
      title="Neue Praxis anlegen"
      description="Läuft wie eine selbstregistrierte Praxis durch die Freigabe-Warteschlange. Bearbeitbar, solange niemand sie übernommen hat. Straße, Hausnummer und PLZ sind Voraussetzung für die spätere Freigabe/Sichtbarkeit."
      eyebrow="Neuanlage"
      actions={<Link href="/practices" className="secondary-btn secondary-btn--compact">Zurück zur Liste</Link>}
    >
      {params.formError ? (
        <AdminNotice title="Anlegen fehlgeschlagen" tone="warning">{params.formError}</AdminNotice>
      ) : null}

      <form action={createPractice} className="form-with-nav">
        <div style={{ display: 'grid', gap: 20 }}>
          <AdminSectionCard id="praxis" eyebrow="Pflichtangaben" title="Praxis">
            <div style={{ display: 'grid', gap: 12 }}>
              <label className="field">
                <span>Name der Praxis *</span>
                <input className="toolbar-input" name="name" placeholder="Physiotherapie Musterstraße" required />
              </label>
            </div>
          </AdminSectionCard>

          <AdminSectionCard id="adresse" eyebrow="Standort & Kontakt" title="Adresse">
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <label className="field field--optional">
                  <span>Straße</span>
                  <input className="toolbar-input" name="street" />
                </label>
                <label className="field field--optional">
                  <span>Hausnummer</span>
                  <input className="toolbar-input" name="houseNumber" />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <label className="field field--optional">
                  <span>PLZ</span>
                  <input className="toolbar-input" name="postalCode" />
                </label>
                <label className="field">
                  <span>Stadt *</span>
                  <input className="toolbar-input" name="city" required />
                </label>
              </div>
              <label className="field field--optional">
                <span>Telefon</span>
                <input className="toolbar-input" name="phone" />
              </label>
              <label className="field field--optional">
                <span>E-Mail</span>
                <input className="toolbar-input" name="email" type="email" />
              </label>
              <label className="field field--optional">
                <span>Website</span>
                <input className="toolbar-input" name="website" placeholder="https://…" />
              </label>
              <label className="field field--optional">
                <span>Öffnungszeiten</span>
                <input className="toolbar-input" name="hours" placeholder="Mo–Fr 8–18 Uhr" />
              </label>
              <label className="field field--optional">
                <span>Anfahrt (ÖPNV)</span>
                <input className="toolbar-input" name="publicTransportNote" placeholder="z. B. 5 Min. von U-Bahn X" />
              </label>
            </div>
          </AdminSectionCard>

          <AdminSectionCard id="beschreibung" eyebrow="Profil" title="Beschreibung">
            <div style={{ display: 'grid', gap: 12 }}>
              <label className="field field--optional">
                <span>Kurzbeschreibung</span>
                <textarea className="toolbar-input" name="description" rows={3} />
              </label>
              <div className="chip-toggle-group">
                <ChipToggle name="homeVisit" value="true" label="Hausbesuche möglich" />
                <ChipToggle name="wheelchairAccessible" value="true" label="Barrierefrei" />
                <ChipToggle name="parkingAvailable" value="true" label="Parkplatz vorhanden" />
              </div>
            </div>
          </AdminSectionCard>

          <AdminSectionCard id="medien" eyebrow="Medien" title="Logo & Fotos (optional)">
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="field field--optional">
                <span>Logo</span>
                <FileDropzone
                  name="logo"
                  accept="image/jpeg,image/png,image/webp"
                  title="Logo auswählen oder hierher ziehen"
                  hint="JPEG, PNG oder WebP"
                />
              </div>
              <div className="field field--optional">
                <span>Fotos (max. 10)</span>
                <FileDropzone
                  name="photos"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  title="Fotos auswählen oder hierher ziehen"
                  hint="Mehrfachauswahl möglich"
                />
              </div>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                Schlägt der Upload fehl, bleibt die Praxis trotzdem angelegt — Medien lassen sich dann auf der
                Bearbeiten-Seite nachtragen.
              </p>
            </div>
          </AdminSectionCard>

          <div className="form-submit-bar">
            <button className="primary-btn" type="submit">Praxis anlegen</button>
            <Link href="/practices" className="secondary-btn">Abbrechen</Link>
          </div>
        </div>

        <FormSectionNav sections={SECTIONS} />
      </form>
    </PageShell>
  );
}
