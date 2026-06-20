import React, { useState } from 'react';
import {
  Image, Pressable, RefreshControl, ScrollView,
  Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, TUNNEL_HEADERS } from '../../utils/app-utils';
import { TherapistTimeline } from '../../components/SlotComposer';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

export function TherapyTabTherapist({
  authToken, mySlots, slotsLoading, incomingBookings, incomingBookingsLoading,
  deletingSlotIds, activeFilterTherapist, setActiveFilterTherapist,
  therapyRefreshing, slotsLastLoadedAt, incomingBookingsLastLoadedAt,
  onRefresh, onLoadMySlots, onLoadIncomingBookings, onOpenTherapistById,
  onCancelSlot, onTherapistCancelRequest, onSelectTherapistDetailBooking, setShowSlotComposerModal,
  loggedInTherapist,
  onActivateBookingRequests,
  onOpenPatients,
  c, t, styles,
}) {
  const insets = useSafeAreaInsets();
  const slotBookingEnabled = loggedInTherapist?.bookingMode === 'FIRST_APPOINTMENT_REQUEST';
  const reviewApproved = loggedInTherapist?.reviewStatus === 'APPROVED';
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState('');
  const pendingIncomingBookings = incomingBookings.filter((r) => r.status === 'PENDING');
  const freeSlots = mySlots.filter(s => s.status === 'AVAILABLE');
  const bookedSlots = mySlots.filter(s => s.status === 'BOOKED');

  const handleRespond = async (id, body) => {
    const res = await fetch(`${getBaseUrl()}/bookings/${id}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? `Fehler ${res.status}`);
    }
    onLoadIncomingBookings(authToken);
    onLoadMySlots(authToken);
  };

  const handleTherapistCancel = (bookingId) => {
    onTherapistCancelRequest(bookingId);
  };

  const handleOpenDetail = (booking) => {
    onSelectTherapistDetailBooking(booking);
    onTherapistCancelRequest(booking.id);
  };

  const handleActivate = async () => {
    if (!onActivateBookingRequests || activationLoading) return;
    setActivationLoading(true);
    setActivationError('');
    const result = await onActivateBookingRequests();
    if (!result?.ok) {
      setActivationError(result?.message ?? 'Aktivierung fehlgeschlagen.');
    }
    setActivationLoading(false);
  };

  const FILTERS = [
    { key: 'all', label: 'Alle' },
    { key: 'booked', label: 'Gebucht' },
    { key: 'free', label: 'Frei' },
    { key: 'pending', label: 'Anfragen' },
  ];

  const nextFreeSlot = [...freeSlots].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
  const nextFreeSlotDate = nextFreeSlot ? new Date(nextFreeSlot.startsAt) : null;
  const nextFreeSlotIsToday = nextFreeSlotDate ? nextFreeSlotDate.toDateString() === new Date().toDateString() : false;
  const nextFreeSlotTime = nextFreeSlotDate
    ? nextFreeSlotDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;
  const nextFreeSlotDay = nextFreeSlotDate
    ? nextFreeSlotDate.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
    : null;

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../../../assets/icon.png')} style={styles.logoMark} />
          <Text style={[styles.headerTitle, { color: c.text, flex: 1 }]}>{'Meine Termine'}</Text>
          <Pressable onPress={() => onOpenPatients?.()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Ionicons name="people-outline" size={18} color={c.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 90, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {slotBookingEnabled ? (
          <>
            {/* ── Summary-Card ───────────────────────────────────── */}
            <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 }}>
              <Pressable
                onPress={() => setActiveFilterTherapist('free')}
                style={{ flex: 1, paddingRight: 12, borderRightWidth: 1, borderRightColor: c.border }}
              >
                <Text style={{ fontSize: 24, fontWeight: '800', color: c.success ?? '#5A9E8E' }}>{freeSlots.length}</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>Frei</Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveFilterTherapist('booked')}
                style={{ flex: 1, paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: c.border }}
              >
                <Text style={{ fontSize: 24, fontWeight: '800', color: c.text }}>{bookedSlots.length}</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>Gebucht</Text>
              </Pressable>
              <View style={{ flex: 1.3, paddingLeft: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Nächster Slot</Text>
                {nextFreeSlotTime ? (
                  nextFreeSlotIsToday ? (
                    <Text style={{ fontSize: 18, fontWeight: '800', color: c.text, marginTop: 6 }}>{nextFreeSlotTime} Uhr</Text>
                  ) : (
                    <>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: c.muted, marginTop: 4 }}>{nextFreeSlotDay}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: c.text, marginTop: 1 }}>{nextFreeSlotTime} Uhr</Text>
                    </>
                  )
                ) : (
                  <Text style={{ fontSize: 18, fontWeight: '800', color: c.text, marginTop: 6 }}>–</Text>
                )}
              </View>
            </View>

            {/* ── Segment-Tabs ──────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 16 }}>
              {FILTERS.map(({ key, label }) => {
                const active = activeFilterTherapist === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setActiveFilterTherapist(key)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: active ? (c.success ?? '#5A9E8E') : 'transparent' }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? c.text : c.muted }}>{label}</Text>
                    {key === 'pending' && pendingIncomingBookings.length > 0 && (
                      <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.warning ?? '#8A6000', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{pendingIncomingBookings.length}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* ── Timeline ────────────────────────────────────────── */}
            <TherapistTimeline
              c={c}
              mySlots={mySlots}
              incomingBookings={incomingBookings}
              activeFilter={activeFilterTherapist}
              deletingSlotIds={deletingSlotIds}
              onCancelSlot={onCancelSlot}
              onRespond={handleRespond}
              onTherapistCancel={handleTherapistCancel}
              onOpenDetail={handleOpenDetail}
              slotsLoading={shouldShowSectionLoading(slotsLoading, slotsLastLoadedAt)}
              incomingLoading={shouldShowSectionLoading(incomingBookingsLoading, incomingBookingsLastLoadedAt)}
            />
          </>
        ) : (
          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 20 }]}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>Terminanfragen sind noch nicht aktiviert.</Text>
              <Text style={[styles.emptyBody, { color: c.muted }]}>
                {reviewApproved
                  ? 'Du kannst Terminanfragen jetzt direkt hier aktivieren und danach sofort Slots anlegen.'
                  : 'Dein Profil wird noch geprüft. Sobald es freigegeben ist, kannst du Terminanfragen hier aktivieren.'}
              </Text>
              <Pressable
                onPress={handleActivate}
                disabled={!reviewApproved || activationLoading}
                style={{
                  marginTop: 16,
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  alignItems: 'center',
                  backgroundColor: reviewApproved ? c.primary : c.border,
                }}
              >
                <Text style={{ color: reviewApproved ? '#fff' : c.muted, fontSize: 14, fontWeight: '700' }}>
                  {activationLoading
                    ? 'Wird aktiviert…'
                    : reviewApproved
                    ? 'Terminanfragen aktivieren'
                    : 'Wartet auf Profilprüfung'}
                </Text>
              </Pressable>
              {!!activationError && (
                <Text style={{ marginTop: 10, fontSize: 13, color: c.error, textAlign: 'center' }}>
                  {activationError}
                </Text>
              )}
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── FAB ─────────────────────────────────────────────────────── */}
      {slotBookingEnabled && (
        <Pressable
          onPress={() => setShowSlotComposerModal(true)}
          style={{ position: 'absolute', bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: c.success ?? '#5A9E8E', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}
