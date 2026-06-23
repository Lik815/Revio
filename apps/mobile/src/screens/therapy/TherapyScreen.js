import React, { useEffect, useState } from 'react';
import { Ionicons, } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES } from '../../navigation/route-names';
import { getBaseUrl, normalizeTherapistProfile, TUNNEL_HEADERS } from '../../utils/app-utils';
import { TabHeader } from '../../components/TabHeader';
import { TherapyTabPatient } from './TherapyTabPatient';
import { TherapyTabTherapist } from './TherapyTabTherapist';
import { AppointmentDetail } from './AppointmentDetail';
import { TherapistAppointmentDetail } from './TherapistAppointmentDetail';
import { TherapistPatientDetailScreen } from './TherapistPatientDetailScreen';
import { CancelAppointmentModal } from '../../modals/CancelAppointmentModal';
import { TherapistCancelModal } from '../../modals/TherapistCancelModal';
import { SlotComposerModal } from '../../modals/SlotComposerModal';
import { SlotCreatedModal } from '../../modals/SlotCreatedModal';
import { useTherapyData } from '../../context/TherapyContext';
import { useConfigOptions } from '../../hooks/use-config-options';

const t = (key) => translations.de[key] ?? key;

export function TherapyTabScreen() {
  const navigation = useNavigation();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);
  const loggedInTherapist = useAppStore(appStoreSelectors.loggedInTherapist);
  const setLoggedInTherapist = useAppStore((state) => state.setLoggedInTherapist);

  const { c } = useTheme();
  const { heilmittelOptions } = useConfigOptions();

  const {
    myAppointments, myAppointmentsLoading, appointmentsLastLoadedAt,
    incomingBookings, incomingBookingsLoading, incomingBookingsLastLoadedAt,
    mySlots, slotsLoading, deletingSlotIds, slotsLastLoadedAt,
    patients, patientsLoading, patientsLastLoadedAt,
    therapyRefreshing,
    loadMyAppointments, loadIncomingBookings, loadMySlots, loadPatients,
    handleTherapyRefresh,
  } = useTherapyData();

  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedTherapistPatientAppointment, setSelectedTherapistPatientAppointment] = useState(null);
  const [therapistView, setTherapistView] = useState('termine');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [activeFilterPatient, setActiveFilterPatient] = useState('all');
  const [activeFilterTherapist, setActiveFilterTherapist] = useState('all');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showTherapistCancelModal, setShowTherapistCancelModal] = useState(false);
  const [therapistCancelBookingId, setTherapistCancelBookingId] = useState(null);
  const [showSlotComposer, setShowSlotComposer] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);
  const [showSlotCreated, setShowSlotCreated] = useState(false);
  const [slotError, setSlotError] = useState('');

  useEffect(() => {
    if (!authToken) return;
    if (accountType === 'patient') loadMyAppointments(authToken);
    if (accountType === 'therapist') {
      loadMySlots(authToken);
      loadIncomingBookings(authToken);
      loadPatients(authToken);
    }
  }, [authToken, accountType]);

  const openTherapistById = (id, fallback = null) => {
    navigation.navigate(ROOT_ROUTES.THERAPIST_PROFILE, { therapistId: id, therapist: fallback });
  };

  const handleAddSlots = async (slots) => {
    if (!authToken || slots.length === 0) return;
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ slots }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setShowSlotComposer(false);
        setCreatedResult(data);
        setShowSlotCreated(true);
        setSlotError('');
      } else {
        setSlotError(data?.error ?? 'Termine konnten nicht angelegt werden.');
      }
    } catch {
      setSlotError('Verbindungsfehler.');
    } finally {
      await loadMySlots(authToken);
    }
  };

  const handleCancelSlot = async (slotId) => {
    if (!authToken) return;
    try {
      await fetch(`${getBaseUrl()}/therapist/slots/${slotId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      await loadMySlots(authToken);
    } catch {}
  };

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
    await loadIncomingBookings(authToken);
    await loadMySlots(authToken);
  };

  const handleTherapistCancelConfirm = async () => {
    setShowTherapistCancelModal(false);
    if (!therapistCancelBookingId) return;
    const res = await fetch(`${getBaseUrl()}/bookings/${therapistCancelBookingId}/therapist-cancel`, {
      method: 'PATCH',
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) { loadIncomingBookings(authToken); loadMySlots(authToken); }
    setTherapistCancelBookingId(null);
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

      await loadMySlots(authToken);
      await loadIncomingBookings(authToken);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Verbindungsfehler.' };
    }
  };

  const handlePatientCancelConfirm = async () => {
    if (!selectedAppointment) return;
    setShowCancelModal(false);
    try {
      await fetch(`${getBaseUrl()}/bookings/${selectedAppointment.id}/cancel`, {
        method: 'PATCH',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      });
      await loadMyAppointments(authToken);
      setSelectedAppointment(null);
    } catch {}
  };

  if (selectedAppointment) {
    return (
      <>
        <AppointmentDetail
          appointment={selectedAppointment}
          onBack={() => setSelectedAppointment(null)}
          onOpenTherapist={openTherapistById}
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
      </>
    );
  }

  if (selectedTherapistPatientAppointment) {
    return (
      <TherapistAppointmentDetail
        appointment={selectedTherapistPatientAppointment.appointment}
        patient={selectedTherapistPatientAppointment.patient}
        onBack={() => setSelectedTherapistPatientAppointment(null)}
        onRespond={handleTherapistRespond}
        c={c}
        styles={appStyles}
      />
    );
  }

  if (accountType === 'patient') {
    return (
      <>
        <TherapyTabPatient
          myAppointments={myAppointments}
          myAppointmentsLoading={myAppointmentsLoading}
          activeFilterPatient={activeFilterPatient}
          setActiveFilterPatient={setActiveFilterPatient}
          therapyRefreshing={therapyRefreshing}
          appointmentsLastLoadedAt={appointmentsLastLoadedAt}
          onRefresh={() => handleTherapyRefresh(authToken, accountType, loggedInTherapist)}
          onOpenTherapistById={openTherapistById}
          onSelectAppointment={setSelectedAppointment}
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
          onSelectAppointment={(appointment, patient) => setSelectedTherapistPatientAppointment({ appointment, patient })}
          c={c}
        />
      );
    }

    return (
      <>
        <TherapyTabTherapist
          authToken={authToken}
          mySlots={mySlots}
          slotsLoading={slotsLoading}
          incomingBookings={incomingBookings}
          incomingBookingsLoading={incomingBookingsLoading}
          deletingSlotIds={deletingSlotIds}
          activeFilterTherapist={activeFilterTherapist}
          setActiveFilterTherapist={setActiveFilterTherapist}
          therapyRefreshing={therapyRefreshing}
          slotsLastLoadedAt={slotsLastLoadedAt}
          incomingBookingsLastLoadedAt={incomingBookingsLastLoadedAt}
          onRefresh={() => handleTherapyRefresh(authToken, accountType, loggedInTherapist)}
          onLoadMySlots={loadMySlots}
          onLoadIncomingBookings={loadIncomingBookings}
          onOpenTherapistById={openTherapistById}
          onCancelSlot={handleCancelSlot}
          onTherapistCancelRequest={(id) => { setTherapistCancelBookingId(id); setShowTherapistCancelModal(true); }}
          onSelectTherapistDetailBooking={(booking) => { setTherapistCancelBookingId(booking.id); setShowTherapistCancelModal(true); }}
          setShowSlotComposerModal={setShowSlotComposer}
          loggedInTherapist={loggedInTherapist}
          onActivateBookingRequests={handleActivateBookingRequests}
          heilmittelOptions={heilmittelOptions}
          therapistView={therapistView}
          setTherapistView={setTherapistView}
          patients={patients}
          patientsLoading={patientsLoading}
          patientsLastLoadedAt={patientsLastLoadedAt}
          onSelectPatient={setSelectedPatientId}
          c={c} t={t} styles={appStyles}
        />
        <TherapistCancelModal
          visible={showTherapistCancelModal}
          onClose={() => setShowTherapistCancelModal(false)}
          onConfirm={handleTherapistCancelConfirm}
          booking={incomingBookings.find((b) => b.id === therapistCancelBookingId) ?? null}
          c={c}
        />
        <SlotComposerModal
          visible={showSlotComposer}
          onClose={() => { setShowSlotComposer(false); setSlotError(''); }}
          onAddSlot={(slot) => handleAddSlots([slot])}
          onAddSlots={handleAddSlots}
          error={slotError}
          c={c}
        />
        <SlotCreatedModal
          visible={showSlotCreated}
          onClose={() => setShowSlotCreated(false)}
          result={createdResult}
          c={c}
        />
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
          onPress={() => navigation.navigate(ROOT_ROUTES.LOGIN)}
          style={[appStyles.registerBtn, { backgroundColor: c.primary, paddingHorizontal: 40 }]}
        >
          <Text style={appStyles.registerBtnText}>{t('loginAction')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
