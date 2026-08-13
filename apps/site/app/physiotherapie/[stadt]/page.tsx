import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { searchTherapists, getCitiesWithListings } from '../../../lib/public-api';
import { TherapistResultCard } from '../../../components/therapist-result-card';
import { PracticeResultCard } from '../../../components/practice-result-card';

// Directory-First-Refactor (R7): eine statische Seite pro Stadt mit echten
// Einträgen — kein Thin Content, keine spekulativen leeren Seiten für
// erfundene Städtenamen.
export async function generateStaticParams() {
  const cities = await getCitiesWithListings();
  return cities.map((stadt) => ({ stadt }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stadt: string }>;
}): Promise<Metadata> {
  const { stadt } = await params;
  const description = `Physiotherapeuten und Praxen in ${stadt} finden — nach Beschwerde, Spezialisierung und Standort.`;
  return {
    title: `Physiotherapie in ${stadt}`,
    description,
    alternates: { canonical: `/physiotherapie/${encodeURIComponent(stadt)}` },
    openGraph: { type: 'website', title: `Physiotherapie in ${stadt}`, description },
  };
}

export default async function StadtPage({ params }: { params: Promise<{ stadt: string }> }) {
  const { stadt } = await params;
  const cities = await getCitiesWithListings();
  if (!cities.some((c) => c.toLowerCase() === stadt.toLowerCase())) notFound();

  const { therapists, practices } = await searchTherapists({ query: 'physiotherapie', city: stadt });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      ...therapists.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Physician',
          name: t.fullName,
          address: { '@type': 'PostalAddress', addressLocality: stadt },
        },
      })),
      ...practices.map((p, i) => ({
        '@type': 'ListItem',
        position: therapists.length + i + 1,
        item: {
          '@type': 'LocalBusiness',
          name: p.name,
          address: { '@type': 'PostalAddress', addressLocality: p.city, streetAddress: p.address },
          telephone: p.phone,
        },
      })),
    ],
  };

  return (
    <section className="section section--search">
      <div className="shell">
        <div className="section-heading">
          <div className="eyebrow">Physiotherapie</div>
          <h1>Physiotherapeuten &amp; Praxen in {stadt}</h1>
          <p className="section-copy">
            {therapists.length + practices.length > 0
              ? `${therapists.length + practices.length} Profile in ${stadt}.`
              : `Noch keine Profile in ${stadt} — schau bald wieder vorbei.`}
          </p>
        </div>

        <p style={{ marginTop: 8 }}>
          <Link href={`/finden?city=${encodeURIComponent(stadt)}`} className="page-back-link">
            Nach Beschwerde in {stadt} suchen →
          </Link>
        </p>

        {therapists.length > 0 ? (
          <div className="result-grid" style={{ marginTop: 32 }}>
            {therapists.map((therapist) => (
              <TherapistResultCard key={therapist.id} therapist={therapist} />
            ))}
          </div>
        ) : null}

        {practices.length > 0 ? (
          <>
            <div className="section-heading" style={{ marginTop: 48 }}>
              <div className="eyebrow">Praxen</div>
              <h2>Praxen in {stadt}</h2>
            </div>
            <div className="result-grid">
              {practices.map((practice) => (
                <PracticeResultCard key={practice.id} practice={practice} />
              ))}
            </div>
          </>
        ) : null}

        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </div>
    </section>
  );
}
