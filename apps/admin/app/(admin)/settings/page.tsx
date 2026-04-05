import { PageShell } from '../../../components/page-shell';
import { api } from '../../../lib/api';
import { updateSiteUnderConstruction } from '../../../lib/actions';

export default async function SettingsPage() {
  const siteSettings = await api.getSiteSettings();
  const websiteStateLabel = siteSettings.underConstruction ? 'Under Construction aktiv' : 'Website normal sichtbar';

  return (
    <PageShell
      title="Einstellungen"
      description="Ruhige Steuerung für die öffentliche Website und zentrale App-Optionen."
      eyebrow="Konfiguration"
      actions={<div className="hero-pill">{websiteStateLabel}</div>}
    >
      <article className="panel panel--compact">
        <div className="panel-header">
          <div>
            <div className="kicker">Website</div>
            <h3>Präsentationsseite</h3>
            <p style={{ margin: '8px 0 0', color: 'var(--muted)', maxWidth: 560 }}>
              Mit diesem Schalter kannst du die öffentliche Website vorübergehend auf einen ruhigen
              „Under Construction"-Zustand setzen, ohne sie offline zu nehmen.
            </p>
          </div>
          <span className={`badge ${siteSettings.underConstruction ? 'badge--PENDING_REVIEW' : 'badge--APPROVED'}`}>
            {siteSettings.underConstruction ? 'Under Construction aktiv' : 'Website normal sichtbar'}
          </span>
        </div>

        <div className="settings-feature-grid">
          <div className="settings-feature-card">
            <div className="settings-feature-card__label">Web settings</div>
            <h4>Under Construction steuern</h4>
            <p>
              Mit diesem Schalter kannst du die öffentliche Website vorübergehend auf einen ruhigen „Under Construction"-Zustand setzen, ohne sie offline zu nehmen.
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
            <p>Domain: <span>my-revio.de</span></p>
            <p>
              Der Schalter wirkt direkt auf die öffentliche Präsentationsseite und lässt Impressum sowie Datenschutz weiter erreichbar.
            </p>
          </aside>
        </div>
      </article>
    </PageShell>
  );
}
