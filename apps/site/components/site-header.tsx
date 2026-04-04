import Link from 'next/link';
import { Brand } from './brand';
import { siteConfig } from '../lib/content';

export function SiteHeader() {
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

        <Link href="/contact" className="button button--ghost site-header__cta">
          Interesse anmelden
        </Link>
      </div>
    </header>
  );
}
