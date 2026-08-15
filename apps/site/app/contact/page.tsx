import { ContactForm } from '../../components/contact-form';
import { siteConfig } from '../../lib/content';

export const metadata = {
  title: 'Kontakt',
  description: 'Fragen zu Revio oder Interesse an Physiotherapie? Schreib uns über das Kontaktformular.',
};

type ContactSearchParams = Promise<{ practiceId?: string; practiceName?: string }>;

export default async function ContactPage({
  searchParams,
}: {
  searchParams: ContactSearchParams;
}) {
  const params = await searchParams;
  // Directory-First-Refactor (R4): Vorbefüllte Opt-out-Anfrage von einer
  // unverifizierten Praxis-Profilseite — kein eigener Endpunkt, damit niemand
  // ohne Eigentümernachweis fremde Einträge sofort entfernen lassen kann.
  // Ein Mensch liest die Nachricht und entfernt den Eintrag manuell.
  const defaultMessage = params.practiceId
    ? `Ich möchte, dass die Praxis „${params.practiceName ?? ''}" (ID: ${params.practiceId}) aus dem Revio-Verzeichnis entfernt wird.`
    : undefined;

  return (
    // Dezente Eintritts-Animation nur auf Mobil (siehe globals.css) — greift
    // bei jedem Neu-Mount dieser Seite, also sowohl bei einem Klick auf
    // „Kontakt" in der MobileBottomNav als auch bei Browser-Vor/Zurück.
    <div className="page-enter-mobile contact-page">
      <div className="shell">
        <div className="contact-page__inner">
          <h1>Wie können wir helfen?</h1>
          <p className="contact-page__intro">
            Schreib uns kurz, worum es geht. Wir melden uns so schnell wie möglich.
          </p>

          <ContactForm defaultMessage={defaultMessage} />

          <p className="form-note contact-form__alt">
            Lieber direkt per E-Mail?{' '}
            <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
