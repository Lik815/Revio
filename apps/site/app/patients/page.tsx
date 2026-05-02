import Link from 'next/link';
import { Hero } from '../../components/hero';
import { Section } from '../../components/section';
import { patientBenefits } from '../../lib/content';

export default function PatientsPage() {
  return (
    <>
      <Hero
        eyebrow="Für Patient:innen"
        title="Passende Physiotherapie ohne Umwege finden"
        body="Revio hilft dabei, Physiotherapeut:innen nach Spezialisierung, Standort und Angebot klarer zu entdecken."
        primaryHref="/contact"
        primaryLabel="Kontakt aufnehmen"
        secondaryHref="/therapists"
        secondaryLabel="Therapeut:innen entdecken"
        hideImage
      />

      <Section
        eyebrow="Was Revio hilft"
        title="Worauf Patient:innen sich konzentrieren können"
        body="Die Website erklärt den Wert des Produkts, ohne einen künstlich komplexen Buchungsprozess zu versprechen."
      >
        <div className="card-grid">
          {patientBenefits.map((item) => (
            <article key={item.title} className="feature-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Das Produktversprechen"
        title="Nicht überladen. Sondern klar."
        body="Revio soll zunächst eine bessere Entscheidung und einen besseren Kontakt ermöglichen — nicht ein schweres Terminbetriebssystem imitieren."
      >
        <div className="split-panel">
          <div className="surface-card">
            <h3>Was Revio im MVP tut</h3>
            <ul className="check-list">
              <li>Therapeut:innen auffindbar machen</li>
              <li>Profile verständlich darstellen</li>
              <li>Kontakt und Orientierung vereinfachen</li>
            </ul>
          </div>
          <div className="surface-card">
            <h3>Was Revio im MVP bewusst nicht vorgibt</h3>
            <ul className="check-list">
              <li>Kein voller Doctolib-Ersatz</li>
              <li>Keine unnötig komplexe Terminlogik</li>
              <li>Kein unruhiges Marketplace-Erlebnis</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Nächster Schritt"
        title="Interesse an Revio?"
        body="Wenn du Revio für deine Suche interessant findest, freuen wir uns über deine Nachricht."
      >
        <div className="cta-banner">
          <div>
            <h3>Fragen oder frühes Interesse</h3>
            <p>Wir freuen uns über Hinweise aus echter Versorgungspraxis und echte Bedürfnisse auf Patient:innenseite.</p>
          </div>
          <div className="cta-banner__actions">
            <Link href="/contact" className="button button--primary">
              Nachricht senden
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
