import React, { useEffect, useState } from 'react';
import { Ionicons, } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useNotificationPolling } from '../../hooks/use-notification-polling';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../mobile-translations';
import { ROOT_ROUTES } from '../../navigation/route-names';
import { SPACE, getBaseUrl, TUNNEL_HEADERS } from '../../mobile-utils';
import { TabHeader } from '../../components/TabHeader';
import { NotificationSheet } from '../../modals/NotificationSheet';
import { TherapyTabPatient, TherapyTabTherapist } from '../../mobile-therapy-tabs';
import { AppointmentDetail } from '../../mobile-appointment-detail';
import { CancelAppointmentModal } from '../../mobile-cancel-appointment-modal';
import { TherapistCancelModal } from '../../mobile-therapist-cancel-modal';
import { SlotComposerModal } from '../../mobile-slot-composer-modal';
import { SlotCreatedModal } from '../../mobile-slot-created-modal';
import { useTherapyData } from '../../context/TherapyContext';

const t = (key) => translations.de[key] ?? key;

export function TherapyTabScreen() {
  const navigation = useNavigation();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);
  const loggedInTherapist = useAppStore(appStoreSelectors.loggedInTherapist);

  const { c } = useTheme();

  const {
    myAppointments, myAppointmentsLoading, appointmentsLastLoadedAt,
    incomingBookings, incomingBookingsLoading, incomingBookingsLastLoadedAt,
    mySlots, slotsLoading, deletingSlotIds, slotsLastLoadedAt,
    therapyRefreshing,
    loadMyAppointments, loadIncomingBookings, loadMySlots,
    handleTherapyRefresh,
  } = useTherapyData();

  const {
    notifications, dismissedNotifIds,
    showNotifications, setShowNotifications,
    dismissNotification, dismissAllNotifications,
  } = useNotificationPolling({ authToken, accountType });

  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [activeFilterPatient, setActiveFilterPatient] = useState('all');
  const [activeFilterTherapist, setActiveFilterTherapist] = useState('all');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showTherapistCancelModal, setShowTherapistCancelModal] = useState(false);
  const [therapistCancelBookingId, setTherapistCancelBookingId] = useState(null);
  const [showSlotComposer, setShowSlotComposer] = useState(false);
  const [createdSlot, setCreatedSlot] = useState(null);
  const [showSlotCreated, setShowSlotCreated] = useState(false);

  useEffect(() => {
    if (!authToken) return;
    if (accountType === 'patient') loadMyAppointments(authToken);
    if (accountType === 'therapist') {
      loadMySlots(authToken);
      loadIncomingBookings(authToken);
    }
  }, [authToken, accountType]);

  const openTherapistById = (id, fallback = null) => {
    navigation.navigate(ROOT_ROUTES.THERAPIST_PROFILE, { therapistId: id, therapist: fallback });
  };

  const handleAddSlot = async (slot) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ slots: [slot] }),
      });
      if (res.ok) {
        setCreatedSlot(slot);
        setShowSlotCreated(true);
      }
      await loadMySlots(authToken);
    } catch {}
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
          notifications={notifications}
          dismissedNotifIds={dismissedNotifIds}
          onShowNotifications={() => setShowNotifications(true)}
          onRefresh={() => handleTherapyRefresh(authToken, accountType, loggedInTherapist)}
          onOpenTherapistById={openTherapistById}
          onSelectAppointment={setSelectedAppointment}
          c={c} t={t} styles={appStyles}
        />
        <NotificationSheet
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          dismissedNotifIds={dismissedNotifIds}
          dismissNotification={dismissNotification}
          dismissAllNotifications={dismissAllNotifications}
          onPressNotification={() => setShowNotifications(false)}
          c={c} t={t}
        />
      </>
    );
  }

  if (accountType === 'therapist') {
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
          notifications={notifications}
          dismissedNotifIds={dismissedNotifIds}
          onShowNotifications={() => setShowNotifications(true)}
          onCancelSlot={handleCancelSlot}
          onTherapistCancelRequest={(id) => { setTherapistCancelBookingId(id); setShowTherapistCancelModal(true); }}
          onSelectTherapistDetailBooking={(booking) => { setTherapistCancelBookingId(booking.id); setShowTherapistCancelModal(true); }}
          setShowSlotComposerModal={setShowSlotComposer}
          loggedInTherapist={loggedInTherapist}
          c={c} t={t} styles={appStyles}
        />
        <NotificationSheet
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          dismissedNotifIds={dismissedNotifIds}
          dismissNotification={dismissNotification}
          dismissAllNotifications={dismissAllNotifications}
          onPressNotification={() => setShowNotifications(false)}
          c={c} t={t}
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
          onClose={() => setShowSlotComposer(false)}
          onAddSlot={handleAddSlot}
          c={c}
        />
        <SlotCreatedModal
          visible={showSlotCreated}
          onClose={() => setShowSlotCreated(false)}
          slot={createdSlot}
          c={c}
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TabHeader c={c} title="Meine Termine" />
      <ScrollView
        contentContainerStyle={[appStyles.scrollContent, { paddingBottom: 20, paddingTop: SPACE.sm }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[appStyles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="calendar-outline" size={32} color={c.muted} />
          <Text style={[appStyles.emptyTitle, { color: c.text }]}>
            {t('therapyLoginRequired') ?? 'Hier kannst du deine Termine sehen'}
          </Text>
          <Text style={[appStyles.emptyBody, { color: c.muted }]}>
            {t('therapyLoginRequiredBody') ?? 'Dafür musst du dich registrieren oder anmelden.'}
          </Text>
          <Pressable
            onPress={() => navigation.navigate(ROOT_ROUTES.AUTH)}
            style={[appStyles.registerBtn, { backgroundColor: c.primary, marginTop: 16, paddingHorizontal: 32 }]}
          >
            <Text style={appStyles.registerBtnText}>{t('loginAction')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
