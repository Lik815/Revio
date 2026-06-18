import Image from 'next/image';
import Link from 'next/link';
import { Hero } from '../components/hero';
import { Section } from '../components/section';
import { getPublishedBlogPosts } from '../lib/blog';
import { homeHighlights, patientBenefits, showcaseScreens, therapistBenefits } from '../lib/content';

export default async function HomePage() {
  const blogPosts = await getPublishedBlogPosts();
  const latestPosts = blogPosts.slice(0, 3);

  return (
    <>
      <Hero
        eyebrow="Revio"
        title="Den richtigen Physio für dein Problem finden."
        body="Geprüfte Physiotherapeut:innen in deiner Nähe — nach Beschwerde, Spezialisierung und Verfügbarkeit."
        primaryHref="/patients"
        primaryLabel="Für Patient:innen"
        secondaryHref="/therapists"
        secondaryLabel="Für Therapeut:innen"
        searchPlaceholder="Wobei brauchst du Hilfe?"
        chips={['Rückenschmerzen', 'Kniereha', 'Sportphysiotherapie']}
      />

      <section className="app-showcase">
        <div className="shell">
          <div className="app-showcase__text">
            <div className="eyebrow">Die App</div>
            <h2>Physiotherapie — direkt gefunden.</h2>
            <p>Revio ist als App für iOS und Android verfügbar. Beschwerde eingeben, geprüfte Therapeut:innen in deiner Nähe finden, direkt anfragen.</p>
          </div>
          <div className="phone-row">
            {showcaseScreens.map((screen) => (
              <article key={screen.src} className={`showcase-card showcase-card--${screen.tone}`}>
                <div className={`phone-frame phone-frame--${screen.tone}`}>
                  <Image
                    src={screen.src}
                    alt={screen.alt}
                    width={1179}
                    height={2556}
                    sizes="(max-width: 720px) 82vw, (max-width: 1080px) 32vw, 260px"
                    className="showcase-image"
                  />
                </div>
                <div className="showcase-card__meta">
                  <h3>{screen.title}</h3>
                  <p>{screen.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Section
        eyebrow="So funktioniert Revio"
        title="In vier Schritten zum richtigen Therapeuten."
        body="Kein überladener Buchungsprozess. Revio bringt dich direkt dahin, wo es zählt: die richtige Therapie finden und unkompliziert anfragen."
      >
        <div className="flow-steps">
          {homeHighlights.map((item, i) => (
            <div key={item.title} className="flow-step">
              <span className="flow-step__num">{i + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Für Patient:innen"
        title="Passende Physiotherapie ohne Umwege"
        body="Ob Rückenschmerzen, Reha oder neurologische Beschwerden: Revio zeigt dir geprüfte Therapeut:innen nach Fachgebiet, Standort und freien Terminen."
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
              Mehr für Patient:innen
            </Link>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Für Therapeut:innen"
        title="Sichtbar werden. Professionell auftreten."
        body="Revio gibt Physiotherapeut:innen einen klaren, medizinisch glaubwürdigen digitalen Auftritt — und bringt sie mit Patient:innen zusammen, deren Beschwerden zur eigenen Expertise passen."
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
              Finde geprüfte Therapeut:innen nach Spezialisierung, Ort, Hausbesuch und freien Terminen — in einem Umfeld, das Expertise sichtbar macht statt zu überfordern.
            </p>
            <Link href="/therapists" className="button button--ghost" style={{ marginTop: 16 }}>
              Mehr für Therapeut:innen
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
