'use client';

import { useEffect, useRef, useState } from 'react';

type HeroSearchBarProps = {
  placeholder: string;
};

async function reverseGeocodeCity(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=de`,
  );
  const data = await res.json();
  const addr = data?.address ?? {};
  return addr.city || addr.town || addr.village || addr.municipality || '';
}

// Only the location icon sits in the bar itself — tapping it opens a
// dropdown below where the city can be typed or detected. Mirrors the
// reverse-geocoding approach already used on mobile
// (apps/mobile/src/hooks/use-search.js).
export function HeroSearchBar({ placeholder }: HeroSearchBarProps) {
  const [city, setCity] = useState('');
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cityFieldRef = useRef<HTMLInputElement>(null);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const detected = await reverseGeocodeCity(position.coords.latitude, position.coords.longitude);
          if (detected) setCity(detected);
        } catch {
          // silent — manual entry still works
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Auto-fill only if permission was already granted in a previous visit —
  // never trigger a fresh permission prompt without an explicit click.
  useEffect(() => {
    if (city || !navigator.permissions || !navigator.geolocation) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (!cancelled && status.state === 'granted') detectLocation();
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    cityFieldRef.current?.focus();
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div className="hero-search-wrap" ref={wrapRef}>
      <form method="GET" action="/finden" className="hero-search">
        <span className="hero-search__icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          className="hero-search__input hero-search__input--query"
          name="q"
          placeholder={placeholder}
          aria-label="Beschwerden eingeben"
        />
        <input type="hidden" name="city" value={city} />
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); if (!city) detectLocation(); }}
          className={`hero-search__locate${city ? ' hero-search__locate--active' : ''}`}
          aria-label="Ort wählen"
          aria-expanded={open}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </button>
        <button type="submit" className="hero-search__filter" aria-label="Suchen">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>

      {open && (
        <div className="hero-search-dropdown">
          <label htmlFor="hero-city-field">In welcher Stadt?</label>
          <div className="hero-search-dropdown__row">
            <input
              ref={cityFieldRef}
              id="hero-city-field"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="z. B. Köln"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); setOpen(false); }
              }}
            />
            <button type="button" onClick={detectLocation} disabled={locating} aria-label="Standort verwenden" title="Standort verwenden">
              {locating ? (
                <svg className="hero-search-dropdown__spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
