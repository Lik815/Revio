import { useCallback, useEffect, useRef, useState } from 'react';
import { getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';

export function useTherapistScheduleData({ authToken }) {
  const [workingHoursRules, setWorkingHoursRules] = useState([]);
  const [blockedTimes, setBlockedTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!authToken) return;
    cancelledRef.current = false;
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const to = new Date();
      to.setDate(to.getDate() + 90);

      const [hoursRes, blockedRes] = await Promise.all([
        fetch(`${getBaseUrl()}/therapist/working-hours`, {
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        }).catch(() => null),
        fetch(
          `${getBaseUrl()}/therapist/blocked-times?from=${from.toISOString()}&to=${to.toISOString()}`,
          { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` } },
        ).catch(() => null),
      ]);

      if (cancelledRef.current) return;

      if (hoursRes?.ok) {
        const d = await hoursRes.json().catch(() => ({}));
        if (!cancelledRef.current) setWorkingHoursRules(d.rules ?? []);
      }
      if (blockedRes?.ok) {
        const d = await blockedRes.json().catch(() => ({}));
        if (!cancelledRef.current) setBlockedTimes(d.blockedTimes ?? []);
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    load();
    return () => { cancelledRef.current = true; };
  }, [load]);

  return { workingHoursRules, blockedTimes, loading, refreshScheduleData: load };
}
