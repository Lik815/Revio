'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Brand } from './brand';
import { siteConfig } from '../lib/content';

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Brand href="/" variant="header" priority />

        <nav className="site-nav" aria-label="Hauptnavigation">
          {siteConfig.nav.map((item) => (
            <Link key={item.href} href={item.href} className="site-nav__link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-header__actions">
          <Link href="/contact" className="button button--primary site-header__cta">
            Interesse anmelden
          </Link>
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
        </div>
      </div>

      {open && (
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
              Interesse anmelden
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
