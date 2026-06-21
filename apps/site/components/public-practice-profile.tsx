import Link from 'next/link';
import type { PublicPractice, PublicTherapist } from '../lib/public-api';
import { AppOnlyCta } from './app-only-cta';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function PublicPracticeProfile({
  practice,
  therapists,
}: {
  practice: PublicPractice;
  therapists: PublicTherapist[];
}) {
  return (
    <section className="section section--profile">
      <div className="shell">
        <Link href="/finden" className="page-back-link">← Zurück zur Suche</Link>

        <div className="profile-header">
          {practice.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={practice.logo} alt={practice.name} className="profile-header__avatar" />
          ) : (
            <div className="profile-header__avatar profile-header__avatar--fallback">
              {initials(practice.name)}
            </div>
          )}
          <div>
            <div className="eyebrow">Praxis</div>
            <h1 className="profile-header__name">{practice.name}</h1>
            <p className="profile-header__title">{practice.city}</p>
          </div>
        </div>

        {practice.address || practice.phone || practice.hours ? (
          <div className="surface-card profile-contact" style={{ marginTop: 20 }}>
            {practice.address ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practice.address)}`}
                target="_blank"
                rel="noreferrer"
                className="profile-contact__row"
              >
                {practice.address}
              </a>
            ) : null}
            {practice.phone ? (
              <a href={`tel:${practice.phone}`} className="profile-contact__row">{practice.phone}</a>
            ) : null}
            {practice.hours ? <p className="profile-contact__row">{practice.hours}</p> : null}
          </div>
        ) : null}

        {practice.photos && practice.photos.length > 0 ? (
          <div className="profile-photo-row" style={{ marginTop: 20 }}>
            {practice.photos.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="profile-photo-row__img" />
            ))}
          </div>
        ) : null}

        {practice.description ? (
          <div className="surface-card" style={{ marginTop: 20 }}>
            <h3>Über die Praxis</h3>
            <p style={{ marginTop: 8 }}>{practice.description}</p>
          </div>
        ) : null}

        <div className="surface-card" style={{ marginTop: 20 }}>
          <h3>Therapeuten ({therapists.length})</h3>
          {therapists.length === 0 ? (
            <p style={{ marginTop: 8 }}>Aktuell keine öffentlichen Profile in dieser Praxis.</p>
          ) : (
            <div className="footer-links" style={{ marginTop: 12 }}>
              {therapists.map((therapist) => (
                <Link key={therapist.id} href={`/therapeut/${therapist.id}`} className="footer-link">
                  {therapist.fullName} — {therapist.professionalTitle}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <AppOnlyCta
            title="Terminbuchung aktuell nur in der Revio App"
            body="Lade die Revio App herunter, um direkt einen Termin bei dieser Praxis anzufragen."
          />
        </div>
      </div>
    </section>
  );
}
