import { Section } from '../../components/section';

export default function ImpressumPage() {
  return (
    <Section
      eyebrow="Rechtliches"
      title="Impressum"
      body="Diese Seite ist bewusst als ausfüllbare Platzhalter-Vorlage angelegt. Bitte ersetze vor dem Livegang jeden Platzhalter durch deine echten Angaben."
      className="section--legal"
    >
      <div className="legal-card">
        <h3>Angaben gemäß § 5 DDG</h3>
        <p>
          Name / Firma: [Bitte eintragen]
          <br />
          Rechtsform: [Bitte eintragen]
          <br />
          Straße und Hausnummer: [Bitte eintragen]
          <br />
          PLZ und Ort: [Bitte eintragen]
          <br />
          Deutschland
        </p>

        <h3>Vertreten durch</h3>
        <p>
          Vertretungsberechtigte Person: [Bitte eintragen]
        </p>

        <h3>Kontakt</h3>
        <ul className="legal-list">
          <li>Telefon: [Bitte eintragen]</li>
          <li>E-Mail: revioclub.app@gmail.com</li>
        </ul>

        <h3>Registereintrag</h3>
        <p>
          Nur falls vorhanden:
        </p>
        <ul className="legal-list">
          <li>Registergericht: [Bitte eintragen]</li>
          <li>Registernummer: [Bitte eintragen]</li>
        </ul>

        <h3>Umsatzsteuer-ID</h3>
        <p>
          Nur falls vorhanden:
          <br />
          Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: [Bitte eintragen]
        </p>

        <h3>Inhaltlich verantwortlich</h3>
        <p>
          Nur falls relevant:
          <br />
          Name: [Bitte eintragen]
          <br />
          Anschrift: [Bitte eintragen]
        </p>

        <h3>Berufsrechtliche Angaben</h3>
        <p>
          Nur falls rechtlich erforderlich:
        </p>
        <ul className="legal-list">
          <li>Kammer / zuständige Aufsichtsbehörde: [Bitte eintragen]</li>
          <li>Gesetzliche Berufsbezeichnung: [Bitte eintragen]</li>
          <li>Staat der Verleihung: [Bitte eintragen]</li>
          <li>Berufsrechtliche Regelungen: [Bitte eintragen]</li>
        </ul>

        <p>
          Hinweis: Je nach tatsächlichem Geschäftsmodell können weitere Pflichtangaben nötig sein. Diese Vorlage ist nur als
          Platzhalterstruktur gedacht.
        </p>
      </div>
    </Section>
  );
}
