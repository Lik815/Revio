import Link from 'next/link';
import type { PublicPractice } from '../lib/public-api';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function PracticeResultCard({ practice }: { practice: PublicPractice }) {
  return (
    <Link href={`/praxis/${practice.id}`} className="result-card">
      <div className="result-card__header">
        {practice.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={practice.logo} alt="" className="result-card__avatar" />
        ) : (
          <div className="result-card__avatar result-card__avatar--fallback">
            {initials(practice.name)}
          </div>
        )}
        <div className="result-card__identity">
          <h3>{practice.name}</h3>
          <p className="result-card__title">Praxis</p>
        </div>
      </div>

      <div className="result-card__footer">
        <span>{practice.city || 'Ort unbekannt'}</span>
        {practice.phone ? <span>{practice.phone}</span> : null}
      </div>
    </Link>
  );
}
