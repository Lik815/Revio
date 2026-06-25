'use client';

import { ReactNode, useState } from 'react';
import { Sidebar } from './sidebar';

export function AdminShell({
  children,
  adminUser,
  apiUnavailable = false,
}: {
  children: ReactNode;
  adminUser: { name: string; email: string; role: string };
  apiUnavailable?: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className={`layout ${mobileNavOpen ? 'layout--nav-open' : ''}`}>
      <div
        className={`mobile-backdrop ${mobileNavOpen ? 'mobile-backdrop--open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
      />

      <div className={`sidebar-wrap ${mobileNavOpen ? 'sidebar-wrap--open' : ''}`}>
        <Sidebar adminUser={adminUser} onNavigate={() => setMobileNavOpen(false)} />
      </div>

      <main className="main">
        <div className="desktop-commandbar">
          <div>
            <div className="command-eyebrow">
              <span className="command-live-dot" />
              Admin Bereich
            </div>
            <div className="command-title">Revio Verwaltung</div>
          </div>
          <div className="command-search" aria-hidden="true">
            <span>Suche, Profile, Einstellungen</span>
            <kbd>/</kbd>
          </div>
          <div className="command-user">
            <span>{adminUser.name.slice(0, 1)}</span>
            <div>
              <strong>{adminUser.name}</strong>
              <small>{adminUser.role}</small>
            </div>
          </div>
        </div>

        {apiUnavailable ? (
          <div className="status-banner status-banner--warning">
            Die Admin-API ist aktuell nicht erreichbar. Inhalte koennen unvollstaendig sein, bis die Verbindung wieder steht.
          </div>
        ) : null}
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileNavOpen((value) => !value)}
            aria-label="Menü öffnen"
          >
            ☰
          </button>
          <div>
            <div className="kicker">Revio</div>
            <div className="mobile-topbar-title">Admin</div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
