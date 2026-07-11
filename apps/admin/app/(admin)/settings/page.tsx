import { PageShell } from '../../../components/page-shell';
import { api } from '../../../lib/api';
import { updateSiteUnderConstruction, updateCoursesEnabled } from '../../../lib/actions';

export default async function SettingsPage() {
  const siteSettings = await api.getSiteSettings();
  const websiteStateLabel = siteSettings.underConstruction ? 'Under Construction aktiv' : 'Website normal sichtbar';
  const coursesStateLabel = siteSettings.coursesEnabled ? 'Kurse aktiv' : 'Kurse deaktiviert';

  return (
    <PageShell
      title="Einstellungen"
      description="Ruhige Steuerung für die öffentliche Website und zentrale App-Optionen."
      eyebrow="Konfiguration"
      actions={<div className="hero-pill">{websiteStateLabel}</div>}
    >
      <article className="panel panel--compact">
        <div className="panel-header">
          <div className="panel-header__content">
            <div className="kicker">Website</div>
            <h3>Präsentationsseite</h3>
            <p className="panel-header__description">
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

      <article className="panel panel--compact">
        <div className="panel-header">
          <div className="panel-header__content">
            <div className="kicker">App</div>
            <h3>Gesundheitskurse</h3>
            <p className="panel-header__description">
              Plattformweiter Schalter für die Kurs-Funktion. Ist sie deaktiviert, sind Kurse für
              alle Nutzer:innen unsichtbar und die zugehörigen Endpunkte antworten nicht mehr.
            </p>
          </div>
          <span className={`badge ${siteSettings.coursesEnabled ? 'badge--APPROVED' : 'badge--PENDING_REVIEW'}`}>
            {coursesStateLabel}
          </span>
        </div>

        <div className="settings-feature-grid">
          <div className="settings-feature-card">
            <div className="settings-feature-card__label">App settings</div>
            <h4>Kurse plattformweit steuern</h4>
            <p>
              Deaktiviere die Kurs-Funktion für die gesamte Plattform. Die Suche, die Kursdetails und
              der Anbieter-Bereich „Meine Kurse" verschwinden für alle Nutzer:innen. Bereits angelegte
              Kurse bleiben erhalten und werden beim erneuten Aktivieren wieder sichtbar.
            </p>
            <div className="settings-feature-actions">
              <form action={updateCoursesEnabled}>
                <input type="hidden" name="coursesEnabled" value={siteSettings.coursesEnabled ? 'false' : 'true'} />
                <button className={`primary-btn ${siteSettings.coursesEnabled ? 'primary-btn--muted' : ''}`} type="submit">
                  {siteSettings.coursesEnabled ? 'Kurse deaktivieren' : 'Kurse aktivieren'}
                </button>
              </form>
            </div>
          </div>

          <aside className="settings-status-card">
            <div className="settings-status-card__eyebrow">Live-Status</div>
            <strong>{coursesStateLabel}</strong>
            <p>Gilt für App und öffentliche Kurs-Endpunkte.</p>
            <p>
              Der Admin-Bereich zur Kurs-Prüfung bleibt unabhängig davon erreichbar, damit bestehende
              Kurse weiter verwaltet werden können.
            </p>
          </aside>
        </div>
      </article>
    </PageShell>
  );
}
