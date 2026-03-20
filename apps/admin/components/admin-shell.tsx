'use client';

import { ReactNode, useState } from 'react';
import { Sidebar } from './sidebar';

export function AdminShell({
  children,
  adminUser,
  onLogout,
  apiUnavailable = false,
}: {
  children: ReactNode;
  adminUser: { name: string; email: string; role: string };
  onLogout: () => Promise<void>;
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
        <Sidebar adminUser={adminUser} onLogout={onLogout} onNavigate={() => setMobileNavOpen(false)} />
      </div>

      <main className="main">
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
            <div className="mobile-topbar-title">Admin Control Center</div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
