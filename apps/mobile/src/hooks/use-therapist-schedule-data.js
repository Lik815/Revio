import { useCallback, useEffect, useRef, useState } from 'react';
import { getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';

// Schedule data (working hours, blocked times, course sessions) changes rarely,
// so a tab-focus refresh only refetches when the last load is older than this.
// Pass { force: true } (pull-to-refresh) to bypass.
const SCHEDULE_STALE_MS = 30 * 1000;

export function useTherapistScheduleData({ authToken }) {
  const [workingHoursRules, setWorkingHoursRules] = useState([]);
  const [blockedTimes, setBlockedTimes] = useState([]);
  const [courseSessions, setCourseSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);
  const lastLoadedAtRef = useRef(0);

  const load = useCallback(async ({ force = false } = {}) => {
    if (!authToken) return;
    if (!force && lastLoadedAtRef.current !== 0 && Date.now() - lastLoadedAtRef.current < SCHEDULE_STALE_MS) return;
    cancelledRef.current = false;
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const to = new Date();
      to.setDate(to.getDate() + 90);

      const [hoursRes, blockedRes, courseSessionsRes] = await Promise.all([
        fetch(`${getBaseUrl()}/therapist/working-hours`, {
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        }).catch(() => null),
        fetch(
          `${getBaseUrl()}/therapist/blocked-times?from=${from.toISOString()}&to=${to.toISOString()}`,
          { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` } },
        ).catch(() => null),
        fetch(
          `${getBaseUrl()}/courses/my/sessions?from=${from.toISOString()}&to=${to.toISOString()}`,
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
      if (courseSessionsRes?.ok) {
        const d = await courseSessionsRes.json().catch(() => ({}));
        if (!cancelledRef.current) setCourseSessions(d.sessions ?? []);
      }
      if (!cancelledRef.current) lastLoadedAtRef.current = Date.now();
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    // New session (or logout→login): drop the freshness stamp so the first load
    // after a token change always fetches, ignoring the staleness window.
    lastLoadedAtRef.current = 0;
    load();
    return () => { cancelledRef.current = true; };
  }, [load]);

  return { workingHoursRules, blockedTimes, courseSessions, loading, refreshScheduleData: load };
}
