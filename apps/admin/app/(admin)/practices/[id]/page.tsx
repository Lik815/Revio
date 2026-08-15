import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '../../../../components/page-shell';
import { AdminNotice } from '../../../../components/admin-notice';
import { AddLinkForm } from '../../../../components/add-link-form';
import { LinkedEntitiesSection } from '../../../../components/linked-entities-section';
import { api } from '../../../../lib/api';
import {
  updatePractice, uploadPracticeLogo, uploadPracticePhoto, removePracticePhoto,
  confirmLink, rejectLink, disputeLink, linkTherapistToPractice,
} from '../../../../lib/actions';

// Logo/Fotos liegen als relative URL (/uploads/practice-…/...) auf der API —
// fürs Anzeigen im Admin die öffentliche API-Basis davorsetzen (analog zum
// Therapeuten-Profilfoto).
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

// Gründe aus getPracticeVisibilityState() (apps/api/src/utils/practice-visibility.ts).
const VISIBILITY_REASON_LABEL: Record<string, string> = {
  not_approved: 'nicht freigegeben',
  address_incomplete: 'Adresse unvollständig',
  not_geocoded: 'nicht geokodiert',
  no_confirmed_link: 'kein bestätigter Therapeuten-Link',
  no_public_therapist: 'kein öffentlich sichtbares Therapeut:innenprofil',
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mediaError?: string; mediaOk?: string; linked?: string; linkError?: string }>;
};

export default async function PracticeEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const [practice, allTherapists] = await Promise.all([
    api.getPractice(id).catch(() => null),
    api.getTherapists().catch(() => []),
  ]);
  if (!practice) notFound();

  const claimed = Boolean(practice.ownerId);
  const photos = practice.photos ?? [];

  const links = practice.links ?? [];
  const linkedTherapistIds = new Set(links.map((l) => l.therapist.id));
  // Archivierte Profile und bereits verknüpfte Therapeut:innen gehören nicht in
  // die Auswahl — die API lehnt beides ab (400/409).
  const therapistOptions = allTherapists
    .filter((t) => !t.archivedAt && !linkedTherapistIds.has(t.id))
    .map((t) => ({ value: t.id, label: t.fullName, sublabel: `${t.professionalTitle} · ${t.city}` }));

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

        {practice.publiclyVisible === false ? (
          <p style={{ margin: '0 0 12px', color: 'var(--warning, #b45309)', fontSize: 13 }}>
            Diese Praxis ist aktuell nicht öffentlich sichtbar
            {practice.visibilityBlockingReasons?.length
              ? ` (${practice.visibilityBlockingReasons.map((r) => VISIBILITY_REASON_LABEL[r] ?? r).join(', ')})`
              : ''}
            .
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
              E-Mail
              <input className="toolbar-input" name="email" type="email" defaultValue={practice.email ?? ''} />
            </label>
            <label>
              Website
              <input className="toolbar-input" name="website" defaultValue={practice.website ?? ''} placeholder="https://…" />
            </label>
            <label>
              Öffnungszeiten
              <input className="toolbar-input" name="hours" defaultValue={practice.hours ?? ''} />
            </label>
            <label>
              Anfahrt (ÖPNV)
              <input className="toolbar-input" name="publicTransportNote" defaultValue={practice.publicTransportNote ?? ''} />
            </label>
            <label>
              Beschreibung
              <textarea className="toolbar-input" name="description" defaultValue={practice.description ?? ''} rows={3} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="homeVisit" value="true" defaultChecked={practice.homeVisit ?? false} />
              Hausbesuche möglich
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="wheelchairAccessible" value="true" defaultChecked={practice.wheelchairAccessible ?? false} />
              Barrierefrei
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" name="parkingAvailable" value="true" defaultChecked={practice.parkingAvailable ?? false} />
              Parkplatz vorhanden
            </label>
            <button className="primary-btn" type="submit">Speichern</button>
          </fieldset>
        </form>
      </article>

      {query.linked ? (
        <AdminNotice title="Verknüpft" tone="success">Die Verknüpfung wurde angelegt und ist sofort bestätigt.</AdminNotice>
      ) : null}
      {query.linkError ? (
        <AdminNotice title="Verknüpfen fehlgeschlagen" tone="warning">{query.linkError}</AdminNotice>
      ) : null}

      <LinkedEntitiesSection
        kicker="Verknüpfungen"
        title="Verknüpfte Therapeut:innen"
        description="Die Praxis ist öffentlich nur sichtbar, wenn mindestens eine bestätigte Verknüpfung auf ein öffentlich sichtbares Profil zeigt."
        rows={links.map((l) => ({
          linkId: l.id,
          status: l.status,
          name: l.therapist.fullName,
          sublabel: l.therapist.professionalTitle,
          href: `/therapists/${l.therapist.id}`,
          reviewStatus: l.therapist.reviewStatus,
          publiclyVisible: l.therapist.publiclyVisible,
          archived: Boolean(l.therapist.archivedAt),
        }))}
        emptyLabel="Noch keine Therapeut:innen verknüpft."
        linkActions={{ confirm: confirmLink, reject: rejectLink, dispute: disputeLink }}
      >
        <AddLinkForm
          name="therapistId"
          placeholder="Therapeut:in suchen…"
          submitLabel="Verknüpfen"
          options={therapistOptions}
          action={linkTherapistToPractice.bind(null, practice.id)}
          emptyHint="Keine weiteren Therapeut:innen verfügbar — alle sind bereits verknüpft oder archiviert."
        />
      </LinkedEntitiesSection>

      {!claimed ? (
        <article className="panel panel--compact" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <div className="panel-header__content">
              <div className="kicker">Medien</div>
              <h3>Logo & Fotos</h3>
            </div>
          </div>

          {query.mediaError ? <AdminNotice title="Upload fehlgeschlagen" tone="warning">{query.mediaError}</AdminNotice> : null}
          {query.mediaOk ? <AdminNotice title="Gespeichert" tone="success">Medien aktualisiert.</AdminNotice> : null}

          <div style={{ marginBottom: 20 }}>
            <div className="kicker" style={{ marginBottom: 12 }}>Logo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {practice.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API_BASE}${practice.logo}`}
                  alt={practice.name}
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--muted-bg, #f0f0f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                  Kein Logo
                </div>
              )}
              <form action={uploadPracticeLogo.bind(null, practice.id)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="file" name="logo" accept="image/jpeg,image/png,image/webp" required />
                <button className="primary-btn" type="submit">Logo hochladen</button>
              </form>
            </div>
          </div>

          <div>
            <div className="kicker" style={{ marginBottom: 12 }}>Fotos ({photos.length}/10)</div>
            {photos.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                {photos.map((url) => (
                  <div key={url} style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${API_BASE}${url}`}
                      alt=""
                      style={{ width: 96, height: 96, borderRadius: 8, objectFit: 'cover' }}
                    />
                    <form action={removePracticePhoto.bind(null, practice.id, url)} style={{ position: 'absolute', top: 4, right: 4 }}>
                      <button className="secondary-btn secondary-btn--compact" type="submit" title="Foto entfernen">✕</button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Noch keine Fotos.</p>
            )}
            {photos.length < 10 ? (
              <form action={uploadPracticePhoto.bind(null, practice.id)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required />
                <button className="primary-btn" type="submit">Foto hinzufügen</button>
              </form>
            ) : null}
          </div>
        </article>
      ) : null}
    </PageShell>
  );
}
