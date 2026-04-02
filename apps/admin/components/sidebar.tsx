'use client';

import { usePathname, useRouter } from 'next/navigation';

const links = [
  { href: '/', label: 'Übersicht', icon: '◫' },
  { href: '/therapists', label: 'Therapeut:innen', icon: '◌' },
  { href: '/practices', label: 'Praxen', icon: '◪' },
  { href: '/links', label: 'Verknüpfungen', icon: '⇄' },
  { href: '/managers', label: 'Manager', icon: '◈' },
  { href: '/settings', label: 'Fortbildungen', icon: '☰' },
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
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

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
          <button
            key={link.href}
            type="button"
            className={`nav-link ${isActive(link.href) ? 'nav-link--active' : ''}`}
            onClick={() => {
              router.push(link.href);
              onNavigate?.();
            }}
          >
            <span className="nav-icon">{link.icon}</span>
            <span>{link.label}</span>
          </button>
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
