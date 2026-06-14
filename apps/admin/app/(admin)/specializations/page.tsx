import { PageShell } from '../../../components/page-shell';
import { api } from '../../../lib/api';
import {
  createSpecializationOption,
  deleteSpecializationOption,
  toggleSpecializationOption,
  updateSpecializationOption,
} from '../../../lib/actions';

export default async function SpecializationsPage() {
  const { specializations } = await api.getSpecializationOptions();
  const activeCount = specializations.filter((option) => option.isActive).length;

  return (
    <PageShell
      title="Schwerpunkte"
      description="Verwalte Spezialisierungen wie Neurologie, Sportphysiotherapie oder Orthopädie unabhängig von Fortbildungen."
      eyebrow="Katalog"
      actions={<div className="hero-pill">{activeCount} aktiv</div>}
    >
      <article className="panel">
        <div className="panel-header">
          <div>
            <div className="kicker">Spezialisierungen</div>
            <h3>Schwerpunkte pflegen</h3>
          </div>
        </div>

        <form action={createSpecializationOption} className="catalog-create-form">
          <input
            className="toolbar-input"
            name="label"
            placeholder="Neuen Schwerpunkt hinzufügen"
            aria-label="Neuer Schwerpunkt"
            required
          />
          <button className="primary-btn" type="submit">Hinzufügen</button>
        </form>

        {specializations.length === 0 ? (
          <div className="empty-state empty-state--compact" style={{ marginTop: 18 }}>
            <div className="empty-illustration">+</div>
            <strong>Keine Schwerpunkte vorhanden</strong>
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              Lege zuerst einen Schwerpunkt an, damit er in der App auswählbar wird.
            </p>
          </div>
        ) : (
          <table className="table table--elevated" style={{ marginTop: 18 }}>
            <thead>
              <tr>
                <th>Schlüssel</th>
                <th>Status</th>
                <th>Anzeigename</th>
                <th>Verwendung</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {specializations.map((option) => (
                <tr key={option.id}>
                  <td data-label="Schlüssel">
                    <span className="tag">{option.key}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${option.isActive ? 'badge--APPROVED' : 'badge--DRAFT'}`}>
                      {option.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td data-label="Anzeigename">
                    <form action={updateSpecializationOption.bind(null, option.id)} className="catalog-inline-form">
                      <input
                        className="toolbar-input toolbar-input--sm"
                        name="label"
                        defaultValue={option.label}
                        aria-label={`Anzeigename für ${option.key}`}
                        disabled={option.usageCount > 0}
                        required
                      />
                      <button className="action-btn" type="submit" disabled={option.usageCount > 0}>
                        Speichern
                      </button>
                    </form>
                  </td>
                  <td data-label="Verwendung">
                    {option.usageCount > 0 ? `${option.usageCount} Profil(e)` : 'Nicht verwendet'}
                  </td>
                  <td data-label="Aktionen">
                    <div className="action-row">
                      <form action={toggleSpecializationOption.bind(null, option.id)}>
                        <button className="action-btn action-btn--warn" type="submit">
                          {option.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                      </form>
                      <form action={deleteSpecializationOption.bind(null, option.id)}>
                        <button
                          className="action-btn action-btn--reject"
                          type="submit"
                          disabled={option.usageCount > 0}
                          title={option.usageCount > 0 ? 'Verwendete Schwerpunkte können nur deaktiviert werden' : undefined}
                        >
                          Löschen
                        </button>
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
