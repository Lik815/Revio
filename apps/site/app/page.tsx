import Link from 'next/link';
import { Hero } from '../components/hero';
import { RevioStory } from '../components/revio-story';
import { Section } from '../components/section';
import { getPublishedBlogPosts } from '../lib/blog';
import { patientBenefits, therapistBenefits } from '../lib/content';

export default async function HomePage() {
  const blogPosts = await getPublishedBlogPosts();
  const latestPosts = blogPosts.slice(0, 3);

  return (
    <>
      <Hero
        title="Den richtigen Physio für dein Problem finden."
        body="Geprüfte Physiotherapeuten in deiner Nähe — nach Beschwerde, Spezialisierung und Verfügbarkeit."
        primaryHref="/patients"
        primaryLabel="Für Patienten"
        secondaryHref="/therapists"
        secondaryLabel="Für Therapeuten"
        searchPlaceholder="Wobei brauchst du Hilfe?"
        chips={['Rückenschmerzen', 'Kniereha', 'Sportphysiotherapie']}
      />

      <RevioStory />

      <Section
        eyebrow="Für Patienten"
        title="Passende Physiotherapie ohne Umwege"
        body="Ob Rückenschmerzen, Reha oder neurologische Beschwerden: Revio zeigt dir geprüfte Therapeuten nach Fachgebiet, Standort und freien Terminen."
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
              Mehr für Patienten
            </Link>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Für Therapeuten"
        title="Sichtbar werden. Professionell auftreten."
        body="Revio gibt Physiotherapeuten einen klaren, medizinisch glaubwürdigen digitalen Auftritt — und bringt sie mit Patienten zusammen, deren Beschwerden zur eigenen Expertise passen."
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
              Finde geprüfte Therapeuten nach Spezialisierung, Ort, Hausbesuch und freien Terminen — in einem Umfeld, das Expertise sichtbar macht statt zu überfordern.
            </p>
            <Link href="/therapists" className="button button--ghost" style={{ marginTop: 16 }}>
              Mehr für Therapeuten
            </Link>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Jetzt loslegen"
        title="Revio nutzen oder dabei sein"
        body=""
      >
        <div className="cta-banner">
          <div>
            <h3>Interesse an Revio?</h3>
            <p>Wir bauen Revio Schritt für Schritt auf — als klare, vertrauenswürdige Plattform für moderne Physiotherapie.</p>
          </div>
          <div className="cta-banner__actions">
            <Link href="/contact" className="button button--primary">
              Kontakt aufnehmen
            </Link>
            <Link href="/about" className="button button--ghost">
              Über Revio
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
