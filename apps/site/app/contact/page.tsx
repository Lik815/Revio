import { ContactForm } from '../../components/contact-form';
import { Hero } from '../../components/hero';
import { Section } from '../../components/section';
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
    <>
      <Hero
        eyebrow="Kontakt"
        title="Interesse an Revio"
        body="Ob du Physiotherapie suchst oder therapeutisch arbeitest: Wir freuen uns über Interesse und Austausch."
        primaryHref={`mailto:${siteConfig.contactEmail}`}
        primaryLabel="Direkt per E-Mail"
        secondaryHref="/about"
        secondaryLabel="Mehr erfahren"
        hideImage
      />

      <Section
        eyebrow="Kontakt"
        title="Einfach und direkt"
        body="Stell uns eine Frage, meld dein Interesse an oder teile uns deine Erfahrung mit."
      >
        <div className="contact-layout">
          <div className="surface-card">
            <div className="eyebrow">Direkter Kontakt</div>
            <h3>{siteConfig.contactEmail}</h3>
            <p>
              Du erreichst uns auch direkt per E-Mail — wir antworten so schnell wie möglich.
            </p>
          </div>

          <ContactForm defaultMessage={defaultMessage} />
        </div>
      </Section>
    </>
  );
}
