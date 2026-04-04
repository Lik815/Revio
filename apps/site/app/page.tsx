import Image from 'next/image';
import Link from 'next/link';
import { Hero } from '../components/hero';
import { Section } from '../components/section';
import { homeHighlights, patientBenefits, showcaseScreens, therapistBenefits } from '../lib/content';

export default function HomePage() {
  return (
    <>
      <Hero
        eyebrow="Revio"
        title="Die passende Physiotherapie finden."
        body="Revio hilft Patient:innen, passende Physiotherapeut:innen klarer, ruhiger und vertrauenswürdiger zu entdecken."
        primaryHref="/patients"
        primaryLabel="Für Patient:innen"
        secondaryHref="/therapists"
        secondaryLabel="Für Therapeut:innen"
      />

      <section className="app-showcase">
        <div className="shell">
          <div className="app-showcase__text">
            <div className="eyebrow">Die App</div>
            <h2>Physiotherapie — einfach gefunden.</h2>
            <p>Revio ist als App für iOS und Android verfügbar. Suche nach Beschwerde, finde geprüfte Therapeut:innen in deiner Nähe und nimm direkt Kontakt auf.</p>
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
        title="Weniger suchen. Besser einordnen. Klarer Kontakt aufnehmen."
        body="Revio konzentriert sich auf den entscheidenden Teil: die passende physiotherapeutische Verbindung sichtbar und verständlich zu machen."
      >
        <div className="card-grid">
          {homeHighlights.map((item) => (
            <article key={item.title} className="feature-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Für Patient:innen"
        title="Passende Physiotherapie ohne Umwege finden"
        body="Ob Rückenschmerzen, Reha oder neurologische Beschwerden: Revio hilft dabei, Physiotherapeut:innen klarer nach Fachgebiet, Standort und Angebot zu entdecken."
      >
        <div className="split-panel">
          <div className="surface-card">
            <ul className="check-list">
              {patientBenefits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="surface-card surface-card--accent">
            <div className="eyebrow">Wichtig</div>
            <h3>Kein überladener Buchungsprozess</h3>
            <p>
              Im Mittelpunkt steht im MVP nicht komplizierte Terminlogik, sondern die richtige fachliche Wahl und ein klarer Kontaktweg.
            </p>
            <Link href="/patients" className="button button--ghost">
              Mehr für Patient:innen
            </Link>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Für Therapeut:innen"
        title="Sichtbar werden. Professionell auftreten."
        body="Revio schafft einen hochwertigen digitalen Rahmen für Physiotherapeut:innen, die klarer gefunden und besser eingeordnet werden möchten."
      >
        <div className="split-panel">
          <div className="surface-card surface-card--tall">
            <ul className="check-list">
              {therapistBenefits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="quote-card">
            <p>
              Ein gutes Profil soll nicht wie ein Marketplace-Eintrag wirken, sondern wie ein hochwertiger, medizinisch glaubwürdiger Auftritt.
            </p>
            <Link href="/therapists" className="button button--ghost">
              Mehr für Therapeut:innen
            </Link>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Vertrauen"
        title="Ruhig, hochwertig und medizinisch glaubwürdig"
        body="Revio ist bewusst reduziert gedacht: klare Profile, verständliche Informationen und ein Produkt, das Vertrauen schafft statt zu überfordern."
      >
        <div className="cta-banner">
          <div>
            <h3>Interesse an Revio?</h3>
            <p>Wir bauen Revio Schritt für Schritt zu einem hochwertigen Zugang für moderne Physiotherapie auf.</p>
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
    </>
  );
}
