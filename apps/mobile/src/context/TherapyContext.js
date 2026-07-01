import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';
import { timedFetch } from '../utils/perf-log';
import { useAuth } from './AuthContext';

const TherapyContext = createContext(null);

// Background-refresh window: a focus/foreground refresh always forces a refetch,
// this only governs how "fresh" data must be for a non-forced background call.
const STALE_MS = 20 * 1000;
const isStale = (lastLoadedAt) => Date.now() - lastLoadedAt > STALE_MS;

export function TherapyProvider({ children }) {
  const { authToken, accountType, loggedInTherapist } = useAuth();
  const [myAppointments, setMyAppointments] = useState([]);
  const [myAppointmentsLoading, setMyAppointmentsLoading] = useState(false);
  const [incomingBookings, setIncomingBookings] = useState([]);
  const [incomingBookingsLoading, setIncomingBookingsLoading] = useState(false);
  const [mySlots, setMySlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [deletingSlotIds, setDeletingSlotIds] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsLastLoadedAt, setPatientsLastLoadedAt] = useState(0);
  const [patientDetails, setPatientDetails] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritePractices, setFavoritePractices] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [availableSlotsTherapistId, setAvailableSlotsTherapistId] = useState(null);
  const [availableSlotsLoading, setAvailableSlotsLoading] = useState(false);
  const [therapyRefreshing, setTherapyRefreshing] = useState(false);
  const [favoritesLastLoadedAt, setFavoritesLastLoadedAt] = useState(0);
  const [appointmentsLastLoadedAt, setAppointmentsLastLoadedAt] = useState(0);
  const [incomingBookingsLastLoadedAt, setIncomingBookingsLastLoadedAt] = useState(0);
  const [slotsLastLoadedAt, setSlotsLastLoadedAt] = useState(0);

  const loadFavorites = useCallback(async (token, { background = false } = {}) => {
    if (!token) return;
    if (!background || favoritesLastLoadedAt === 0) setFavoritesLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/favorites/therapists`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites(Array.isArray(data.therapists) ? data.therapists : []);
        setFavoritesLastLoadedAt(Date.now());
      }
    } catch {} finally { setFavoritesLoading(false); }
  }, [favoritesLastLoadedAt]);

  const loadMyAppointments = useCallback(async (token, { background = false } = {}) => {
    if (!token) return;
    if (!background || appointmentsLastLoadedAt === 0) setMyAppointmentsLoading(true);
    try {
      const res = await timedFetch('bookings/my', `${getBaseUrl()}/bookings/my`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyAppointments(Array.isArray(data) ? data : []);
        setAppointmentsLastLoadedAt(Date.now());
      }
    } catch {} finally { setMyAppointmentsLoading(false); }
  }, [appointmentsLastLoadedAt]);

  const loadIncomingBookings = useCallback(async (token, { background = false } = {}) => {
    if (!token) return;
    if (!background || incomingBookingsLastLoadedAt === 0) setIncomingBookingsLoading(true);
    try {
      const res = await timedFetch('bookings/incoming', `${getBaseUrl()}/bookings/incoming`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIncomingBookings(Array.isArray(data) ? data : []);
        setIncomingBookingsLastLoadedAt(Date.now());
      }
    } catch {} finally { setIncomingBookingsLoading(false); }
  }, [incomingBookingsLastLoadedAt]);

  const loadMySlots = useCallback(async (token, { background = false } = {}) => {
    if (!token) return;
    if (!background || slotsLastLoadedAt === 0) setSlotsLoading(true);
    try {
      const pastFrom = new Date();
      pastFrom.setFullYear(pastFrom.getFullYear() - 1);
      const now = new Date();
      const headers = { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` };
      const [futureRes, pastBookedRes] = await Promise.all([
        timedFetch('therapist/slots', `${getBaseUrl()}/therapist/slots`, { headers }),
        timedFetch(
          'therapist/slots past booked',
          `${getBaseUrl()}/therapist/slots?status=BOOKED&from=${encodeURIComponent(pastFrom.toISOString())}&to=${encodeURIComponent(now.toISOString())}`,
          { headers },
        ),
      ]);
      if (futureRes.ok || pastBookedRes.ok) {
        const futureData = futureRes.ok ? await futureRes.json().catch(() => ({})) : {};
        const pastBookedData = pastBookedRes.ok ? await pastBookedRes.json().catch(() => ({})) : {};
        const merged = new Map();
        [...(Array.isArray(futureData.slots) ? futureData.slots : []), ...(Array.isArray(pastBookedData.slots) ? pastBookedData.slots : [])]
          .forEach((slot) => {
            if (slot?.id) merged.set(slot.id, slot);
          });
        setMySlots([...merged.values()].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)));
        setSlotsLastLoadedAt(Date.now());
      }
    } catch {} finally { setSlotsLoading(false); }
  }, [slotsLastLoadedAt]);

  const loadPatients = useCallback(async (token, { background = false } = {}) => {
    if (!token) return;
    if (!background || patientsLastLoadedAt === 0) setPatientsLoading(true);
    try {
      const res = await timedFetch('therapist/patients', `${getBaseUrl()}/therapist/patients`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPatients(Array.isArray(data.patients) ? data.patients : []);
        setPatientsLastLoadedAt(Date.now());
      }
    } catch {} finally { setPatientsLoading(false); }
  }, [patientsLastLoadedAt]);

  const loadPatientDetail = useCallback(async (token, patientId) => {
    if (!token || !patientId) return null;
    try {
      const res = await timedFetch('therapist/patients/:id', `${getBaseUrl()}/therapist/patients/${patientId}`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      setPatientDetails((prev) => ({
        ...prev,
        [patientId]: {
          patient: data.patient ?? null,
          appointments: Array.isArray(data.appointments) ? data.appointments : [],
          loadedAt: Date.now(),
        },
      }));
      return data;
    } catch { return null; }
  }, []);

  const loadAvailableSlots = useCallback(async (therapistId) => {
    setAvailableSlotsLoading(true);
    setAvailableSlotsTherapistId(therapistId);
    try {
      const res = await fetch(`${getBaseUrl()}/therapists/${therapistId}/slots`, {
        headers: { ...TUNNEL_HEADERS },
      });
      setAvailableSlots(res.ok ? (await res.json()).slots ?? [] : []);
    } catch { setAvailableSlots([]); }
    finally { setAvailableSlotsLoading(false); }
  }, []);

  const resetTherapyData = useCallback(() => {
    setFavorites([]);
    setMyAppointments([]);
    setIncomingBookings([]);
    setMySlots([]);
    setDeletingSlotIds([]);
    setPatients([]);
    setPatientDetails({});
    setFavoritesLastLoadedAt(0);
    setAppointmentsLastLoadedAt(0);
    setIncomingBookingsLastLoadedAt(0);
    setSlotsLastLoadedAt(0);
    setPatientsLastLoadedAt(0);
    setFavoritesLoading(false);
    setMyAppointmentsLoading(false);
    setIncomingBookingsLoading(false);
    setSlotsLoading(false);
    setPatientsLoading(false);
    setTherapyRefreshing(false);
  }, []);

  const refreshTherapyTab = useCallback(async (token, accountType, loggedInTherapist, { force = false } = {}) => {
    if (!token) return;
    const jobs = [];
    if (force || isStale(favoritesLastLoadedAt)) jobs.push(loadFavorites(token, { background: true }));
    if (accountType === 'patient') {
      if (force || isStale(appointmentsLastLoadedAt)) jobs.push(loadMyAppointments(token, { background: true }));
    } else if (loggedInTherapist) {
      // Keine freien Slots mehr — Termine kommen aus incomingBookings.
      if (force || isStale(incomingBookingsLastLoadedAt)) jobs.push(loadIncomingBookings(token, { background: true }));
      if (force || isStale(patientsLastLoadedAt)) jobs.push(loadPatients(token, { background: true }));
    }
    if (jobs.length > 0) await Promise.allSettled(jobs);
  }, [favoritesLastLoadedAt, appointmentsLastLoadedAt, incomingBookingsLastLoadedAt, patientsLastLoadedAt,
      loadFavorites, loadMyAppointments, loadIncomingBookings, loadPatients]);

  const handleTherapyRefresh = useCallback(async (token, accountType, loggedInTherapist) => {
    if (!token) return;
    setTherapyRefreshing(true);
    try { await refreshTherapyTab(token, accountType, loggedInTherapist, { force: true }); }
    finally { setTherapyRefreshing(false); }
  }, [refreshTherapyTab]);

  // Clears out the previous account's data the moment a session ends, so a
  // following login on the same device never flashes stale appointments/patients
  // before the next fetch resolves.
  const previousTokenRef = useRef(authToken);
  useEffect(() => {
    if (previousTokenRef.current && !authToken) resetTherapyData();
    previousTokenRef.current = authToken;
  }, [authToken, resetTherapyData]);

  // Mirrors NotificationContext's AppState handling: force a refetch of every
  // therapy-tab list when the app returns to the foreground, so booking/slot/
  // patient changes made elsewhere (or by the backend) show up without a restart.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextState;
      if (nextState === 'active' && !wasActive) {
        refreshTherapyTab(authToken, accountType, loggedInTherapist, { force: true });
      }
    });
    return () => subscription.remove();
  }, [authToken, accountType, loggedInTherapist, refreshTherapyTab]);

  return (
    <TherapyContext.Provider value={{
      myAppointments, myAppointmentsLoading, setMyAppointments,
      incomingBookings, incomingBookingsLoading, setIncomingBookings,
      mySlots, slotsLoading, deletingSlotIds, setMySlots, setDeletingSlotIds,
      patients, patientsLoading, patientsLastLoadedAt, setPatients,
      patientDetails, loadPatientDetail, setPatientDetails,
      favorites, favoritesLoading, favoritePractices,
      setFavorites, setFavoritesLoading, setFavoritePractices,
      availableSlots, availableSlotsTherapistId, availableSlotsLoading,
      setAvailableSlots, setAvailableSlotsTherapistId,
      therapyRefreshing, setTherapyRefreshing,
      favoritesLastLoadedAt, appointmentsLastLoadedAt,
      incomingBookingsLastLoadedAt, slotsLastLoadedAt,
      loadFavorites, loadMyAppointments, loadIncomingBookings,
      loadMySlots, loadAvailableSlots, loadPatients,
      resetTherapyData, refreshTherapyTab, handleTherapyRefresh,
    }}>
      {children}
    </TherapyContext.Provider>
  );
}

export function useTherapyData() {
  const ctx = useContext(TherapyContext);
  if (!ctx) throw new Error('useTherapyData must be used within TherapyProvider');
  return ctx;
}
