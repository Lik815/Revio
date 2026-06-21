import Link from 'next/link';
import type { PublicTherapist } from '../lib/public-api';
import { AppOnlyCta } from './app-only-cta';

const LANGUAGE_LABELS: Record<string, string> = {
  DE: 'Deutsch', EN: 'Englisch', FR: 'Französisch', ES: 'Spanisch', IT: 'Italienisch',
  TR: 'Türkisch', AR: 'Arabisch', PL: 'Polnisch', RU: 'Russisch', SR: 'Serbisch',
  PT: 'Portugiesisch', NL: 'Niederländisch', UK: 'Ukrainisch', HR: 'Kroatisch',
};

function langLabel(code: string) {
  return LANGUAGE_LABELS[code.toUpperCase()] ?? code;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatNextSlot(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ProfileIcon({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <path d={path} />
    </svg>
  );
}

export function PublicTherapistProfile({ therapist }: { therapist: PublicTherapist }) {
  const nextSlotLabel = formatNextSlot(therapist.nextFreeSlotAt);

  return (
    <section className="section section--profile">
      <div className="shell">
        <Link href="/finden" className="page-back-link">← Zurück zur Suche</Link>

        <div className="profile-stack">
          <div className="surface-card profile-hero">
            <div className="profile-hero__topbar">
              <div className="eyebrow">Geprueftes Profil</div>
              {therapist.requestable ? (
                <span className="profile-status-badge">Terminanfrage moeglich</span>
              ) : null}
            </div>

            <div className="profile-header">
              <div className="profile-header__avatar-wrap">
                {therapist.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={therapist.photo} alt={therapist.fullName} className="profile-header__avatar" />
                ) : (
                  <div className="profile-header__avatar profile-header__avatar--fallback">
                    {initials(therapist.fullName)}
                  </div>
                )}
                <div className="profile-header__verified">
                  <ProfileIcon path="M9 12.75 11.25 15 15 9.75M8.21 3.22 12 2l3.79 1.22 3 3v5.57c0 4.62-3.09 8.77-6.79 10.21C8.3 20.56 5.21 16.41 5.21 11.79V6.22l3-3Z" />
                </div>
              </div>

              <div className="profile-header__copy">
                <h1 className="profile-header__name">{therapist.fullName}</h1>
                <p className="profile-header__title">{therapist.professionalTitle}</p>

                {(therapist.phone || therapist.email) ? (
                  <div className="profile-header__actions">
                    {therapist.phone ? (
                      <a href={`tel:${therapist.phone}`} className="button button--ghost profile-header__action">
                        Anrufen
                      </a>
                    ) : null}
                    {therapist.email ? (
                      <a href={`mailto:${therapist.email}`} className="button button--ghost profile-header__action">
                        E-Mail
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="profile-meta-chips">
              <span className={`profile-meta-chip ${therapist.homeVisit ? 'profile-meta-chip--success' : ''}`}>
                <ProfileIcon className="profile-meta-chip__icon" path="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-9.5Z" />
                {therapist.homeVisit
                  ? `Hausbesuch${therapist.serviceRadiusKm ? ` bis ${therapist.serviceRadiusKm} km` : ''}`
                  : 'Kein Hausbesuch'}
              </span>
              {therapist.city ? (
                <span className="profile-meta-chip">
                  <ProfileIcon className="profile-meta-chip__icon" path="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Zm0-7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                  {therapist.city}
                </span>
              ) : null}
              {therapist.languages.length > 0 ? (
                <span className="profile-meta-chip">
                  <ProfileIcon className="profile-meta-chip__icon" path="M4 5h11a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9l-4 4v-4H7a3 3 0 0 1-3-3V5Z" />
                  {therapist.languages.map(langLabel).join(', ')}
                </span>
              ) : null}
              <span className="profile-meta-chip profile-meta-chip--muted">
                <ProfileIcon className="profile-meta-chip__icon" path="M3 7.5h18M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                {therapist.kassenart || 'Alle Kassen'}
              </span>
            </div>

            {(therapist.distKm != null || nextSlotLabel) ? (
              <div className="profile-inline-summary">
                {therapist.distKm != null ? (
                  <div className="profile-inline-summary__item">
                    <span className="profile-inline-summary__label">Entfernung</span>
                    <strong>{therapist.distKm.toFixed(1).replace('.', ',')} km</strong>
                  </div>
                ) : null}
                {nextSlotLabel ? (
                  <div className="profile-inline-summary__item">
                    <span className="profile-inline-summary__label">Naechster Termin</span>
                    <strong>{nextSlotLabel}</strong>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {(therapist.phone || therapist.email) ? (
            <div className="surface-card profile-contact-card">
              {therapist.phone ? (
                <a href={`tel:${therapist.phone}`} className="profile-contact-row">
                  <span className="profile-contact-row__icon">
                    <ProfileIcon path="M5.5 4.5h3l1.5 4-2 1.5a15.6 15.6 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2h-.5C10 20.5 3.5 14 3.5 6.5V6a2 2 0 0 1 2-1.5Z" />
                  </span>
                  <span className="profile-contact-row__body">
                    <span className="profile-contact-row__label">Telefon</span>
                    <span className="profile-contact-row__value">{therapist.phone}</span>
                  </span>
                  <span className="profile-contact-row__chevron">›</span>
                </a>
              ) : null}
              {therapist.email ? (
                <a href={`mailto:${therapist.email}`} className="profile-contact-row">
                  <span className="profile-contact-row__icon">
                    <ProfileIcon path="M4 6h16v12H4V6Zm0 1.5 8 5 8-5" />
                  </span>
                  <span className="profile-contact-row__body">
                    <span className="profile-contact-row__label">E-Mail</span>
                    <span className="profile-contact-row__value">{therapist.email}</span>
                  </span>
                  <span className="profile-contact-row__chevron">›</span>
                </a>
              ) : null}
            </div>
          ) : null}

          {therapist.bio ? (
            <div className="surface-card profile-copy-card">
              <p>{therapist.bio}</p>
            </div>
          ) : null}

          {(therapist.specializations.length > 0 || therapist.certifications.length > 0) ? (
            <div className="surface-card profile-details-card">
              {therapist.specializations.length > 0 ? (
                <section className="profile-details-card__section">
                  <h3>Spezialisierungen</h3>
                  <div className="profile-detail-chips">
                    {therapist.specializations.map((spec) => (
                      <span key={spec} className="profile-detail-chip">{spec}</span>
                    ))}
                  </div>
                </section>
              ) : null}

              {therapist.certifications.length > 0 ? (
                <section className="profile-details-card__section profile-details-card__section--bordered">
                  <h3>Fortbildungen</h3>
                  <div className="profile-detail-chips">
                    {therapist.certifications.map((cert) => (
                      <span key={cert} className="profile-detail-chip profile-detail-chip--accent">{cert}</span>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {therapist.practices.length > 0 ? (
            <div className="surface-card profile-practice-card">
              <div className="profile-card-heading">
                <h3>Praxen</h3>
                <p>Weitere Standorte und zugehoerige Praxen dieses Profils.</p>
              </div>
              <div className="profile-practice-list">
                {therapist.practices.map((practice) => (
                  <Link key={practice.id} href={`/praxis/${practice.id}`} className="profile-practice-link">
                    <span className="profile-practice-link__name">{practice.name}</span>
                    <span className="profile-practice-link__meta">{practice.city || 'Standort offen'}</span>
                    <span className="profile-practice-link__chevron">›</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="profile-app-cta-wrap">
            <AppOnlyCta
              title="App herunterladen, um einen Termin zu buchen"
              body="Um einen Termin zu buchen, musst du die Revio App herunterladen. Das Profil kannst du im Web ansehen, die Buchung laeuft ueber die App."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
