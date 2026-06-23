import React, { createContext, useContext, useState, useCallback } from 'react';
import { getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';
import { timedFetch } from '../utils/perf-log';

const TherapyContext = createContext(null);

const STALE_MS = 5 * 60 * 1000;
const isStale = (lastLoadedAt) => Date.now() - lastLoadedAt > STALE_MS;

export function TherapyProvider({ children }) {
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
      const res = await timedFetch('therapist/slots', `${getBaseUrl()}/therapist/slots`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMySlots(Array.isArray(data.slots) ? data.slots : []);
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
      if (force || isStale(slotsLastLoadedAt)) jobs.push(loadMySlots(token, { background: true }));
      if (force || isStale(incomingBookingsLastLoadedAt)) jobs.push(loadIncomingBookings(token, { background: true }));
      if (force || isStale(patientsLastLoadedAt)) jobs.push(loadPatients(token, { background: true }));
    }
    if (jobs.length > 0) await Promise.allSettled(jobs);
  }, [favoritesLastLoadedAt, appointmentsLastLoadedAt, slotsLastLoadedAt, incomingBookingsLastLoadedAt, patientsLastLoadedAt,
      loadFavorites, loadMyAppointments, loadMySlots, loadIncomingBookings, loadPatients]);

  const handleTherapyRefresh = useCallback(async (token, accountType, loggedInTherapist) => {
    if (!token) return;
    setTherapyRefreshing(true);
    try { await refreshTherapyTab(token, accountType, loggedInTherapist, { force: true }); }
    finally { setTherapyRefreshing(false); }
  }, [refreshTherapyTab]);

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
