import { Section } from '../../components/section';

export const metadata = {
  title: 'Datenschutz',
  description: 'Informationen zur Verarbeitung personenbezogener Daten bei Revio.',
  robots: { index: false, follow: true },
};

export default function DatenschutzPage() {
  return (
    <Section
      eyebrow="Rechtliches"
      title="Datenschutz"
      body="Diese Datenschutzseite ist als MVP-Vorlage angelegt und muss vor dem Launch mit finalen Angaben ergänzt werden."
      className="section--legal"
    >
      <div className="legal-card">
        <p>
          Für den ersten Build der Präsentationsseite ist wichtig: keine unnötige Datenerhebung, keine versteckte Tracking-Komplexität und möglichst wenig Formularlogik.
        </p>
        <p>
          Vor dem öffentlichen Einsatz sollten mindestens folgende Punkte sauber ergänzt werden:
        </p>
        <ul className="legal-list">
          <li>Verantwortliche Stelle</li>
          <li>Art der verarbeiteten Daten</li>
          <li>Zweck der Verarbeitung</li>
          <li>Rechtsgrundlagen</li>
          <li>Speicherdauer</li>
          <li>Betroffenenrechte</li>
        </ul>
      </div>
    </Section>
  );
}
