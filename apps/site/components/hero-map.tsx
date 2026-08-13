import Link from 'next/link';
import type { PublicTherapist } from '../lib/public-api';

type HeroMapProps = {
  therapist: PublicTherapist;
};

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * A deliberately lightweight map preview for the homepage. It is not a route
 * planner and therefore does not load a third-party map, cookies, or location
 * data. The real search remains available through the hero search bar.
 */
export function HeroMap({ therapist }: HeroMapProps) {
  const specializations = therapist.specializations.slice(0, 3);

  return (
    <aside className="hero-map" aria-label={`Profilvorschau von ${therapist.fullName}`}>
      <div className="hero-map__canvas" aria-hidden="true">
        <span className="hero-map__route hero-map__route--one" />
        <span className="hero-map__route hero-map__route--two" />
        <span className="hero-map__park hero-map__park--one" />
        <span className="hero-map__park hero-map__park--two" />
        <span className="hero-map__pin hero-map__pin--one" />
        <span className="hero-map__pin hero-map__pin--two" />
        <span className="hero-map__pin hero-map__pin--three" />
      </div>

      <article className="hero-profile-card">
        <div className="hero-profile-card__avatar" aria-hidden="true">{initials(therapist.fullName)}</div>
        <div className="hero-profile-card__content">
          <h2>{therapist.fullName}</h2>
          <p>{therapist.professionalTitle || 'Physiotherapeut:in'}</p>
          {specializations.length > 0 ? (
            <div className="hero-profile-card__tags">
              {specializations.map((specialization) => (
                <span key={specialization}>{specialization}</span>
              ))}
            </div>
          ) : null}
          <div className="hero-profile-card__footer">
            <span className="hero-profile-card__location">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {therapist.city || 'In deiner Nähe'}
            </span>
            <Link href={`/therapeut/${therapist.id}`} className="hero-profile-card__link">
              Profil ansehen
            </Link>
          </div>
        </div>
      </article>
    </aside>
  );
}
