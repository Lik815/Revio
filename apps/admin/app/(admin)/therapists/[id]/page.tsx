import Link from 'next/link';
import { PageShell } from '../../../../components/page-shell';
import { TherapistActions } from '../../../../components/action-buttons';
import {
  approveTherapist,
  rejectTherapist,
  requestChangesTherapist,
  suspendTherapist,
} from '../../../../lib/actions';
import { api } from '../../../../lib/api';

type Props = { params: Promise<{ id: string }> };

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Ausstehend',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  CHANGES_REQUESTED: 'Änderungen',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
};

const visibilityLabel: Record<string, string> = {
  visible: 'Sichtbar',
  blocked: 'Blockiert',
  not_approved: 'Nicht freigegeben',
};

const visibilityBadgeClass: Record<string, string> = {
  visible: 'badge--APPROVED',
  blocked: 'badge--CHANGES_REQUESTED',
  not_approved: 'badge--DRAFT',
};

const blockingReasonLabel: Record<string, string> = {
  profile_incomplete: 'Profil unvollständig',
  manually_hidden: 'Manuell versteckt (isVisible = false)',
  publication_missing: 'Explizite Freigabe fehlt (isPublished = false)',
  no_confirmed_link: 'Keine bestätigte Praxis-Verknüpfung',
  pending_link_only: 'Nur ausstehende/strittige Praxis-Links',
  practice_not_approved: 'Alle verknüpften Praxen nicht freigegeben',
  no_home_visit: 'Kein Hausbesuch aktiviert (Mobile-Pfad erfordert homeVisit = true)',
  no_service_radius: 'Kein Einzugsgebiet angegeben (serviceRadiusKm fehlt)',
  no_kassenart: 'Keine Kassenart angegeben',
  no_confirmed_practice_link: 'Keine bestätigte Praxis-Verknüpfung (Praxis-Pfad)',
  booking_mode_disabled: 'Direkte Anfragen sind ausgeschaltet',
};

const bookingModeLabel: Record<string, string> = {
  DIRECTORY_ONLY: 'Nur Verzeichnis',
  FIRST_APPOINTMENT_REQUEST: 'Ersttermin anfragbar',
};

