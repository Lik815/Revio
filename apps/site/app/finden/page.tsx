import type { Metadata } from 'next';
import { searchTherapists } from '../../lib/public-api';
import { SearchBar } from '../../components/search-bar';
import { TherapistResultCard } from '../../components/therapist-result-card';
import { PracticeResultCard } from '../../components/practice-result-card';

export const metadata: Metadata = {
  title: 'Physiotherapeuten finden',
  description: 'Suche geprüfte Physiotherapeuten nach Beschwerde, Spezialisierung und Ort.',
};

type FindenSearchParams = {
  q?: string;
  city?: string;
  homeVisit?: string;
  kassenart?: string;
};

export default async function FindenPage({
  searchParams,
}: {
  searchParams: Promise<FindenSearchParams>;
}) {
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const city = (params.city ?? '').trim();
  const homeVisit = params.homeVisit === 'true';
  const kassenart = (params.kassenart ?? '').trim();

  // The API requires a city (or geolocation, which the website doesn't
  // collect yet) — ask for it before calling /search at all.
  if (!city) {
    return (
      <section className="section section--search">
        <div className="shell">
          <div className="section-heading">
            <div className="eyebrow">Suche</div>
            <h1>Physiotherapeuten finden</h1>
            <p className="section-copy">
              Gib an, wobei du Hilfe brauchst und in welcher Stadt — wir zeigen dir geprüfte Therapeuten in deiner Nähe.
            </p>
          </div>
          <SearchBar defaultQuery={query} />
        </div>
      </section>
    );
  }

  const { therapists, practices } = await searchTherapists({
    query: query || 'physiotherapie',
    city,
    homeVisit: homeVisit || undefined,
    kassenart: kassenart || undefined,
  });

  return (
    <section className="section section--search">
      <div className="shell">
        <div className="section-heading">
          <div className="eyebrow">Suche</div>
          <h1>Physiotherapeuten finden</h1>
          <p className="section-copy">
            {therapists.length > 0
              ? `${therapists.length} ${therapists.length === 1 ? 'Therapeut' : 'Therapeuten'} in ${city}${query ? ` für „${query}“` : ''}.`
              : `Keine Treffer für „${query || 'Physiotherapie'}“ in ${city}.`}
          </p>
        </div>

        <SearchBar defaultQuery={query} defaultCity={city} defaultHomeVisit={homeVisit} defaultKassenart={kassenart} />

        {therapists.length === 0 ? (
          <div className="empty-blog-state" style={{ marginTop: 32 }}>
            <p>
              Keine passenden Profile gefunden. Versuch es mit einer allgemeineren Beschwerde oder einem anderen Ort.
            </p>
          </div>
        ) : (
          <div className="result-grid" style={{ marginTop: 32 }}>
            {therapists.map((therapist) => (
              <TherapistResultCard key={therapist.id} therapist={therapist} />
            ))}
          </div>
        )}

        {practices.length > 0 ? (
          <>
            <div className="section-heading" style={{ marginTop: 48 }}>
              <div className="eyebrow">Praxen</div>
              <h2>Praxen in {city}</h2>
            </div>
            <div className="result-grid">
              {practices.map((practice) => (
                <PracticeResultCard key={practice.id} practice={practice} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
