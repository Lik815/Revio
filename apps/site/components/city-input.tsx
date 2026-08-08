'use client';

import { useEffect, useRef, useState } from 'react';

type CityInputProps = {
  name: string;
  id?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  wrapperClassName?: string;
  inputClassName?: string;
  // Wenn true und das Feld leer ist, wird der Standort beim Mounten aktiv
  // erkannt (zeigt ggf. einmal den Browser-Prompt). Für die Suchseite /finden,
  // wo der Nutzer bereits Suchabsicht gezeigt hat. Auf der Startseite false.
  autoDetect?: boolean;
};

// City-genaue Genauigkeit reicht — kein GPS-Fix nötig. maximumAge akzeptiert eine
// bis zu 5 Min alte Position, damit die Erkennung nahezu sofort ist statt zu hängen.
const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 10000, maximumAge: 300_000 };

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
  autoDetect = false,
}: CityInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [locating, setLocating] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const detectLocation = (submitAfter = false) => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const city = await reverseGeocodeCity(position.coords.latitude, position.coords.longitude);
          if (city) {
            setValue(city);
            // Kam der Nutzer über einen Chip/Hero-Link (autoDetect) auf /finden
            // ohne Stadt, wird nach erfolgreicher Erkennung direkt gesucht, damit
            // Ergebnisse mit Standort erscheinen — ohne zusätzlichen Klick.
            if (submitAfter) setAutoSubmit(true);
          }
        } catch {
          // silent — manual entry still works
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      GEO_OPTIONS,
    );
  };

  useEffect(() => {
    if (value || !navigator.geolocation) return;

    // Suchseite (autoDetect): Standort aktiv erkennen. getCurrentPosition zeigt
    // bei Bedarf einmal den Prompt und funktioniert auch in Safari, wo
    // navigator.permissions.query({name:'geolocation'}) nicht verlässlich ist.
    if (autoDetect) {
      detectLocation(true);
      return;
    }

    // Startseite: nur automatisch füllen, wenn die Berechtigung bereits erteilt
    // wurde — kein frischer Prompt ohne Klick.
    if (!navigator.permissions) return;
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

  // Formular abschicken, sobald der automatisch erkannte Ort im (kontrollierten)
  // Feld steht — so submittet der Browser den aktuellen Wert, nicht den alten.
  useEffect(() => {
    if (!autoSubmit || !value) return;
    setAutoSubmit(false);
    const form = inputRef.current?.form;
    if (form) {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.submit();
    }
  }, [autoSubmit, value]);

  return (
    <span className={`city-input ${wrapperClassName}`}>
      <input
        ref={inputRef}
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
        onClick={() => detectLocation()}
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
