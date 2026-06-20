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

export function PublicTherapistProfile({ therapist }: { therapist: PublicTherapist }) {
  return (
    <section className="section section--profile">
      <div className="shell">
        <Link href="/finden" className="page-back-link">← Zurück zur Suche</Link>

        <div className="profile-header">
          {therapist.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={therapist.photo} alt={therapist.fullName} className="profile-header__avatar" />
          ) : (
            <div className="profile-header__avatar profile-header__avatar--fallback">
              {initials(therapist.fullName)}
            </div>
          )}
          <div>
            <div className="eyebrow">Geprüftes Profil</div>
            <h1 className="profile-header__name">{therapist.fullName}</h1>
            <p className="profile-header__title">{therapist.professionalTitle}</p>
          </div>
        </div>

        <div className="result-card__tags" style={{ marginTop: 20 }}>
          <span className="hero-chip">
            {therapist.homeVisit
              ? `Hausbesuch${therapist.serviceRadiusKm ? ` bis ${therapist.serviceRadiusKm} km` : ''}`
              : 'Kein Hausbesuch'}
          </span>
          {therapist.city ? <span className="hero-chip">{therapist.city}</span> : null}
          {therapist.languages.length > 0 ? (
            <span className="hero-chip">{therapist.languages.map(langLabel).join(', ')}</span>
          ) : null}
          <span className="hero-chip">{therapist.kassenart || 'Alle Kassen'}</span>
        </div>

        {therapist.phone || therapist.email ? (
          <div className="surface-card profile-contact" style={{ marginTop: 20 }}>
            {therapist.phone ? (
              <a href={`tel:${therapist.phone}`} className="profile-contact__row">{therapist.phone}</a>
            ) : null}
            {therapist.email ? (
              <a href={`mailto:${therapist.email}`} className="profile-contact__row">{therapist.email}</a>
            ) : null}
          </div>
        ) : null}

        {therapist.bio ? (
          <div className="surface-card" style={{ marginTop: 20 }}>
            <p>{therapist.bio}</p>
          </div>
        ) : null}

        {therapist.specializations.length > 0 ? (
          <div className="surface-card" style={{ marginTop: 20 }}>
            <h3>Spezialisierungen</h3>
            <div className="result-card__tags" style={{ marginTop: 12 }}>
              {therapist.specializations.map((spec) => (
                <span key={spec} className="hero-chip">{spec}</span>
              ))}
            </div>
          </div>
        ) : null}

        {therapist.certifications.length > 0 ? (
          <div className="surface-card" style={{ marginTop: 20 }}>
            <h3>Fortbildungen</h3>
            <div className="result-card__tags" style={{ marginTop: 12 }}>
              {therapist.certifications.map((cert) => (
                <span key={cert} className="hero-chip hero-chip--accent">{cert}</span>
              ))}
            </div>
          </div>
        ) : null}

        {therapist.practices.length > 0 ? (
          <div className="surface-card" style={{ marginTop: 20 }}>
            <h3>Praxis</h3>
            <div className="footer-links" style={{ marginTop: 12 }}>
              {therapist.practices.map((practice) => (
                <Link key={practice.id} href={`/praxis/${practice.id}`} className="footer-link">
                  {practice.name} — {practice.city}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 20 }}>
          <AppOnlyCta
            title="Terminbuchung aktuell nur in der Revio App"
            body="Lade die Revio App herunter, um direkt einen Termin bei dieser Praxis oder Therapeut:in anzufragen."
          />
        </div>
      </div>
    </section>
  );
}
