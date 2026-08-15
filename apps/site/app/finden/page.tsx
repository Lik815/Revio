import type { Metadata } from 'next';
import { searchTherapists } from '../../lib/public-api';
import { FindSearchExperience } from '../../components/find-search-experience';

export const metadata: Metadata = {
  title: 'Physiotherapeuten finden',
  description: 'Suche Physiotherapeuten nach Beschwerde, Spezialisierung und Ort.',
};

type FindenSearchParams = {
  q?: string | string[];
  city?: string | string[];
  homeVisit?: string | string[];
  kassenart?: string | string[];
};

const ALLOWED_KASSENARTEN = new Set([
  'gesetzlich',
  'privat',
  'selbstzahler',
  'privat_selbstzahler',
]);

function firstParam(value: string | string[] | undefined, maxLength: number): string {
  const scalar = Array.isArray(value) ? value[0] : value;
  return typeof scalar === 'string' ? scalar.trim().slice(0, maxLength) : '';
}

export default async function FindenPage({
  searchParams,
}: {
  searchParams: Promise<FindenSearchParams>;
}) {
  const params = await searchParams;
  const query = firstParam(params.q, 120);
  const city = firstParam(params.city, 100);
  const homeVisit = firstParam(params.homeVisit, 8) === 'true';
  const requestedKassenart = firstParam(params.kassenart, 40);
  const kassenart = ALLOWED_KASSENARTEN.has(requestedKassenart) ? requestedKassenart : '';

  const { therapists, practices } = await searchTherapists({
    query: query || 'physiotherapie',
    city,
    homeVisit: homeVisit || undefined,
    kassenart: kassenart || undefined,
  });

  return (
    <section className="section section--search">
      <div className="shell find-page">
        <div className="section-heading find-page__heading">
          <div className="eyebrow">Suche</div>
          <h1>Physiotherapeuten finden</h1>
          <p className="section-copy">
            Suche nach Beschwerde, Spezialisierung und Standort.
          </p>
        </div>

        <FindSearchExperience
          initialTherapists={therapists}
          initialPractices={practices}
          defaultQuery={query}
          defaultCity={city}
          defaultHomeVisit={homeVisit}
          defaultKassenart={kassenart}
          defaultRadiusKm={5}
        />
      </div>
    </section>
  );
}
