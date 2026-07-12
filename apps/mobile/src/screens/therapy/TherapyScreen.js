import React, { useCallback, useEffect, useState } from 'react';
import { Ionicons, } from '@expo/vector-icons';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/use-theme';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { getBaseUrl, mapApiTherapist, normalizeTherapistProfile, TUNNEL_HEADERS } from '../../utils/app-utils';
import { TabHeader } from '../../components/TabHeader';
import { TherapyTabPatient } from './TherapyTabPatient';
import { TherapyTabTherapist } from './TherapyTabTherapist';
import { AppointmentDetail } from './AppointmentDetail';
import { TherapistAppointmentDetail } from './TherapistAppointmentDetail';
import { TherapistPatientDetailScreen } from './TherapistPatientDetailScreen';
import { CancelAppointmentModal } from '../../modals/CancelAppointmentModal';
import { TherapistCancelModal } from '../../modals/TherapistCancelModal';
import { BookingRequestForm } from '../public/BookingRequestForm';
import { useTherapyData } from '../../context/TherapyContext';
import { useConfigOptions } from '../../hooks/use-config-options';
import { markTap } from '../../utils/perf-log';

const t = (key) => translations.de[key] ?? key;

export function TherapyTabScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);
  const loggedInTherapist = useAppStore(appStoreSelectors.loggedInTherapist);
  const { setLoggedInTherapist } = useAuth();

  const { c } = useTheme();
  const { heilmittelOptions } = useConfigOptions();

  const {
    myAppointments, myAppointmentsLoading, appointmentsLastLoadedAt, setMyAppointments,
    incomingBookings, incomingBookingsLoading, incomingBookingsLastLoadedAt, setIncomingBookings,
    incomingInquiries, incomingInquiriesLoading, incomingInquiriesLastLoadedAt, setIncomingInquiries, loadIncomingInquiries,
    myInquiries, myInquiriesLoading, setMyInquiries,
    patients, patientsLoading, patientsLastLoadedAt,
    therapyRefreshing,
    loadMyAppointments, loadIncomingBookings,
    handleTherapyRefresh, refreshTherapyTab,
  } = useTherapyData();

  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedTherapistPatientAppointment, setSelectedTherapistPatientAppointment] = useState(null);
  const [therapistView, setTherapistView] = useState('termine');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [activeFilterTherapist, setActiveFilterTherapist] = useState('booked');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showTherapistCancelModal, setShowTherapistCancelModal] = useState(false);
  const [therapistCancelBookingId, setTherapistCancelBookingId] = useState(null);
  const [repeatBookingTherapist, setRepeatBookingTherapist] = useState(null);
  const [showRepeatBookingForm, setShowRepeatBookingForm] = useState(false);

  // Refreshes every list when this tab gains focus, but only when the data is
  // actually stale (older than STALE_MS in TherapyContext). Switching away and
  // straight back no longer fires a request salvo. Loaders only show a blocking
  // spinner the very first time (lastLoadedAt === 0); a background refresh keeps
  // existing data on screen while the fetch resolves. Pull-to-refresh forces.
  useFocusEffect(
    useCallback(() => {
      if (!authToken) return;
      refreshTherapyTab(authToken, accountType, loggedInTherapist);
    }, [authToken, accountType, loggedInTherapist, refreshTherapyTab]),
  );

  // Keeps an already-open detail view in sync when the underlying list refreshes
  // in the background, so status changes (CONFIRMED/DECLINED/CANCELLED) become
  // visible without having to close and reopen the detail screen.
  useEffect(() => {
    if (!selectedAppointment) return;
    const updated = myAppointments.find((a) => a.id === selectedAppointment.id);
    if (updated && updated !== selectedAppointment) setSelectedAppointment(updated);
  }, [myAppointments, selectedAppointment]);

  useEffect(() => {
    if (!selectedTherapistPatientAppointment) return;
    const updated = incomingBookings.find((b) => b.id === selectedTherapistPatientAppointment.appointment.id);
    if (updated && updated !== selectedTherapistPatientAppointment.appointment) {
      setSelectedTherapistPatientAppointment((prev) => (prev ? { ...prev, appointment: updated } : prev));
    }
  }, [incomingBookings, selectedTherapistPatientAppointment]);

  // Banner-Tap aus DiscoverScreen — Termin direkt öffnen wenn Param gesetzt.
  useEffect(() => {
    const openId = route.params?.openAppointmentId;
    if (!openId || !myAppointments.length) return;
    const apt = myAppointments.find((a) => a.id === openId);
    if (apt) {
      setSelectedAppointment(apt);
      navigation.setParams({ openAppointmentId: undefined });
    }
  }, [route.params?.openAppointmentId, myAppointments]);

  // Dashboard-Tap — Therapeut öffnet Buchungsdetail direkt via openBookingId.
  useEffect(() => {
    const openId = route.params?.openBookingId;
    if (!openId || !incomingBookings.length) return;
    const booking = incomingBookings.find((b) => b.id === openId);
    if (booking) {
      setSelectedTherapistPatientAppointment({
        appointment: booking,
        patient: {
          fullName: booking.patientName ?? null,
          phone: booking.patientPhone ?? null,
          email: booking.patientEmail ?? null,
          addressLine: null,
        },
      });
      navigation.setParams({ openBookingId: undefined });
    }
  }, [route.params?.openBookingId, incomingBookings]);

  // Dashboard-Tap ("Offene Aufgaben") — direkt im Anfragen-Unterreiter landen.
  const openTab = route.params?.openTab;
  useEffect(() => {
    if (!openTab) return;
    navigation.setParams({ openTab: undefined });
  }, [openTab]);

  const openTherapistById = (id, fallback = null) => {
    navigation.navigate(ROOT_ROUTES.THERAPIST_PROFILE, { therapistId: id, therapist: fallback });
  };

  const handleBookAgain = async (therapist) => {
    if (!authToken) {
      navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.AUTH });
      return;
    }
    if (!therapist?.id) return;

    // Frischen Therapeuten-Datensatz laden (prüft bookingMode)
    try {
      const therapistRes = await fetch(`${getBaseUrl()}/therapist/${therapist.id}`, { headers: { ...TUNNEL_HEADERS } });
      const therapistData = therapistRes.ok ? await therapistRes.json().catch(() => ({})) : {};
      const fullTherapist = therapistData?.therapist ? mapApiTherapist(therapistData.therapist) : therapist;

      if (fullTherapist?.bookingMode && fullTherapist.bookingMode !== 'FIRST_APPOINTMENT_REQUEST') {
        Alert.alert('Terminbuchung nicht verfügbar', 'Dieser Therapeut nimmt aktuell keine Terminanfragen über Revio an.');
        return;
      }

      setRepeatBookingTherapist(fullTherapist);
    } catch {
      setRepeatBookingTherapist(therapist);
    }
    setShowRepeatBookingForm(true);
  };

  // Patcht die lokale incoming-bookings-Liste aus der PATCH-Antwort. Kein
  // Slot-Status mehr — der Zeitraum wird serverseitig automatisch frei, sobald
  // die Buchung PENDING/CONFIRMED verlässt.
  const handleTherapistRespond = async (bookingId, body) => {
    const res = await fetch(`${getBaseUrl()}/bookings/${bookingId}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? `Fehler ${res.status}`);
    }
    const updated = await res.json();
    setIncomingBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
  };

  const handleTherapistCancelConfirm = async (reason) => {
    setShowTherapistCancelModal(false);
    if (!therapistCancelBookingId) return;
    const res = await fetch(`${getBaseUrl()}/bookings/${therapistCancelBookingId}/therapist-cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ cancelReason: reason }),
    });
    if (res.ok) {
      const updated = await res.json().catch(() => null);
      setIncomingBookings((prev) => prev.map((b) => (
        b.id === therapistCancelBookingId ? { ...b, ...(updated ?? { status: 'CANCELLED' }) } : b
      )));
    } else {
      const data = await res.json().catch(() => ({}));
      Alert.alert('Absagen fehlgeschlagen', data.error ?? 'Bitte versuche es erneut.');
    }
    if (selectedTherapistPatientAppointment?.appointment?.id === therapistCancelBookingId) {
      setSelectedTherapistPatientAppointment(null);
    }
    setTherapistCancelBookingId(null);
  };

  // Reached from the new day timeline — the `booking` already has the shape
  // TherapistAppointmentDetail expects (it comes straight from incomingBookings).
  const handleOpenBookingDetail = (booking) => {
    if (!booking) return;
    markTap(booking.id);
    setSelectedTherapistPatientAppointment({
      appointment: booking,
      patient: {
        fullName: booking.patientName ?? null,
        phone: booking.patientPhone ?? null,
        email: booking.patientEmail ?? null,
        addressLine: null,
      },
    });
  };

  const handleActivateBookingRequests = async (heilmittel) => {
    if (!authToken) return { ok: false, message: 'Nicht angemeldet.' };
    try {
      const patchRes = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ bookingMode: 'FIRST_APPOINTMENT_REQUEST', heilmittel }),
      });
      const patchData = await patchRes.json().catch(() => ({}));
      if (!patchRes.ok) {
        return { ok: false, message: patchData.message ?? patchData.error ?? 'Aktivierung fehlgeschlagen.' };
      }

      const meRes = await fetch(`${getBaseUrl()}/auth/me`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      });
      if (meRes.ok) {
        setLoggedInTherapist(normalizeTherapistProfile(await meRes.json()));
      }

      await loadIncomingBookings(authToken);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Verbindungsfehler.' };
    }
  };

  const handlePatientCancelConfirm = async (reason) => {
    if (!selectedAppointment) return;
    setShowCancelModal(false);
    const appointmentId = selectedAppointment.id;
    try {
      const res = await fetch(`${getBaseUrl()}/bookings/${appointmentId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ cancelReason: reason || undefined }),
      });
      if (res.ok) {
        const updated = await res.json().catch(() => null);
        setMyAppointments((prev) => prev.map((a) => (
          a.id === appointmentId ? { ...a, ...(updated ?? { status: 'CANCELLED' }) } : a
        )));
        setSelectedAppointment(null);
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Stornieren fehlgeschlagen', data.error ?? 'Bitte versuche es erneut.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte versuche es erneut.');
    }
  };

  if (selectedAppointment) {
    return (
      <>
        <AppointmentDetail
          appointment={selectedAppointment}
          onBack={() => setSelectedAppointment(null)}
          onOpenTherapist={openTherapistById}
          onBookAgain={handleBookAgain}
          onCancelRequest={() => setShowCancelModal(true)}
          authToken={authToken}
          c={c} t={t} styles={appStyles}
        />
        <CancelAppointmentModal
          visible={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handlePatientCancelConfirm}
          appointment={selectedAppointment}
          c={c}
        />
        <Modal
          visible={showRepeatBookingForm}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowRepeatBookingForm(false)}
        >
          {repeatBookingTherapist ? (
            <BookingRequestForm
              c={c}
              t={t}
              therapist={repeatBookingTherapist}
              authToken={authToken}
              onSuccess={() => {
                setShowRepeatBookingForm(false);
                setSelectedAppointment(null);
                loadMyAppointments(authToken);
              }}
              onClose={() => setShowRepeatBookingForm(false)}
            />
          ) : null}
        </Modal>
      </>
    );
  }


  if (accountType === 'patient') {
    return (
      <>
        <TherapyTabPatient
          myAppointments={myAppointments}
          myAppointmentsLoading={myAppointmentsLoading}
          therapyRefreshing={therapyRefreshing}
          appointmentsLastLoadedAt={appointmentsLastLoadedAt}
          myInquiries={myInquiries}
          myInquiriesLoading={myInquiriesLoading}
          onInquiryWithdrawn={(id) => setMyInquiries((prev) => prev.map((r) => r.id === id ? { ...r, status: 'WITHDRAWN' } : r))}
          authToken={authToken}
          onRefresh={() => handleTherapyRefresh(authToken, accountType, loggedInTherapist)}
          onOpenTherapistById={openTherapistById}
          onSelectAppointment={(appointment) => { markTap(appointment.id); setSelectedAppointment(appointment); }}
          c={c} t={t} styles={appStyles}
        />
      </>
    );
  }

  if (accountType === 'therapist') {
    if (selectedPatientId) {
      return (
        <TherapistPatientDetailScreen
          authToken={authToken}
          patientId={selectedPatientId}
          onBack={() => setSelectedPatientId(null)}
          onSelectAppointment={(appointment, patient) => { markTap(appointment.id); setSelectedTherapistPatientAppointment({ appointment, patient }); }}
          c={c}
        />
      );
    }

    return (
      <>
        <TherapyTabTherapist
          authToken={authToken}
          incomingBookings={incomingBookings}
          incomingBookingsLoading={incomingBookingsLoading}
          therapyRefreshing={therapyRefreshing}
          incomingBookingsLastLoadedAt={incomingBookingsLastLoadedAt}
          incomingInquiries={incomingInquiries}
          incomingInquiriesLoading={incomingInquiriesLoading}
          incomingInquiriesLastLoadedAt={incomingInquiriesLastLoadedAt}
          loadIncomingInquiries={loadIncomingInquiries}
          onInquiryUpdate={(updated) => setIncomingInquiries((prev) => prev.map((q) => q.id === updated.id ? updated : q))}
          onRefresh={() => handleTherapyRefresh(authToken, accountType, loggedInTherapist)}
          onTherapistCancelRequest={(id) => { setTherapistCancelBookingId(id); setShowTherapistCancelModal(true); }}
          onSelectTherapistDetailBooking={(booking) => { setTherapistCancelBookingId(booking.id); setShowTherapistCancelModal(true); }}
          onOpenBookingDetail={handleOpenBookingDetail}
          loggedInTherapist={loggedInTherapist}
          onActivateBookingRequests={handleActivateBookingRequests}
          heilmittelOptions={heilmittelOptions}
          initialSubTab={openTab}
          c={c} t={t} styles={appStyles}
        />
        <TherapistCancelModal
          visible={showTherapistCancelModal}
          onClose={() => setShowTherapistCancelModal(false)}
          onConfirm={handleTherapistCancelConfirm}
          booking={incomingBookings.find((b) => b.id === therapistCancelBookingId) ?? null}
          c={c}
        />

        <Modal
          visible={!!selectedTherapistPatientAppointment}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedTherapistPatientAppointment(null)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => setSelectedTherapistPatientAppointment(null)}
            />
            <View style={{ height: '92%' }}>
              {selectedTherapistPatientAppointment && (
                <TherapistAppointmentDetail
                  appointment={selectedTherapistPatientAppointment.appointment}
                  patient={selectedTherapistPatientAppointment.patient}
                  onBack={() => setSelectedTherapistPatientAppointment(null)}
                  onRespond={handleTherapistRespond}
                  onCancelRequest={() => {
                    setTherapistCancelBookingId(selectedTherapistPatientAppointment.appointment.id);
                    setShowTherapistCancelModal(true);
                    setSelectedTherapistPatientAppointment(null);
                  }}
                  onOpenPatient={(patientId) => {
                    setSelectedTherapistPatientAppointment(null);
                    setSelectedPatientId(patientId);
                  }}
                  isModal
                  c={c}
                />
              )}
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TabHeader c={c} title={t('myAppointments')} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.mutedBg, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Ionicons name="calendar-outline" size={36} color={c.primary} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center', lineHeight: 30, marginBottom: 10 }}>
          {t('therapyLoginRequired')}
        </Text>
        <Text style={{ fontSize: 15, color: c.muted, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
          {t('therapyLoginRequiredBody')}
        </Text>
        <Pressable
          onPress={() => navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.AUTH })}
          style={[appStyles.registerBtn, { backgroundColor: c.primary, paddingHorizontal: 40 }]}
        >
          <Text style={appStyles.registerBtnText}>{t('loginAction')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
