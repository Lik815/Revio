import Link from 'next/link';
import { Hero } from '../components/hero';
import { Section } from '../components/section';
import { getPublishedBlogPosts } from '../lib/blog';
import { patientBenefits, therapistBenefits } from '../lib/content';
import { getSiteSettings } from '../lib/site-settings';
import { searchTherapists } from '../lib/public-api';

// Die Hero-Karte zeigt ein aktuelles, öffentliches Profil. Sie darf daher
// nicht mit einem einmaligen Build-Snapshot der Therapeut:innen-Liste leben.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [blogPosts, siteSettings, heroSearch] = await Promise.all([
    getPublishedBlogPosts(),
    getSiteSettings(),
    searchTherapists({ query: 'physiotherapie', city: 'Köln' }),
  ]);
  const latestPosts = blogPosts.slice(0, 3);
  const heroTherapist = heroSearch.therapists[0] ?? null;

  return (
    <>
      <Hero
        title="Den richtigen Physio für dein Problem finden."
        body="Physiotherapeuten in deiner Nähe — nach Beschwerde, Spezialisierung und Standort."
        mobileBody="Freiberufliche Physiotherapeut:innen in deiner Nähe – finde die passende Expertise für dein Anliegen."
        primaryHref="/patients"
        primaryLabel="Physio finden"
        secondaryHref="/therapists"
        secondaryLabel="Als Therapeut starten"
        searchPlaceholder="Wobei brauchst du Hilfe?"
        chips={['Rückenschmerzen', 'Kniereha', 'Sportphysiotherapie']}
        hideImage={!siteSettings.appBookingEnabled}
        mapTherapist={heroTherapist}
        appHome
      />

      <Section
        eyebrow="Physio finden"
        title="Passende Physiotherapie ohne Umwege"
        body="Ob Rückenschmerzen, Reha oder neurologische Beschwerden: Revio zeigt dir Therapeuten nach Fachgebiet, Standort und Behandlungsangebot."
      >
        <div className="split-panel">
          <div className="surface-card">
            <ul className="check-list">
              {patientBenefits.map((item) => (
                <li key={item.title}>{item.title}</li>
              ))}
            </ul>
          </div>
          <div className="surface-card surface-card--accent">
            <div className="eyebrow">Direkt & klar</div>
            <h3>Kein überladener Buchungsprozess</h3>
            <p>
              Beschwerde eingeben. Passende Physios finden. Direkt anfragen — ohne komplizierte Terminlogik oder zehn offene Tabs.
            </p>
            <Link href="/patients" className="button button--ghost" style={{ marginTop: 16 }}>
              Physio finden
            </Link>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Als Therapeut starten"
        title="Sichtbar werden. Professionell auftreten."
        body="Revio gibt Physiotherapeut:innen einen klaren, medizinisch glaubwürdigen digitalen Auftritt — und bringt sie mit Klient:innen zusammen, deren Beschwerden zur eigenen Expertise passen."
      >
        <div className="split-panel">
          <div className="surface-card surface-card--tall">
            <ul className="check-list">
              {therapistBenefits.map((item) => (
                <li key={item.title}>{item.title}</li>
              ))}
            </ul>
          </div>
          <div className="quote-card">
            <h3>Kein Marketplace-Lärm</h3>
            <p>
              Finde Therapeuten nach Spezialisierung, Ort, Hausbesuch und Behandlungsangebot — in einem Umfeld, das Expertise sichtbar macht statt zu überfordern.
            </p>
            <Link href="/therapists" className="button button--ghost" style={{ marginTop: 16 }}>
              Als Therapeut starten
            </Link>
          </div>
        </div>
      </Section>

      {latestPosts.length > 0 ? (
        <Section
          eyebrow="Blog"
          title="Aktuelles aus dem Revio Blog"
          body="Kurze, klare Texte zu moderner Physiotherapie, mobilem Arbeiten und dem Aufbau von Revio."
        >
          <div className="blog-grid">
            {latestPosts.map((post) => (
              <article key={post.id} className="blog-card">
                <div className="eyebrow">Neu</div>
                <h3>{post.title}</h3>
                <p className="blog-card__excerpt">{post.excerpt}</p>
                <Link href={`/blog/${post.slug}`} className="button button--ghost blog-card__link">
                  Beitrag lesen
                </Link>
              </article>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}
