'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Brand } from './brand';
import { siteConfig } from '../lib/content';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <header className={`site-header${isHome ? ' site-header--compact' : ''}`}>
      <div className="shell site-header__inner">
        <Brand href="/" variant="header" priority />

        {!isHome ? (
          <nav className="site-nav" aria-label="Hauptnavigation">
            {siteConfig.nav.map((item) => (
              <Link key={item.href} href={item.href} className="site-nav__link">
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="site-header__actions">
          <Link href="/contact" className="button button--primary site-header__cta">
            Kontakt aufnehmen
          </Link>
          {!isHome ? (
            <button
              className="hamburger"
              aria-label="Menü öffnen"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <span className={`hamburger__bar ${open ? 'hamburger__bar--open-1' : ''}`} />
              <span className={`hamburger__bar ${open ? 'hamburger__bar--open-2' : ''}`} />
              <span className={`hamburger__bar ${open ? 'hamburger__bar--open-3' : ''}`} />
            </button>
          ) : null}
        </div>
      </div>

      {!isHome && open && (
        <div className="mobile-menu">
          <nav className="mobile-menu__nav">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="mobile-menu__link"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/contact" className="button button--primary mobile-menu__cta" onClick={() => setOpen(false)}>
              Kontakt aufnehmen
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
