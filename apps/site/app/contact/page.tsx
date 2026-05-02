import { ContactForm } from '../../components/contact-form';
import { Hero } from '../../components/hero';
import { Section } from '../../components/section';
import { siteConfig } from '../../lib/content';

export default function ContactPage() {
  return (
    <>
      <Hero
        eyebrow="Kontakt"
        title="Interesse an Revio"
        body="Ob als Patient:in oder Therapeut:in: Wir freuen uns über Interesse und Austausch."
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

          <ContactForm />
        </div>
      </Section>
    </>
  );
}
