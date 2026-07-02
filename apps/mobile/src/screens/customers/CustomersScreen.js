import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTherapyData } from '../../context/TherapyContext';
import { useTheme } from '../../hooks/use-theme';
import { translations } from '../../i18n/translations';
import { getBaseUrl, TUNNEL_HEADERS } from '../../utils/app-utils';
import { AccountHeader } from '../../components/AccountHeader';
import { PatientsPane } from '../therapy/TherapistPatientsScreen';
import { TherapistPatientDetailScreen } from '../therapy/TherapistPatientDetailScreen';
import { TherapistAppointmentDetail } from '../therapy/TherapistAppointmentDetail';
import { TherapistCancelModal } from '../../modals/TherapistCancelModal';
import { markTap } from '../../utils/perf-log';

const t = (key) => translations.de[key] ?? key;

// Therapist-only tab (takes the Favoriten slot in the bottom nav — therapists
// have no use for a favorites list). Reuses the same PatientsPane/
// TherapistPatientDetailScreen pair already used from inside the Therapie tab,
// so the list, search/filter, and detail view all stay in sync everywhere.
export function CustomersTabScreen() {
  const { c } = useTheme();
  const { authToken, accountType, loggedInTherapist } = useAuth();
  const {
    patients, patientsLoading, patientsLastLoadedAt,
    loadPatients, therapyRefreshing, handleTherapyRefresh,
    incomingBookings, setIncomingBookings,
  } = useTherapyData();

  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState(null);

  const handleRespond = async (bookingId, body) => {
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

  const handleCancelConfirm = async (reason) => {
    setShowCancelModal(false);
    if (!cancelBookingId) return;
    const res = await fetch(`${getBaseUrl()}/bookings/${cancelBookingId}/therapist-cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ cancelReason: reason }),
    });
    if (res.ok) {
      const updated = await res.json().catch(() => null);
      setIncomingBookings((prev) => prev.map((b) => (
        b.id === cancelBookingId ? { ...b, ...(updated ?? { status: 'CANCELLED' }) } : b
      )));
    } else {
      const data = await res.json().catch(() => ({}));
      Alert.alert('Absagen fehlgeschlagen', data.error ?? 'Bitte versuche es erneut.');
    }
    setCancelBookingId(null);
  };

  // This tab can now be opened without ever visiting the Therapie tab first,
  // so it can't rely on that screen's effect to have loaded patients already.
  // Refreshing on every focus (not just mount) means a confirmed booking or new
  // patient shows up as soon as the tab is revisited, without a restart.
  useFocusEffect(
    useCallback(() => {
      if (authToken) loadPatients(authToken, { background: true });
    }, [authToken, loadPatients]),
  );

  if (selectedPatientId) {
    return (
      <>
        <TherapistPatientDetailScreen
          authToken={authToken}
          patientId={selectedPatientId}
          onBack={() => setSelectedPatientId(null)}
          onSelectAppointment={(appointment, patient) => {
            markTap(appointment.id);
            const live = incomingBookings.find((b) => b.id === appointment.id) ?? appointment;
            setSelectedBooking({ appointment: live, patient });
          }}
          c={c}
        />
        <Modal
          visible={!!selectedBooking}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedBooking(null)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <Pressable style={{ flex: 1 }} onPress={() => setSelectedBooking(null)} />
            <View style={{ height: '92%' }}>
              {selectedBooking && (
                <TherapistAppointmentDetail
                  appointment={selectedBooking.appointment}
                  patient={selectedBooking.patient}
                  onBack={() => setSelectedBooking(null)}
                  onRespond={handleRespond}
                  onCancelRequest={() => {
                    setCancelBookingId(selectedBooking.appointment.id);
                    setShowCancelModal(true);
                    setSelectedBooking(null);
                  }}
                  isModal
                  c={c}
                />
              )}
            </View>
          </View>
        </Modal>
        <TherapistCancelModal
          visible={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleCancelConfirm}
          booking={incomingBookings.find((b) => b.id === cancelBookingId) ?? null}
          c={c}
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AccountHeader c={c} subtitle={t('customersTitle')} />
      <PatientsPane
        patients={patients}
        patientsLoading={patientsLoading}
        patientsLastLoadedAt={patientsLastLoadedAt}
        onSelectPatient={setSelectedPatientId}
        c={c}
        therapyRefreshing={therapyRefreshing}
        onRefresh={() => handleTherapyRefresh(authToken, accountType, loggedInTherapist)}
      />
    </View>
  );
}
