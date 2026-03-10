import Link from 'next/link';

const links = [
  { href: '/', label: 'Übersicht' },
  { href: '/therapists', label: 'Therapeut:innen-Warteschlange' },
  { href: '/practices', label: 'Praxis-Warteschlange' },
  { href: '/links', label: 'Verknüpfungen' },
  { href: '/profiles', label: 'Alle Profile' },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div>
        <div className="kicker">Revio</div>
        <h1 style={{ margin: '8px 0 0', fontSize: '1.5rem' }}>Admin-Dashboard</h1>
        <p style={{ color: 'var(--muted)' }}>Interne Prüfoberfläche für Therapeut:innen, Praxen und Verknüpfungen.</p>
      </div>
      <nav>
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
