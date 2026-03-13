'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Übersicht', icon: '◫' },
  { href: '/therapists', label: 'Therapeut:innen', icon: '◌' },
  { href: '/practices', label: 'Praxen', icon: '◪' },
  { href: '/links', label: 'Verknüpfungen', icon: '⇄' },
  { href: '/profiles', label: 'Profile', icon: '⌕' },
];

export function Sidebar({
  adminUser,
  onLogout,
  onNavigate,
}: {
  adminUser: { name: string; email: string; role: string };
  onLogout: () => Promise<void>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand-mark">R</div>
        <div>
          <div className="kicker">Revio</div>
          <h1 className="sidebar-title">Control Center</h1>
          <p className="sidebar-copy">Moderation, Freigaben und Qualitätssicherung in einer Oberfläche.</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${pathname === link.href ? 'nav-link--active' : ''}`}
            onClick={onNavigate}
          >
            <span className="nav-icon">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="admin-card">
          <div className="admin-avatar">{adminUser.name.slice(0, 1)}</div>
          <div>
            <div className="admin-name">{adminUser.name}</div>
            <div className="admin-meta">{adminUser.role} · {adminUser.email}</div>
          </div>
        </div>
        <form action={onLogout}>
          <button className="logout-btn" type="submit">Abmelden</button>
        </form>
      </div>
    </aside>
  );
}
