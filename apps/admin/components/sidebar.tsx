'use client';

import { usePathname, useRouter } from 'next/navigation';

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const links = [
  { href: '/', label: 'Übersicht', icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { href: '/therapists', label: 'Therapeut:innen', icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z' },
  { href: '/feedback', label: 'Feedback', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { href: '/blog', label: 'Blog', icon: 'M4 19a2 2 0 0 1 2-2h14M6 17V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12M8 7h8M8 11h8M8 15h5' },
  { href: '/certifications', label: 'Fortbildungen', icon: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V4h16v13M4 19.5V21' },
  { href: '/specializations', label: 'Schwerpunkte', icon: 'M12 3v18M3 12h18M5.64 5.64l12.72 12.72M18.36 5.64L5.64 18.36' },
  { href: '/heilmittel', label: 'Heilmittel', icon: 'M9 3v4a2 2 0 0 1-2 2H3M21 9V5a2 2 0 0 0-2-2h-4M15 21v-4a2 2 0 0 1 2-2h4M3 15v4a2 2 0 0 0 2 2h4' },
  { href: '/settings', label: 'Einstellungen', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
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
        <img src="/logo.png" alt="Revio" style={{ width: 36, height: 36, borderRadius: 8 }} />
        <div>
          <div className="kicker">Revio</div>
          <h1 className="sidebar-title">Admin</h1>
          <p className="sidebar-copy">Prüfen, freigeben, ruhig bereinigen.</p>
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
            <span className="nav-icon"><Icon d={link.icon} /></span>
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
