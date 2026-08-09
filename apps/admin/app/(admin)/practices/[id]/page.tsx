import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '../../../../components/page-shell';
import { api } from '../../../../lib/api';
import { updatePractice } from '../../../../lib/actions';

export default async function PracticeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const practice = await api.getPractice(id).catch(() => null);
  if (!practice) notFound();

  const claimed = Boolean(practice.ownerId);

  return (
    <PageShell
      title={practice.name}
      description="Solange die Praxis unbeansprucht ist (kein Claim), kann sie hier frei bearbeitet werden."
      eyebrow="Praxis"
      actions={<Link href="/practices" className="action-btn">Zurück zur Warteschlange</Link>}
    >
      {claimed ? (
        <div className="empty-state empty-state--compact" style={{ marginBottom: 20 }}>
          <div className="empty-illustration">🔒</div>
          <strong>Diese Praxis wurde bereits übernommen</strong>
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            Sobald ein Claim stattgefunden hat, verwaltet die Praxis ihr Profil selbst — der Operator-Zugriff endet
            an diesem Punkt bewusst.
          </p>
        </div>
      ) : null}

      <article className="panel panel--compact">
        <div className="panel-header">
          <div className="panel-header__content">
            <div className="kicker">Praxisdaten</div>
            <h3>Angaben bearbeiten</h3>
          </div>
          <span className={`badge badge--${practice.reviewStatus}`}>{practice.reviewStatus}</span>
        </div>

        {!practice.addressComplete ? (
          <p style={{ margin: '0 0 12px', color: 'var(--warning, #b45309)', fontSize: 13 }}>
            Adresse unvollständig — Straße, Hausnummer und PLZ fehlen. Ohne vollständige Adresse und
            mindestens einen bestätigten Therapeuten kann diese Praxis nicht freigegeben werden.
          </p>
        ) : null}

        <form
          action={updatePractice.bind(null, practice.id)}
          className="catalog-inline-form"
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}
        >
          <fieldset disabled={claimed} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
            <label>
              Name
              <input className="toolbar-input" name="name" defaultValue={practice.name} required />
            </label>
            <label>
              Stadt
              <input className="toolbar-input" name="city" defaultValue={practice.city} required />
            </label>
            <label>
              Straße
              <input className="toolbar-input" name="street" defaultValue={practice.street ?? ''} />
            </label>
            <label>
              Hausnummer
              <input className="toolbar-input" name="houseNumber" defaultValue={practice.houseNumber ?? ''} />
            </label>
            <label>
              PLZ
              <input className="toolbar-input" name="postalCode" defaultValue={practice.postalCode ?? ''} />
            </label>
            <label>
              Telefon
              <input className="toolbar-input" name="phone" defaultValue={practice.phone ?? ''} />
            </label>
            <label>
              Öffnungszeiten
              <input className="toolbar-input" name="hours" defaultValue={practice.hours ?? ''} />
            </label>
            <label>
              Beschreibung
              <textarea className="toolbar-input" name="description" defaultValue={practice.description ?? ''} rows={3} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="homeVisit" value="true" defaultChecked={practice.homeVisit ?? false} />
              Hausbesuche möglich
            </label>
            <button className="primary-btn" type="submit">Speichern</button>
          </fieldset>
        </form>
      </article>
    </PageShell>
  );
}
