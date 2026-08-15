import Link from 'next/link';
import type { PublicTherapist } from '../lib/public-api';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type TherapistResultCardProps = {
  therapist: PublicTherapist;
  variant?: 'default' | 'find';
};

const distanceFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 1,
});

export function TherapistResultCard({
  therapist,
  variant = 'default',
}: TherapistResultCardProps) {
  const topSpecializations = therapist.specializations.slice(0, 3);

  if (variant === 'find') {
    const hasDistance =
      typeof therapist.distKm === 'number' && Number.isFinite(therapist.distKm);
    const location = hasDistance
      ? `${distanceFormatter.format(therapist.distKm as number)} km entfernt`
      : therapist.city || 'Ort unbekannt';

    return (
      <Link
        href={`/therapeut/${therapist.id}`}
        className="result-card result-card--find"
      >
        <div className="result-card__find-avatar-wrap">
          {therapist.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={therapist.photo}
              alt=""
              className="result-card__avatar"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="result-card__avatar result-card__avatar--fallback" aria-hidden="true">
              {initials(therapist.fullName)}
            </div>
          )}
          {therapist.requestable ? (
            <span
              className="result-card__requestable"
              aria-hidden="true"
            />
          ) : null}
        </div>

        <div className="result-card__find-body">
          <h3>{therapist.fullName}</h3>
          <p className="result-card__title">{therapist.professionalTitle}</p>
          {therapist.requestable ? (
            <span className="sr-only">Terminanfrage möglich.</span>
          ) : null}
          <p className="result-card__find-location">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
              <circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <span>{location}</span>
          </p>
          {topSpecializations.length > 0 ? (
            <p className="result-card__find-specializations">
              {topSpecializations.join(', ')}
            </p>
          ) : null}
        </div>

        <svg
          className="result-card__chevron"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="m9 5 7 7-7 7"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </Link>
    );
  }

  return (
    <Link href={`/therapeut/${therapist.id}`} className="result-card">
      <div className="result-card__header">
        {therapist.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={therapist.photo} alt="" className="result-card__avatar" />
        ) : (
          <div className="result-card__avatar result-card__avatar--fallback">
            {initials(therapist.fullName)}
          </div>
        )}
        <div className="result-card__identity">
          <h3>{therapist.fullName}</h3>
          <p className="result-card__title">{therapist.professionalTitle}</p>
        </div>
      </div>

      {topSpecializations.length > 0 || therapist.homeVisit ? (
        <div className="result-card__tags">
          {therapist.homeVisit ? <span className="hero-chip">Hausbesuch</span> : null}
          {topSpecializations.map((spec) => (
            <span key={spec} className="hero-chip">{spec}</span>
          ))}
        </div>
      ) : null}

      <div className="result-card__footer">
        <span>{therapist.city || 'Ort unbekannt'}</span>
        {therapist.phone ? <span>{therapist.phone}</span> : null}
      </div>
    </Link>
  );
}
