// Sprungmarken-Leiste für lange Anlage-Formulare (therapists/neu, practices/neu).
// Reine Anker-Links, kein Client-JS nötig — nur Orientierung, keine echte
// Sequenz, deshalb bewusst ohne 01/02/03-Nummerierung.
export function FormSectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  return (
    <nav className="form-nav" aria-label="Formularabschnitte">
      <div className="form-nav__label">Abschnitte</div>
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`}>{s.label}</a>
      ))}
    </nav>
  );
}
