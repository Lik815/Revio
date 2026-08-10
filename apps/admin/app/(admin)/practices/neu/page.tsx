import Link from 'next/link';
import { PageShell } from '../../../../components/page-shell';
import { AdminNotice } from '../../../../components/admin-notice';
import { AdminSectionCard } from '../../../../components/admin-section-card';
import { createPractice } from '../../../../lib/actions';

type SearchParams = Promise<{ formError?: string }>;

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

      <form action={createPractice} style={{ display: 'grid', gap: 20, maxWidth: 640 }}>
        <AdminSectionCard eyebrow="Pflichtangaben" title="Praxis">
          <div style={{ display: 'grid', gap: 12 }}>
            <label className="field">
              <span>Name der Praxis *</span>
              <input className="toolbar-input" name="name" placeholder="Physiotherapie Musterstraße" required />
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
            <label className="field">
              <span>E-Mail</span>
              <input className="toolbar-input" name="email" type="email" />
            </label>
            <label className="field">
              <span>Website</span>
              <input className="toolbar-input" name="website" placeholder="https://…" />
            </label>
            <label className="field">
              <span>Öffnungszeiten</span>
              <input className="toolbar-input" name="hours" placeholder="Mo–Fr 8–18 Uhr" />
            </label>
            <label className="field">
              <span>Anfahrt (ÖPNV)</span>
              <input className="toolbar-input" name="publicTransportNote" placeholder="z. B. 5 Min. von U-Bahn X" />
            </label>
          </div>
        </AdminSectionCard>

        <AdminSectionCard eyebrow="Profil" title="Beschreibung">
          <div style={{ display: 'grid', gap: 12 }}>
            <label className="field">
              <span>Kurzbeschreibung</span>
              <textarea className="toolbar-input" name="description" rows={3} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="homeVisit" value="true" />
              Hausbesuche möglich
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="wheelchairAccessible" value="true" />
              Barrierefrei
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="parkingAvailable" value="true" />
              Parkplatz vorhanden
            </label>
          </div>
        </AdminSectionCard>

        <AdminSectionCard eyebrow="Medien" title="Logo & Fotos (optional)">
          <div style={{ display: 'grid', gap: 12 }}>
            <label className="field">
              <span>Logo</span>
              <input className="toolbar-input" type="file" name="logo" accept="image/jpeg,image/png,image/webp" />
            </label>
            <label className="field">
              <span>Fotos (max. 10)</span>
              <input className="toolbar-input" type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple />
            </label>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
              Schlägt der Upload fehl, bleibt die Praxis trotzdem angelegt — Medien lassen sich dann auf der
              Bearbeiten-Seite nachtragen.
            </p>
          </div>
        </AdminSectionCard>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="primary-btn" type="submit">Praxis anlegen</button>
          <Link href="/practices" className="secondary-btn">Abbrechen</Link>
        </div>
      </form>
    </PageShell>
  );
}
