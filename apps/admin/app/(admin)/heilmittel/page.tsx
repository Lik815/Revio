import { PageShell } from '../../../components/page-shell';
import { api } from '../../../lib/api';
import {
  createHeilmittelOption,
  deleteHeilmittelOption,
  toggleHeilmittelOption,
  updateHeilmittelOption,
} from '../../../lib/actions';

export default async function HeilmittelPage() {
  const { heilmittel } = await api.getHeilmittelOptions();
  const activeCount = heilmittel.filter((option) => option.isActive).length;

  return (
    <PageShell
      title="Heilmittel"
      description="Verwalte die verordnungsfähigen Heilmittel-Kategorien, die Therapeut:innen bei der Aktivierung von Terminanfragen auswählen können. Getrennt von Fortbildungen — Heilmittel sind Leistungskategorien, keine Zusatzqualifikationen."
      eyebrow="Katalog"
      actions={<div className="hero-pill">{activeCount} aktiv</div>}
    >
      <article className="panel">
        <div className="panel-header">
          <div>
            <div className="kicker">Heilmittel</div>
            <h3>Auswahloptionen pflegen</h3>
          </div>
        </div>

        <form action={createHeilmittelOption} className="catalog-create-form">
          <input
            className="toolbar-input"
            name="label"
            placeholder="Neues Heilmittel hinzufügen"
            aria-label="Neues Heilmittel"
            required
          />
          <button className="primary-btn" type="submit">Hinzufügen</button>
        </form>

        {heilmittel.length === 0 ? (
          <div className="empty-state empty-state--compact" style={{ marginTop: 18 }}>
            <div className="empty-illustration">☷</div>
            <strong>Keine Heilmittel vorhanden</strong>
            <p style={{ margin: 0, color: 'var(--muted)' }}>Lege zuerst eine Option an, damit sie auswählbar wird.</p>
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
              {heilmittel.map((option) => (
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
                    <form action={updateHeilmittelOption.bind(null, option.id)} className="catalog-inline-form">
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
                      <form action={toggleHeilmittelOption.bind(null, option.id)}>
                        <button className="action-btn action-btn--warn" type="submit">
                          {option.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                      </form>
                      <form action={deleteHeilmittelOption.bind(null, option.id)}>
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
