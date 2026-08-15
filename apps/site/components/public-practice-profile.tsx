import Link from 'next/link';
import type { PublicPractice, PublicTherapist } from '../lib/public-api';
import { AppOnlyCta } from './app-only-cta';
import { TherapistResultCard } from './therapist-result-card';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function ProfileIcon({ path, className }: { path: string; className?: string }) {
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

// Anzeige-Adresse aus den Einzelfeldern, mit dem kombinierten Legacy-String als
// Rückfallebene. Dieselbe Zeichenkette dient als Kartensuchbegriff.
function formatAddress(practice: PublicPractice): string | null {
  const streetLine = [practice.street, practice.houseNumber].filter(Boolean).join(' ').trim();
  const cityLine = [practice.postalCode, practice.city].filter(Boolean).join(' ').trim();
  const composed = [streetLine, cityLine].filter(Boolean).join(', ');
  return composed || practice.address || null;
}

function normalizeWebsite(website?: string) {
  if (!website) return null;
  const href = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  return { href, label: website.replace(/^https?:\/\//i, '').replace(/\/$/, '') };
}

const THERAPISTS_ANCHOR = 'therapeutinnen';

export function PublicPracticeProfile({
  practice,
  therapists,
  appBookingEnabled = false,
}: {
  practice: PublicPractice;
  therapists: PublicTherapist[];
  appBookingEnabled?: boolean;
}) {
  const address = formatAddress(practice);
  const mapUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${practice.name}, ${address}`)}`
    : null;
  const website = normalizeWebsite(practice.website);
  const amenities = [
    practice.wheelchairAccessible ? 'Barrierefrei' : null,
    practice.parkingAvailable ? 'Parkplatz vorhanden' : null,
    practice.homeVisit ? 'Hausbesuche möglich' : null,
  ].filter(Boolean) as string[];

  return (
    <section className="section section--profile">
      <div className="shell">
        <Link href="/finden" className="page-back-link">← Zurück zur Suche</Link>

        <div className="profile-stack">
          <div className="surface-card profile-hero">
            <div className="profile-hero__topbar">
              <div className="eyebrow">{practice.verified ? 'Geprüfte Praxis' : 'Praxis'}</div>
              {therapists.length > 0 ? (
                <span className="profile-status-badge">
                  {therapists.length === 1 ? '1 Therapeut:in' : `${therapists.length} Therapeut:innen`}
                </span>
              ) : null}
            </div>

            <div className="profile-header">
              <div className="profile-header__avatar-wrap">
                {practice.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={practice.logo} alt={practice.name} className="profile-header__avatar" />
                ) : (
                  <div className="profile-header__avatar profile-header__avatar--fallback">
                    {initials(practice.name)}
                  </div>
                )}
                {/* Verifizierungs-Badge nur bei APPROVED — gelistete Praxen
                    bekommen bewusst kein Vertrauenssignal. */}
                {practice.verified ? (
                  <div className="profile-header__verified">
                    <ProfileIcon path="M9 12.75 11.25 15 15 9.75M8.21 3.22 12 2l3.79 1.22 3 3v5.57c0 4.62-3.09 8.77-6.79 10.21C8.3 20.56 5.21 16.41 5.21 11.79V6.22l3-3Z" />
                  </div>
                ) : null}
              </div>

              <div className="profile-header__copy">
                <h1 className="profile-header__name">{practice.name}</h1>
                <p className="profile-header__title">{address ?? practice.city}</p>

                <div className="profile-header__actions">
                  {/* Gebucht wird immer bei einzelnen Therapeut:innen, nie bei
                      der Praxis — der CTA führt deshalb zur Therapeut:innenliste. */}
                  {therapists.length > 0 ? (
                    <a href={`#${THERAPISTS_ANCHOR}`} className="button button--ghost profile-header__action">
                      Therapeut:in auswählen
                    </a>
                  ) : null}
                  {practice.phone ? (
                    <a href={`tel:${practice.phone}`} className="button button--ghost profile-header__action">
                      Anrufen
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            {amenities.length > 0 ? (
              <div className="profile-meta-chips">
                {practice.wheelchairAccessible ? (
                  <span className="profile-meta-chip profile-meta-chip--success">
                    <ProfileIcon className="profile-meta-chip__icon" path="M12 6.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Zm-1.5 2v5h4l2.5 5M10.5 11a4.5 4.5 0 1 0 4 6.5" />
                    Barrierefrei
                  </span>
                ) : null}
                {practice.parkingAvailable ? (
                  <span className="profile-meta-chip">
                    <ProfileIcon className="profile-meta-chip__icon" path="M9 18V6h3.5a3.5 3.5 0 0 1 0 7H9" />
                    Parkplatz
                  </span>
                ) : null}
                {practice.homeVisit ? (
                  <span className="profile-meta-chip">
                    <ProfileIcon className="profile-meta-chip__icon" path="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-9.5Z" />
                    Hausbesuche
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {!practice.verified ? (
            <div className="surface-card" style={{ fontSize: 14 }}>
              <p style={{ margin: 0 }}>
                Dieses Profil ist gelistet, aber noch nicht verifiziert.{' '}
                {!practice.claimed ? (
                  <>
                    Ist das deine Praxis?{' '}
                    <Link href={`/uebernehmen/${practice.id}`} className="page-back-link" style={{ display: 'inline' }}>
                      Jetzt übernehmen
                    </Link>{' '}
                    — oder{' '}
                  </>
                ) : null}
                stimmen die Daten nicht?{' '}
                <Link
                  href={`/contact?practiceId=${encodeURIComponent(practice.id)}&practiceName=${encodeURIComponent(practice.name)}`}
                  className="page-back-link"
                  style={{ display: 'inline' }}
                >
                  Eintrag entfernen lassen
                </Link>
              </p>
            </div>
          ) : null}

          {address || practice.phone || practice.email || website || practice.hours ? (
            <div className="surface-card profile-contact-card">
              {address ? (
                <a href={mapUrl ?? '#'} target="_blank" rel="noreferrer" className="profile-contact-row">
                  <span className="profile-contact-row__icon">
                    <ProfileIcon path="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Zm0-7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                  </span>
                  <span className="profile-contact-row__body">
                    <span className="profile-contact-row__label">Adresse</span>
                    <span className="profile-contact-row__value">{address}</span>
                  </span>
                  <span className="profile-contact-row__chevron">›</span>
                </a>
              ) : null}
              {practice.phone ? (
                <a href={`tel:${practice.phone}`} className="profile-contact-row">
                  <span className="profile-contact-row__icon">
                    <ProfileIcon path="M5.5 4.5h3l1.5 4-2 1.5a15.6 15.6 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2h-.5C10 20.5 3.5 14 3.5 6.5V6a2 2 0 0 1 2-1.5Z" />
                  </span>
                  <span className="profile-contact-row__body">
                    <span className="profile-contact-row__label">Telefon</span>
                    <span className="profile-contact-row__value">{practice.phone}</span>
                  </span>
                  <span className="profile-contact-row__chevron">›</span>
                </a>
              ) : null}
              {practice.email ? (
                <a href={`mailto:${practice.email}`} className="profile-contact-row">
                  <span className="profile-contact-row__icon">
                    <ProfileIcon path="M4 6h16v12H4V6Zm0 1.5 8 5 8-5" />
                  </span>
                  <span className="profile-contact-row__body">
                    <span className="profile-contact-row__label">E-Mail</span>
                    <span className="profile-contact-row__value">{practice.email}</span>
                  </span>
                  <span className="profile-contact-row__chevron">›</span>
                </a>
              ) : null}
              {website ? (
                <a href={website.href} target="_blank" rel="noreferrer noopener" className="profile-contact-row">
                  <span className="profile-contact-row__icon">
                    <ProfileIcon path="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.4 3.75-5.4 3.75-9S14.5 5.4 12 3c-2.5 2.4-3.75 5.4-3.75 9S9.5 18.6 12 21ZM3.5 9h17M3.5 15h17" />
                  </span>
                  <span className="profile-contact-row__body">
                    <span className="profile-contact-row__label">Website</span>
                    <span className="profile-contact-row__value">{website.label}</span>
                  </span>
                  <span className="profile-contact-row__chevron">›</span>
                </a>
              ) : null}
              {practice.hours ? (
                <div className="profile-contact-row">
                  <span className="profile-contact-row__icon">
                    <ProfileIcon path="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2" />
                  </span>
                  <span className="profile-contact-row__body">
                    <span className="profile-contact-row__label">Öffnungszeiten</span>
                    <span className="profile-contact-row__value">{practice.hours}</span>
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {practice.photos && practice.photos.length > 0 ? (
            <div className="profile-photo-row">
              {practice.photos.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" className="profile-photo-row__img" />
              ))}
            </div>
          ) : null}

          {practice.description ? (
            <div className="surface-card profile-copy-card">
              <p>{practice.description}</p>
            </div>
          ) : null}

          {practice.publicTransportNote ? (
            <div className="surface-card profile-details-card">
              <section className="profile-details-card__section">
                <h3>Anfahrt</h3>
                <p style={{ marginTop: 8 }}>{practice.publicTransportNote}</p>
              </section>
            </div>
          ) : null}

          <div className="surface-card profile-practice-card" id={THERAPISTS_ANCHOR}>
            <div className="profile-card-heading">
              <h3>Therapeut:innen</h3>
              <p>
                Termine werden immer bei einzelnen Therapeut:innen vereinbart — wähle ein Profil, um
                fortzufahren.
              </p>
            </div>
            {therapists.length === 0 ? (
              <p style={{ marginTop: 8 }}>Aktuell keine öffentlichen Profile in dieser Praxis.</p>
            ) : (
              <div className="result-grid" style={{ marginTop: 12 }}>
                {therapists.map((therapist) => (
                  <TherapistResultCard key={therapist.id} therapist={therapist} />
                ))}
              </div>
            )}
          </div>

          {appBookingEnabled ? (
            <div className="profile-app-cta-wrap">
              <AppOnlyCta
                title="App herunterladen, um einen Termin zu buchen"
                body="Um einen Termin bei dieser Praxis zu buchen, musst du die Revio App herunterladen."
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
