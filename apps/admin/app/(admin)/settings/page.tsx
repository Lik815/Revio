import { PageShell } from '../../../components/page-shell';
import { api } from '../../../lib/api';
import {
  createCertificationOption,
  deleteCertificationOption,
  toggleCertificationOption,
  updateSiteUnderConstruction,
  updateCertificationOption,
} from '../../../lib/actions';

export default async function SettingsPage() {
  const [{ certifications }, siteSettings] = await Promise.all([
    api.getCertificationOptions(),
    api.getSiteSettings(),
  ]);
  const activeCount = certifications.filter((option) => option.isActive).length;
  const websiteStateLabel = siteSettings.underConstruction ? 'Under Construction aktiv' : 'Website normal sichtbar';

  return (
    <PageShell
      title="Einstellungen"
      description="Verwalte die wichtigsten globalen Optionen für Website und App, ohne unnötige Produktlogik aufzubauen."
      eyebrow="Konfiguration"
      actions={<div className="hero-pill">{websiteStateLabel} · {activeCount} Fortbildungen</div>}
    >
      <div className="settings-subnav" aria-label="Einstellungsbereiche">
        <a href="#website-settings" className="settings-chip settings-chip--active">Web settings</a>
        <a href="#certification-settings" className="settings-chip">Fortbildungen</a>
      </div>

      <article id="website-settings" className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <div className="kicker">Website</div>
            <h3>Präsentationsseite</h3>
            <p style={{ margin: '8px 0 0', color: 'var(--muted)', maxWidth: 560 }}>
              Mit diesem Schalter kannst du die öffentliche Website vorübergehend auf einen ruhigen
              „Under Construction“-Zustand setzen, ohne sie offline zu nehmen.
            </p>
          </div>
          <span className={`badge ${siteSettings.underConstruction ? 'badge--PENDING_REVIEW' : 'badge--APPROVED'}`}>
            {siteSettings.underConstruction ? 'Under Construction aktiv' : 'Website normal sichtbar'}
          </span>
        </div>

        <div className="settings-feature-grid">
          <div className="settings-feature-card">
            <div className="settings-feature-card__label">Website</div>
            <h4>Präsentationsseite</h4>
            <p>
              Mit diesem Schalter kannst du die öffentliche Website vorübergehend auf einen ruhigen „Under Construction“-Zustand setzen, ohne sie offline zu nehmen.
            </p>
            <div className="settings-feature-actions">
              <form action={updateSiteUnderConstruction}>
                <input type="hidden" name="underConstruction" value={siteSettings.underConstruction ? 'false' : 'true'} />
                <button className={`primary-btn ${siteSettings.underConstruction ? 'primary-btn--muted' : ''}`} type="submit">
                  {siteSettings.underConstruction ? 'Website wieder freigeben' : 'Under Construction aktivieren'}
                </button>
              </form>
            </div>
          </div>

          <aside className="settings-status-card">
            <div className="settings-status-card__eyebrow">Live-Status</div>
            <strong>{siteSettings.underConstruction ? 'Under Construction aktiv' : 'Website normal sichtbar'}</strong>
            <p>
              Domain: <span>my-revio.de</span>
            </p>
            <p>
              Der Schalter wirkt direkt auf die öffentliche Präsentationsseite und lässt Impressum sowie Datenschutz weiter erreichbar.
            </p>
          </aside>
        </div>
      </article>

      <article id="certification-settings" className="panel">
        <div className="panel-header">
          <div>
            <div className="kicker">Fortbildungen</div>
            <h3>Auswahloptionen pflegen</h3>
          </div>
        </div>

        <form action={createCertificationOption} className="catalog-create-form">
          <input
            className="toolbar-input"
            name="label"
            placeholder="Neue Fortbildung hinzufügen"
            aria-label="Neue Fortbildung"
            required
          />
          <button className="primary-btn" type="submit">Hinzufügen</button>
        </form>

        {certifications.length === 0 ? (
          <div className="empty-state empty-state--compact" style={{ marginTop: 18 }}>
            <div className="empty-illustration">☷</div>
            <strong>Keine Fortbildungen vorhanden</strong>
            <p style={{ margin: 0, color: 'var(--muted)' }}>Lege zuerst eine Option an, damit sie in der App auswählbar wird.</p>
          </div>
        ) : (
          <table className="table table--elevated" style={{ marginTop: 18 }}>
            <thead>
              <tr>
                <th>Wert</th>
                <th>Status</th>
                <th>Anzeigename</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {certifications.map((option) => (
                <tr key={option.id}>
                  <td data-label="Wert">
                    <span className="tag">{option.key}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${option.isActive ? 'badge--APPROVED' : 'badge--DRAFT'}`}>
                      {option.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td data-label="Anzeigename">
                    <form action={updateCertificationOption.bind(null, option.id)} className="catalog-inline-form">
                      <input
                        className="toolbar-input toolbar-input--sm"
                        name="label"
                        defaultValue={option.label}
                        aria-label={`Anzeigename für ${option.key}`}
                        required
                      />
                      <button className="action-btn" type="submit">Speichern</button>
                    </form>
                  </td>
                  <td data-label="Aktionen">
                    <div className="action-row">
                      <form action={toggleCertificationOption.bind(null, option.id)}>
                        <button className="action-btn action-btn--warn" type="submit">
                          {option.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                      </form>
                      <form action={deleteCertificationOption.bind(null, option.id)}>
                        <button className="action-btn action-btn--reject" type="submit">Löschen</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </PageShell>
  );
}
