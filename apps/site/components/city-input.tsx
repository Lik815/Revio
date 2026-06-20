'use client';

import { useEffect, useState } from 'react';

type CityInputProps = {
  name: string;
  id?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  wrapperClassName?: string;
  inputClassName?: string;
};

async function reverseGeocodeCity(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=de`,
  );
  const data = await res.json();
  const addr = data?.address ?? {};
  return addr.city || addr.town || addr.village || addr.municipality || '';
}

// Mirrors the reverse-geocoding approach already used on mobile
// (apps/mobile/src/hooks/use-search.js) so detected city names match.
export function CityInput({
  name,
  id,
  defaultValue = '',
  placeholder = 'Ort',
  required,
  wrapperClassName = '',
  inputClassName = '',
}: CityInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [locating, setLocating] = useState(false);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const city = await reverseGeocodeCity(position.coords.latitude, position.coords.longitude);
          if (city) setValue(city);
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

  useEffect(() => {
    // Only auto-fill if the field is still empty and permission was already
    // granted in a previous visit — never trigger a fresh permission prompt
    // without an explicit click.
    if (value || !navigator.permissions || !navigator.geolocation) return;
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

  return (
    <span className={`city-input ${wrapperClassName}`}>
      <input
        id={id}
        className={`city-input__input ${inputClassName}`}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={detectLocation}
        disabled={locating}
        className="city-input__locate"
        aria-label="Standort verwenden"
        title="Standort verwenden"
      >
        {locating ? (
          <svg className="city-input__spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        )}
      </button>
    </span>
  );
}
