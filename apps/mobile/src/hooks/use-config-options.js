import { useEffect, useState } from 'react';
import {
  fortbildungOptions,
  getBaseUrl,
  regSpecOptions,
  TUNNEL_HEADERS,
} from '../utils/app-utils';

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

export function useConfigOptions() {
  const [certificationOptions, setCertificationOptions] = useState(certificationFallback);
  const [specializationOptions, setSpecializationOptions] = useState(specializationFallback);
  const [heilmittelOptions, setHeilmittelOptions] = useState(heilmittelFallback);

  useEffect(() => {
    let cancelled = false;

    fetch(`${getBaseUrl()}/config/options`, { headers: TUNNEL_HEADERS })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setCertificationOptions(normalizeOptions(data.certifications, certificationFallback));
        setSpecializationOptions(normalizeOptions(data.specializations, specializationFallback));
        setHeilmittelOptions(normalizeOptions(data.heilmittel, heilmittelFallback));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  return { certificationOptions, specializationOptions, heilmittelOptions };
}
