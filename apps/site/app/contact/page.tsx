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
      />

      <Section
        eyebrow="Kontakt"
        title="Einfach und direkt"
        body="Für diese erste Website-Version bleibt der Kontakt bewusst leichtgewichtig. Das Formular bereitet eine E-Mail in deinem Standard-Mailprogramm vor."
      >
        <div className="contact-layout">
          <div className="surface-card">
            <div className="eyebrow">Direkter Kontakt</div>
            <h3>{siteConfig.contactEmail}</h3>
            <p>
              Diese Adresse ist zentral im Projekt hinterlegt und kann später leicht auf die endgültige Revio-Kontaktadresse umgestellt werden.
            </p>
          </div>

          <ContactForm contactEmail={siteConfig.contactEmail} />
        </div>
      </Section>
    </>
  );
}
