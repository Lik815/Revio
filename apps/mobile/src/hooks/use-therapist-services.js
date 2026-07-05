import { useCallback, useEffect, useRef, useState } from 'react';
import { getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';

/**
 * Laedt die Leistungskonfiguration des eingeloggten Therapeuten und gibt
 * eine Lookup-Map zurueck: { [heilmittelKey]: { durationMin, isActive, colorHex } }
 */
export function useTherapistServices({ authToken }) {
  const [servicesByKey, setServicesByKey] = useState({});
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!authToken) return;
    cancelledRef.current = false;
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/services`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      }).catch(() => null);
      if (cancelledRef.current) return;
      if (res?.ok) {
        const data = await res.json().catch(() => ({}));
        if (!cancelledRef.current) {
          const map = {};
          for (const svc of data.services ?? []) {
            map[svc.heilmittelKey] = {
              durationMin: svc.durationMin,
              isActive: svc.isActive,
              colorHex: svc.colorHex ?? null,
            };
          }
          setServicesByKey(map);
        }
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    load();
    return () => { cancelledRef.current = true; };
  }, [load]);

  return { servicesByKey, loading, reloadServices: load };
}