function mimeIcon(mimetype: string) {
  if (mimetype === 'application/pdf') return '📄';
  if (mimetype.startsWith('image/')) return '🖼️';
  return '📎';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function summarizeReasons(reasons: string[]) {
  if (reasons.length === 0) return null;
  const [first, ...rest] = reasons;
  return rest.length > 0 ? `${first} +${rest.length}` : first;
}

export default async function TherapistDetailPage({ params }: Props) {
  const { id } = await params;

  const [therapist, documents] = await Promise.all([
    api.getTherapist(id),
    api.getTherapistDocuments(id),
  ]);
  const publicVisibilityBadge =
    therapist.reviewStatus === 'APPROVED' && therapist.isVisible
      ? { label: 'Öffentlich sichtbar', className: 'badge badge--APPROVED' }
      : therapist.reviewStatus === 'APPROVED' && !therapist.isVisible
        ? { label: 'Freigegeben, aber versteckt', className: 'badge badge--PENDING_REVIEW' }
        : { label: 'Nicht öffentlich', className: 'badge badge--DRAFT' };
  const bookingModeBadge =
    therapist.bookingMode === 'FIRST_APPOINTMENT_REQUEST'
      ? {
        label: therapist.requestability?.requestable ? 'Ersttermin anfragbar' : 'Anfragbar geplant',
        className: therapist.requestability?.requestable ? 'badge badge--APPROVED' : 'badge badge--PENDING_REVIEW',
      }
      : { label: 'Nur Verzeichnis', className: 'badge badge--DRAFT' };
  const isApprovedButNotVisible = therapist.reviewStatus === 'APPROVED' && therapist.visibility.visibilityState !== 'visible';
  const isRequestModeBlocked = therapist.bookingMode === 'FIRST_APPOINTMENT_REQUEST' && !therapist.requestability?.requestable;
  const blockerReasons = (
    therapist.visibility.blockingReasons.length > 0
      ? therapist.visibility.blockingReasons
      : isApprovedButNotVisible
        ? ['manually_hidden']
      : []
  ).map((reason) => blockingReasonLabel[reason] ?? reason);
  const requestabilityBlockers = (therapist.requestability?.blockingReasons ?? []).map((reason) => blockingReasonLabel[reason] ?? reason);
  const visibilitySummary = summarizeReasons(blockerReasons);
  const requestabilitySummary = summarizeReasons(requestabilityBlockers);

  return (
    <PageShell
      title={therapist.fullName}
      description={`${therapist.professionalTitle} · ${therapist.city} · ${therapist.email}`}
      eyebrow={<Link href="/therapists" className="page-back-link">← Zurück zur Liste</Link>}
      actions={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge badge--${therapist.reviewStatus}`}>
            {statusLabel[therapist.reviewStatus] ?? therapist.reviewStatus}
          </span>
          <span className={publicVisibilityBadge.className}>
            {publicVisibilityBadge.label}
          </span>
          <span className={bookingModeBadge.className}>
            {bookingModeBadge.label}
          </span>
        </div>
      }
    >
      {isApprovedButNotVisible && (
        <div className="notice-box notice-box--warning">
          <div className="notice-box__icon">!</div>
          <div>
            <strong>Nicht sichtbar weil:</strong> {blockerReasons.join(', ')}
          </div>
        </div>
      )}

      {isRequestModeBlocked && (
        <div className="notice-box notice-box--warning">
          <div className="notice-box__icon">!</div>
          <div>
            <strong>Nicht anfragbar weil:</strong> {requestabilityBlockers.join(', ')}
          </div>
        </div>
      )}

      <section className="card-grid" style={{ marginBottom: 24 }}>
        <article className="card">
          <div className="kicker">Review</div>
          <div className={`badge badge--${therapist.reviewStatus}`} style={{ width: 'fit-content', marginTop: 8 }}>
            {statusLabel[therapist.reviewStatus] ?? therapist.reviewStatus}
          </div>
          <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            {therapist.reviewStatus === 'APPROVED'
              ? 'Profil ist administrativ freigegeben.'
              : therapist.reviewStatus === 'PENDING_REVIEW'
                ? 'Profil wartet aktuell auf Prüfung.'
                : 'Der Review-Status braucht Aufmerksamkeit.'}
          </p>
        </article>

        <article className="card">
          <div className="kicker">Öffentlichkeit</div>
          <div className={publicVisibilityBadge.className} style={{ width: 'fit-content', marginTop: 8 }}>
            {publicVisibilityBadge.label}
          </div>
          <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            {visibilitySummary ?? 'Profil erscheint in der öffentlichen Suche.'}
          </p>
        </article>

        <article className="card">
          <div className="kicker">Ersttermin</div>
          <div className={bookingModeBadge.className} style={{ width: 'fit-content', marginTop: 8 }}>
            {bookingModeBadge.label}
          </div>
          <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            {requestabilitySummary
              ?? (therapist.nextFreeSlotAt ? `Nächster freier Termin: ${formatDate(therapist.nextFreeSlotAt)}` : 'Aktuell ohne hinterlegten freien Termin.')}
          </p>
        </article>
      </section>

      {/* Visibility state */}
      {(() => {
        const vis = therapist.visibility;
        const isBlocked = vis.visibilityState === 'blocked';
        const isVisible = vis.visibilityState === 'visible';
        return (
          <div
            className="card"
            style={{
              padding: '16px 20px',
              marginBottom: 24,
              borderLeft: `4px solid ${isVisible ? 'var(--success, #16a34a)' : isBlocked ? 'var(--warning, #d97706)' : 'var(--muted)'}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: vis.blockingReasons.length ? 8 : 0 }}>
                <span className={`badge ${visibilityBadgeClass[vis.visibilityState] ?? 'badge--DRAFT'}`}>
                  {visibilityLabel[vis.visibilityState] ?? vis.visibilityState}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {isVisible
                    ? 'Therapeut:in erscheint in der öffentlichen Suche.'
                    : isBlocked
                      ? 'Profil ist freigegeben, aber in der öffentlichen Suche nicht sichtbar.'
                      : 'Profil wurde noch nicht freigegeben.'}
                </span>
              </div>
              {vis.blockingReasons.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--muted)', fontSize: 13 }}>
                  {vis.blockingReasons.map((r) => (
                    <li key={r}>{blockingReasonLabel[r] ?? r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })()}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        <TherapistActions
          id={therapist.id}
          status={therapist.reviewStatus}
          actions={{
            approve: approveTherapist,
            reject: rejectTherapist,
            requestChanges: requestChangesTherapist,
            suspend: suspendTherapist,
          }}
        />
      </div>

      {/* Profile details */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 32 }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="kicker" style={{ marginBottom: 12 }}>Profil</div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0 }}>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>E-Mail</dt>
            <dd style={{ margin: 0 }}>{therapist.email}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Titel</dt>
            <dd style={{ margin: 0 }}>{therapist.professionalTitle}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Stadt</dt>
            <dd style={{ margin: 0 }}>{therapist.city || '–'}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Hausbesuche</dt>
            <dd style={{ margin: 0 }}>{therapist.homeVisit ? 'Ja' : 'Nein'}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Einzugsgebiet</dt>
            <dd style={{ margin: 0 }}>{therapist.serviceRadiusKm ? `${therapist.serviceRadiusKm} km` : '–'}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Kassenart</dt>
            <dd style={{ margin: 0 }}>{therapist.kassenart || '–'}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Eingereicht</dt>
            <dd style={{ margin: 0 }}>{new Date(therapist.createdAt).toLocaleDateString('de-DE')}</dd>
          </dl>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="kicker" style={{ marginBottom: 12 }}>Fachliches</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 4 }}>Spezialisierungen</div>
            <div className="tag-list">
              {therapist.specializations?.length
                ? therapist.specializations.map((s) => <span key={s} className="tag">{s}</span>)
                : <span style={{ color: 'var(--muted)', fontSize: 13 }}>–</span>}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 4 }}>Sprachen</div>
            <div className="tag-list">
              {therapist.languages?.length
                ? therapist.languages.map((l) => <span key={l} className="tag">{l}</span>)
                : <span style={{ color: 'var(--muted)', fontSize: 13 }}>–</span>}
            </div>
          </div>
          {therapist.certifications?.length ? (
            <div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 4 }}>Zertifizierungen</div>
              <div className="tag-list">
                {therapist.certifications.map((c) => <span key={c} className="tag">{c}</span>)}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {therapist.bio && (
        <section style={{ marginBottom: 32 }}>
          <div className="card" style={{ padding: '20px 24px' }}>
            <div className="kicker" style={{ marginBottom: 8 }}>Bio</div>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{therapist.bio}</p>
          </div>
        </section>
      )}

      {/* Linked practices */}
      {therapist.links && therapist.links.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div className="card" style={{ padding: '20px 24px' }}>
            <div className="kicker" style={{ marginBottom: 12 }}>Verknüpfte Praxen</div>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Praxis</th>
                  <th>Stadt</th>
                  <th>Link-Status</th>
                  <th>Praxis-Status</th>
                </tr>
              </thead>
              <tbody>
                {therapist.links.map((l) => (
                  <tr key={l.id}>
                    <td><Link href={`/practices/${l.practice.id}`}>{l.practice.name}</Link></td>
                    <td>{l.practice.city}</td>
                    <td><span className={`badge badge--${l.status}`}>{l.status}</span></td>
                    <td><span className={`badge badge--${l.practice.reviewStatus}`}>{statusLabel[l.practice.reviewStatus] ?? l.practice.reviewStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Documents */}
      <section>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="kicker">Dokumente</div>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                Vom Therapeuten hochgeladene Nachweise und Qualifikationsunterlagen.
              </p>
            </div>
            <div className="hero-pill">{documents.length} {documents.length === 1 ? 'Datei' : 'Dateien'}</div>
          </div>

          {documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14 }}>Noch keine Dokumente hochgeladen</div>
            </div>
          ) : (
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Datei</th>
                  <th>Typ</th>
                  <th>Hochgeladen am</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{mimeIcon(doc.mimetype)}</span>
                        <span style={{ fontWeight: 500, wordBreak: 'break-all' }}>{doc.originalName}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>{doc.mimetype}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>{formatDate(doc.uploadedAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a
                          href={`/api/documents/${doc.filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="primary-btn"
                          style={{ fontSize: 13, padding: '6px 14px' }}
                        >
                          Ansehen
                        </a>
                        <a
                          href={`/api/documents/${doc.filename}`}
                          download={doc.originalName}
                          className="secondary-btn"
                          style={{ fontSize: 13, padding: '6px 14px' }}
                        >
                          Download
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </PageShell>
  );
}
