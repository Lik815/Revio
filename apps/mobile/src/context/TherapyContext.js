import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';
import { timedFetch } from '../utils/perf-log';
import { useAuth } from './AuthContext';

const TherapyContext = createContext(null);

// Freshness window for tab-focus refetches. A focus refresh no longer forces a
// refetch: if the data is younger than this it stays as-is (no request), so
// rapid tab switching doesn't fire a salvo of requests. Pull-to-refresh and
// app-foregrounding still force. AppState foregrounding also forces (see below).
const STALE_MS = 30 * 1000;
const isStale = (lastLoadedAt) => Date.now() - lastLoadedAt > STALE_MS;

export function TherapyProvider({ children }) {
  const { authToken, accountType, loggedInTherapist } = useAuth();
  const [myAppointments, setMyAppointments] = useState([]);
  const [myAppointmentsLoading, setMyAppointmentsLoading] = useState(false);
  const [incomingBookings, setIncomingBookings] = useState([]);
  const [incomingBookingsLoading, setIncomingBookingsLoading] = useState(false);
  const [incomingInquiries, setIncomingInquiries] = useState([]);
  const [incomingInquiriesLoading, setIncomingInquiriesLoading] = useState(false);
  const [incomingInquiriesLastLoadedAt, setIncomingInquiriesLastLoadedAt] = useState(0);
  const [myInquiries, setMyInquiries] = useState([]);
  const [myInquiriesLoading, setMyInquiriesLoading] = useState(false);
  const [myInquiriesLastLoadedAt, setMyInquiriesLastLoadedAt] = useState(0);
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

  const loadIncomingInquiries = useCallback(async (token, { background = false } = {}) => {
    if (!token) return;
    if (!background || incomingInquiriesLastLoadedAt === 0) setIncomingInquiriesLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/inquiry/incoming`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIncomingInquiries(Array.isArray(data) ? data : []);
        setIncomingInquiriesLastLoadedAt(Date.now());
      }
    } catch {} finally { setIncomingInquiriesLoading(false); }
  }, [incomingInquiriesLastLoadedAt]);

  const loadMyInquiries = useCallback(async (token, { background = false } = {}) => {
    if (!token) return;
    if (!background || myInquiriesLastLoadedAt === 0) setMyInquiriesLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/inquiry/my`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyInquiries(Array.isArray(data) ? data : []);
        setMyInquiriesLastLoadedAt(Date.now());
      }
    } catch {} finally { setMyInquiriesLoading(false); }
  }, [myInquiriesLastLoadedAt]);

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
    setIncomingInquiries([]);
    setIncomingInquiriesLastLoadedAt(0);
    setIncomingInquiriesLoading(false);
    setMyInquiries([]);
    setMyInquiriesLastLoadedAt(0);
    setMyInquiriesLoading(false);
    setPatients([]);
    setPatientDetails({});
    setFavoritesLastLoadedAt(0);
    setAppointmentsLastLoadedAt(0);
    setIncomingBookingsLastLoadedAt(0);
    setPatientsLastLoadedAt(0);
    setFavoritesLoading(false);
    setMyAppointmentsLoading(false);
    setIncomingBookingsLoading(false);
    setPatientsLoading(false);
    setTherapyRefreshing(false);
  }, []);

  const refreshTherapyTab = useCallback(async (token, accountType, loggedInTherapist, { force = false } = {}) => {
    if (!token) return;
    const jobs = [];
    if (force || isStale(favoritesLastLoadedAt)) jobs.push(loadFavorites(token, { background: true }));
    if (accountType === 'patient') {
      if (force || isStale(appointmentsLastLoadedAt)) jobs.push(loadMyAppointments(token, { background: true }));
      if (force || isStale(myInquiriesLastLoadedAt)) jobs.push(loadMyInquiries(token, { background: true }));
    } else if (loggedInTherapist) {
      // Keine freien Slots mehr — Termine kommen aus incomingBookings.
      if (force || isStale(incomingBookingsLastLoadedAt)) jobs.push(loadIncomingBookings(token, { background: true }));
      if (force || isStale(incomingInquiriesLastLoadedAt)) jobs.push(loadIncomingInquiries(token, { background: true }));
      if (force || isStale(patientsLastLoadedAt)) jobs.push(loadPatients(token, { background: true }));
    }
    if (jobs.length > 0) await Promise.allSettled(jobs);
  }, [favoritesLastLoadedAt, appointmentsLastLoadedAt, myInquiriesLastLoadedAt, incomingBookingsLastLoadedAt,
      incomingInquiriesLastLoadedAt, patientsLastLoadedAt,
      loadFavorites, loadMyAppointments, loadMyInquiries, loadIncomingBookings, loadIncomingInquiries, loadPatients]);

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
      incomingInquiries, incomingInquiriesLoading, setIncomingInquiries,
      incomingInquiriesLastLoadedAt, loadIncomingInquiries,
      myInquiries, myInquiriesLoading, setMyInquiries, loadMyInquiries,
      patients, patientsLoading, patientsLastLoadedAt, setPatients,
      patientDetails, loadPatientDetail, setPatientDetails,
      favorites, favoritesLoading, favoritePractices,
      setFavorites, setFavoritesLoading, setFavoritePractices,
      availableSlots, availableSlotsTherapistId, availableSlotsLoading,
      setAvailableSlots, setAvailableSlotsTherapistId,
      therapyRefreshing, setTherapyRefreshing,
      favoritesLastLoadedAt, appointmentsLastLoadedAt,
      incomingBookingsLastLoadedAt,
      loadFavorites, loadMyAppointments, loadIncomingBookings,
      loadAvailableSlots, loadPatients,
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
