'use client';

import { useEffect, useRef, useState } from 'react';

type HeroSearchBarProps = {
  placeholder: string;
};

// Gleiche Werte wie die Filter auf /finden (components/search-bar.tsx) und in
// der App (apps/mobile/src/utils/app-utils.js kassenartOptions).
const KASSENARTEN = [
  { value: '', label: 'Alle' },
  { value: 'gesetzlich', label: 'Gesetzlich' },
  { value: 'privat', label: 'Privat' },
  { value: 'selbstzahler', label: 'Selbstzahler' },
];

async function reverseGeocodeCity(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=de`,
  );
  const data = await res.json();
  const addr = data?.address ?? {};
  return addr.city || addr.town || addr.village || addr.municipality || '';
}

// Ort und Filter sitzen als Icons in der Leiste; ein Tippen öffnet das jeweilige
// Panel darunter. Aufbau spiegelt die App-Suchleiste (apps/mobile
// DiscoverContent): Trennstrich, Ort mit Status-Punkt, Filter mit Anzahl-Badge.
// Reverse-Geocoding wie in apps/mobile/src/hooks/use-search.js.
export function HeroSearchBar({ placeholder }: HeroSearchBarProps) {
  const [city, setCity] = useState('');
  const [homeVisit, setHomeVisit] = useState(false);
  const [kassenart, setKassenart] = useState('');
  const [locating, setLocating] = useState(false);
  const [panel, setPanel] = useState<'location' | 'filters' | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cityFieldRef = useRef<HTMLInputElement>(null);

  const activeFilterCount = (homeVisit ? 1 : 0) + (kassenart ? 1 : 0);

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
      // City-genaue Genauigkeit reicht; maximumAge macht die Erkennung nahezu sofort.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300_000 },
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
    if (!panel) return;
    if (panel === 'location') cityFieldRef.current?.focus();
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPanel(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [panel]);

  return (
    <div className="hero-search-wrap" ref={wrapRef}>
      <form method="GET" action="/finden" className="hero-search" id="hero-search-form">
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

        {/* Panel-Werte immer mitschicken, auch wenn das Panel zu ist */}
        <input type="hidden" name="city" value={city} />
        {homeVisit && <input type="hidden" name="homeVisit" value="true" />}
        {kassenart && <input type="hidden" name="kassenart" value={kassenart} />}

        <span className="hero-search__divider" aria-hidden="true" />

        <div className="hero-search__tools">
          <button
            type="button"
            onClick={() => {
              setPanel((p) => (p === 'location' ? null : 'location'));
              if (!city) detectLocation();
            }}
            className={`hero-search__tool${city ? ' hero-search__tool--active' : ''}`}
            aria-label="Ort wählen"
            aria-expanded={panel === 'location'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {city && <span className="hero-search__dot" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'filters' ? null : 'filters'))}
            className={`hero-search__tool${activeFilterCount > 0 ? ' hero-search__tool--active' : ''}`}
            aria-label="Filter"
            aria-expanded={panel === 'filters'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="7" x2="21" y2="7" />
              <circle cx="9" cy="7" r="2.4" />
              <line x1="3" y1="17" x2="21" y2="17" />
              <circle cx="15" cy="17" r="2.4" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="hero-search__badge">{activeFilterCount}</span>
            )}
          </button>

          <button type="submit" className="hero-search__submit" aria-label="Suchen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </form>

      {panel === 'location' && (
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
                if (e.key === 'Enter') { e.preventDefault(); setPanel(null); }
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

      {panel === 'filters' && (
        <div className="hero-search-dropdown">
          <label htmlFor="hero-kassenart-field">Filter</label>
          <label className="hero-search-filter__check">
            <input
              type="checkbox"
              checked={homeVisit}
              onChange={(e) => setHomeVisit(e.target.checked)}
            />
            <span>Hausbesuch möglich</span>
          </label>
          <div className="hero-search-filter__select">
            <span>Kassenart</span>
            <select
              id="hero-kassenart-field"
              value={kassenart}
              onChange={(e) => setKassenart(e.target.value)}
            >
              {KASSENARTEN.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="hero-search-filter__reset"
              onClick={() => { setHomeVisit(false); setKassenart(''); }}
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
