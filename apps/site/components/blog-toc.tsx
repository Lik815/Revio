export type TocEntry = { id: string; text: string };

export function BlogToc({ entries }: { entries: TocEntry[] }) {
  if (entries.length < 3) return null;

  return (
    <nav className="blog-toc" aria-label="Inhaltsverzeichnis">
      <p className="blog-toc__label">Inhalt</p>
      <ol className="blog-toc__list">
        {entries.map((entry, i) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className="blog-toc__link">
              <span className="blog-toc__num">{i + 1}</span>
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
