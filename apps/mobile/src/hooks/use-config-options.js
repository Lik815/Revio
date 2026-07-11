import { useEffect, useState } from 'react';
import {
  fortbildungOptions,
  getBaseUrl,
  regSpecOptions,
  TUNNEL_HEADERS,
} from '../utils/app-utils';
import { timedFetch } from '../utils/perf-log';

function normalizeOptions(options, fallback) {
  const source = Array.isArray(options) && options.length > 0 ? options : fallback;
  const seen = new Set();

  return source
    .map((option) => {
      if (typeof option === 'string') {
        const value = option.trim();
        return value ? { key: value, label: value } : null;
      }
      const key = typeof option?.key === 'string' ? option.key.trim() : '';
      const label = typeof option?.label === 'string' ? option.label.trim() : '';
      return key && label ? { key, label } : null;
    })
    .filter((option) => {
      if (!option || seen.has(option.key)) return false;
      seen.add(option.key);
      return true;
    });
}

const certificationFallback = normalizeOptions(fortbildungOptions, []);
const specializationFallback = normalizeOptions(regSpecOptions, []);
const heilmittelFallback = [];

const defaultState = {
  certificationOptions: certificationFallback,
  specializationOptions: specializationFallback,
  heilmittelOptions: heilmittelFallback,
  // Plattformweiter Kurs-Schalter (aus /config/options → site.coursesEnabled).
  // Default true = rückwärtskompatibel, bis der Admin ihn abschaltet.
  coursesEnabled: true,
};

// Module-level cache shared by every useConfigOptions() call site, so /config/options
// is fetched at most once per app session instead of once per mounted component
// (previously every appointment/patient row fetched it independently).
let cachedState = null;
let inFlightPromise = null;
const listeners = new Set();

function fetchConfigOptions() {
  if (cachedState) return Promise.resolve(cachedState);
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = timedFetch('config/options', `${getBaseUrl()}/config/options`, { headers: TUNNEL_HEADERS })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) return defaultState;
      const next = {
        certificationOptions: normalizeOptions(data.certifications, certificationFallback),
        specializationOptions: normalizeOptions(data.specializations, specializationFallback),
        heilmittelOptions: normalizeOptions(data.heilmittel, heilmittelFallback),
        // Nur explizit false schaltet ab; alles andere lässt Kurse an.
        coursesEnabled: data.site?.coursesEnabled !== false,
      };
      cachedState = next;
      listeners.forEach((listener) => listener(next));
      return next;
    })
    .catch(() => defaultState)
    .finally(() => { inFlightPromise = null; });

  return inFlightPromise;
}

export function useConfigOptions() {
  const [state, setState] = useState(cachedState ?? defaultState);

  useEffect(() => {
    listeners.add(setState);
    if (!cachedState) fetchConfigOptions();
    return () => { listeners.delete(setState); };
  }, []);

  return state;
}
