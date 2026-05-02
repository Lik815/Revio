import Link from 'next/link';
import { Hero } from '../../components/hero';
import { Section } from '../../components/section';
import { profileIncludes, therapistBenefits } from '../../lib/content';

export default function TherapistsPage() {
  return (
    <>
      <Hero
        eyebrow="Für Therapeut:innen"
        title="Ein professionelles Profil für moderne Physiotherapie"
        body="Revio hilft Therapeut:innen, sichtbar zu werden und von passenden Patient:innen besser gefunden zu werden."
        primaryHref="/contact"
        primaryLabel="Interesse anmelden"
        secondaryHref="/about"
        secondaryLabel="Über Revio"
        hideImage
      />

      <Section
        eyebrow="Warum Revio"
        title="Sichtbarkeit ohne unnötige Komplexität"
        body="Der Fokus liegt auf einem hochwertigen Profil und einem klaren digitalen Auftritt, nicht auf einem überladenen Praxisbetriebssystem."
      >
        <div className="card-grid">
          {therapistBenefits.map((item) => (
            <article key={item.title} className="feature-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Profil"
        title="Was ein Revio-Profil zeigt"
        body="Das Profil soll nicht laut sein. Es soll einordnen, Vertrauen schaffen und medizinisch ernst genommen werden können."
      >
        <div className="split-panel">
          <div className="surface-card surface-card--tall">
            <ul className="check-list">
              {profileIncludes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="surface-card surface-card--accent">
            <div className="eyebrow">Für Freiberufler:innen</div>
            <h3>Klar auffindbar, ohne schweres Workflow-System</h3>
            <p>
              Gerade für freiberufliche Therapeut:innen ist ein klarer digitaler Auftritt wertvoll. Revio soll diese Sichtbarkeit stärken, ohne das Produkt unnötig aufzublähen.
            </p>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Kontakt"
        title="Früh dabei sein"
        body="Wenn du als Therapeut:in Interesse an Revio hast, freuen wir uns über deine Nachricht."
      >
        <div className="cta-banner">
          <div>
            <h3>Interesse an einem Profil auf Revio?</h3>
            <p>Wir sprechen gern über Sichtbarkeit, Positionierung und die richtige erste Version des Produkts.</p>
          </div>
          <div className="cta-banner__actions">
            <Link href="/contact" className="button button--primary">
              Interesse anmelden
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
