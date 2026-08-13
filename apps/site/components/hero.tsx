import Link from 'next/link';
import Image from 'next/image';
import { Brand } from './brand';
import { HeroSearchBar } from './hero-search-bar';
import { StoreBadges } from './store-badges';
import { HeroMap } from './hero-map';
import { HomeHeroScrollReveal } from './home-hero-scroll-reveal';
import type { PublicTherapist } from '../lib/public-api';

type HeroProps = {
  eyebrow?: string;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  hideImage?: boolean;
  searchPlaceholder?: string;
  chips?: string[];
  // Eigener Untertitel für die mobile App-Startseite (appHome). Optional —
  // ohne Angabe wird auf allen Breakpoints `body` verwendet.
  mobileBody?: string;
  mapTherapist?: PublicTherapist | null;
  // App-artige Startseite auf Mobil (≤720px, siehe globals.css): eigener
  // Logo-Kopf statt Site-Header, Hero füllt die Bildschirmhöhe, und eine
  // fixierte Bottom-Bar (Suche/Anmelden) ersetzt die normalen Hero-Actions
  // dort. Opt-in und bislang nur von der Startseite genutzt — andere
  // Hero-Seiten und Desktop bleiben unverändert.
  appHome?: boolean;
};

export function Hero({
  eyebrow,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  hideImage = false,
  searchPlaceholder,
  chips,
  mobileBody,
  mapTherapist,
  appHome = false,
}: HeroProps) {
  return (
    <section className={`hero${hideImage ? ' hero--no-image' : ''}${appHome ? ' hero--app-home' : ''}${mapTherapist ? ' hero--with-map' : ''}`}>
      {appHome ? <HomeHeroScrollReveal /> : null}
      <div className={`shell${!hideImage || mapTherapist ? ' hero__grid' : ''}`}>
        <div className="hero__copy">
          {appHome ? <Brand href="/" variant="header" className="hero__app-logo" priority /> : null}
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          <p className="hero__body">{body}</p>
          {appHome && mobileBody ? <p className="hero__body hero__body--app-home">{mobileBody}</p> : null}

          {searchPlaceholder ? <HeroSearchBar placeholder={searchPlaceholder} /> : null}

          {chips && chips.length > 0 ? (
            <div className="hero-chips">
              {chips.map((chip) => (
                <Link key={chip} href={`/finden?q=${encodeURIComponent(chip)}`} className="hero-chip">
                  {chip}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="hero__actions">
            <Link href={primaryHref} className="button button--primary">
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link href={secondaryHref} className="button button--ghost">
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>

        {!hideImage && !mapTherapist ? (
          <div className="hero-device">
            <div className="hero-device__stack">
              <Image
                src="/media/iphone17pro-orange-mockup.png"
                alt="Revio App auf einem Smartphone"
                width={1800}
                height={3660}
                className="hero-device__image"
                priority
              />
              <StoreBadges />
            </div>
          </div>
        ) : null}

        {mapTherapist ? <HeroMap therapist={mapTherapist} /> : null}
      </div>

      {appHome ? (
        <nav className="hero-app-bottom-bar" aria-label="Startseite Aktionen">
          <Link href="/finden" className="hero-app-bottom-bar__action hero-app-bottom-bar__action--primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Suche</span>
          </Link>
          <Link href="/contact" className="hero-app-bottom-bar__action hero-app-bottom-bar__action--ghost">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
            </svg>
            <span>Anmelden</span>
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
