'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8l9 6 9-6" />
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>
  );
}

// Globale mobile Schnellnavigation für die öffentliche Website (≤720px, siehe
// globals.css). Ersetzt die frühere, nur im Homepage-Hero vorhandene
// hero-app-bottom-bar — jetzt im RootLayout gerendert und auf jeder
// öffentlichen Seite sichtbar. Der jeweils zur aktuellen Route passende
// Eintrag wird als „gefüllte" Pille hervorgehoben (gleiche Logik wie die
// fokussierte Kachel in apps/mobile CustomTabBar), ansonsten bleibt Suche als
// primäre Standardaktion gefüllt.
export function MobileBottomNav() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isSearchActive = pathname === '/finden';
  const isContactActive = pathname === '/contact';
  const searchVariant = isContactActive ? 'ghost' : 'primary';
  const contactVariant = isContactActive ? 'primary' : 'ghost';

  return (
    <nav className="mobile-bottom-nav" aria-label="Schnellnavigation">
      {isHome ? (
        // Auf der Startseite liegt das Suchformular im Hero außerhalb dieser
        // Leiste — ein externer Submit-Button sendet es trotzdem ab, sodass
        // Suchtext, Stadt und Filter erhalten bleiben.
        <button
          type="submit"
          form="hero-search-form"
          className={`mobile-bottom-nav__action mobile-bottom-nav__action--${searchVariant}`}
        >
          <SearchIcon />
          <span>Suche</span>
        </button>
      ) : (
        <Link
          href="/finden"
          className={`mobile-bottom-nav__action mobile-bottom-nav__action--${searchVariant}`}
          aria-current={isSearchActive ? 'page' : undefined}
        >
          <SearchIcon />
          <span>Suche</span>
        </Link>
      )}
      <Link
        href="/contact"
        className={`mobile-bottom-nav__action mobile-bottom-nav__action--${contactVariant}`}
        aria-current={isContactActive ? 'page' : undefined}
      >
        <ContactIcon />
        <span>Kontakt</span>
      </Link>
    </nav>
  );
}
