import { PageShell } from '../../../components/page-shell';
import { api } from '../../../lib/api';
import {
  createCertificationOption,
  deleteCertificationOption,
  toggleCertificationOption,
  updateCertificationOption,
} from '../../../lib/actions';

export default async function CertificationsPage() {
  const { certifications } = await api.getCertificationOptions();
  const activeCount = certifications.filter((option) => option.isActive).length;

  return (
    <PageShell
      title="Fortbildungen"
      description="Verwalte die Fortbildungsoptionen, die Therapeut:innen in der App auswählen können."
      eyebrow="Katalog"
      actions={<div className="hero-pill">{activeCount} aktiv</div>}
    >
      <article className="panel">
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
