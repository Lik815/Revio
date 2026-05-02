import Link from 'next/link';
import { Hero } from '../../components/hero';
import { Section } from '../../components/section';
import { principles } from '../../lib/content';

export default function AboutPage() {
  return (
    <>
      <Hero
        eyebrow="Über Revio"
        title="Warum es Revio gibt"
        body="Die Suche nach passender Physiotherapie ist oft unnötig unübersichtlich. Revio entsteht aus dem Anspruch, diesen Zugang klarer, vertrauenswürdiger und zugänglicher zu gestalten."
        primaryHref="/contact"
        primaryLabel="Kontakt"
        secondaryHref="/patients"
        secondaryLabel="Für Patient:innen"
        hideImage
      />

      <Section
        eyebrow="Haltung"
        title="Wofür Revio steht"
        body="Das Produkt soll nicht durch künstliche Komplexität wichtig wirken. Es soll die richtige Verbindung zwischen Bedarf und Expertise sichtbar machen."
      >
        <div className="card-grid">
          {principles.map((item) => (
            <article key={item} className="feature-card">
              <h3>{item}</h3>
              <p>Diese Richtung bestimmt sowohl das Produkt als auch die visuelle Sprache der Website.</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Entstehung"
        title="Wer hinter Revio steht"
        body="Revio entsteht als Einzelprojekt mit dem Anspruch, Physiotherapie in Deutschland klarer und zugänglicher zu machen. Der Ausgangspunkt: Die Suche nach einem passenden Therapeuten ist heute unnötig aufwändig — obwohl die Expertise vorhanden ist. Revio soll diese Lücke schließen, ohne dabei eine aufgeblähte Plattform zu werden."
      >
        <div className="cta-banner">
          <div>
            <h3>Interesse oder Fragen?</h3>
            <p>Wir freuen uns über Austausch — ob als Patient:in, Therapeut:in oder einfach Neugierige:r.</p>
          </div>
          <div className="cta-banner__actions">
            <Link href="/contact" className="button button--primary">
              Kontakt aufnehmen
            </Link>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Bewusst nicht"
        title="Kein Marktplatz. Kein Mini-Operationssystem."
        body="Revio soll im MVP keine aufgeblähte Plattform werden, sondern ein fokussierter Zugang zu besserer Orientierung und Kontaktaufnahme."
      >
        <div className="split-panel">
          <div className="surface-card">
            <h3>Was wir vermeiden</h3>
            <ul className="check-list">
              <li>überladene Workflow-Logik</li>
              <li>unnötig schwere Buchungsprozesse</li>
              <li>laut wirkende Marketplace-Muster</li>
            </ul>
          </div>
          <div className="surface-card">
            <h3>Was wichtig bleibt</h3>
            <ul className="check-list">
              <li>gute Auffindbarkeit</li>
              <li>klare Profile</li>
              <li>Vertrauen und medizinische Glaubwürdigkeit</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Kontakt"
        title="Interesse an Revio?"
        body="Ob als Patient:in, Therapeut:in oder mit allgemeiner Frage — wir freuen uns über Nachrichten."
      >
        <div className="cta-banner">
          <div>
            <h3>Direkt Kontakt aufnehmen</h3>
            <p>Wir sind offen für Feedback, Interesse und echte Geschichten aus der Versorgungspraxis.</p>
          </div>
          <div className="cta-banner__actions">
            <Link href="/contact" className="button button--primary">
              Nachricht senden
            </Link>
            <Link href="/patients" className="button button--ghost">
              Für Patient:innen
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
