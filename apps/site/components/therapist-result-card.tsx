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

export function TherapistResultCard({ therapist }: { therapist: PublicTherapist }) {
  const topSpecializations = therapist.specializations.slice(0, 3);

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
        {therapist.requestable ? <span className="result-card__badge">Direkt buchbar</span> : null}
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
