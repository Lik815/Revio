'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type SearchableOption = {
  value: string;
  label: string;
  sublabel?: string;
};

// Tippen-zum-Filtern statt langer <select>-Liste. Rendert selbst das
// verstecke Formularfeld (name=...) — Eltern-<form action={serverAction}>
// liest den Wert ganz normal über FormData.
export function SearchableSelect({
  name,
  placeholder,
  options,
  value,
  onChange,
}: {
  name: string;
  placeholder: string;
  options: SearchableOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Wert von außen geändert (z. B. Formular-Reset nach Redirect) → Anzeigetext nachziehen.
  useEffect(() => {
    setQuery(selected?.label ?? '');
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && query === selected.label)) return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q),
    );
  }, [query, options, selected]);

  function selectOption(o: SearchableOption) {
    onChange(o.value);
    setQuery(o.label);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault();
        selectOption(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="searchable-select">
      <input
        className="toolbar-input"
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Kurze Verzögerung, damit ein Klick auf eine Option vor dem
          // Schließen der Liste noch registriert wird.
          setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
      />
      <input type="hidden" name={name} value={value ?? ''} />
      {open ? (
        <ul className="searchable-select__list" role="listbox">
          {filtered.length === 0 ? (
            <li className="searchable-select__empty">Keine Treffer.</li>
          ) : (
            filtered.slice(0, 50).map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={`searchable-select__option${i === activeIndex ? ' searchable-select__option--active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => selectOption(o)}
              >
                <div>{o.label}</div>
                {o.sublabel ? <div className="searchable-select__option-sublabel">{o.sublabel}</div> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
