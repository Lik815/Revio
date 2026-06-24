import React, { useMemo, useState } from 'react';
import {
  Image, Pressable, RefreshControl, ScrollView,
  Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, startOfDay, startOfWeek } from '../../utils/app-utils';
import { HeilmittelSelectModal } from '../../modals/HeilmittelSelectModal';
import { TherapistSummaryCard } from '../../components/TherapistSummaryCard';
import { TherapistWeekStrip } from '../../components/TherapistWeekStrip';
import { TherapistDayTimeline } from '../../components/TherapistDayTimeline';

export function TherapyTabTherapist({
  mySlots, slotsLoading, incomingBookings, incomingBookingsLoading,
  deletingSlotIds,
  therapyRefreshing, slotsLastLoadedAt, incomingBookingsLastLoadedAt,
  onRefresh, onOpenTherapistById,
  onCancelSlot, setShowSlotComposerModal,
  onOpenBookingDetail,
  loggedInTherapist,
  onActivateBookingRequests,
  heilmittelOptions,
  c, t, styles,
}) {
  const insets = useSafeAreaInsets();
  const slotBookingEnabled = loggedInTherapist?.bookingMode === 'FIRST_APPOINTMENT_REQUEST';
  const reviewApproved = loggedInTherapist?.reviewStatus === 'APPROVED';
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [showHeilmittelModal, setShowHeilmittelModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => startOfWeek(new Date()));

  const pendingIncomingBookings = useMemo(
    () => incomingBookings.filter((r) => r.status === 'PENDING'),
    [incomingBookings],
  );
  const freeSlots = useMemo(() => mySlots.filter(s => s.status === 'AVAILABLE'), [mySlots]);
  const confirmedBookingsCount = useMemo(
    () => incomingBookings.filter((b) => b.status === 'CONFIRMED').length,
    [incomingBookings],
  );

  const handleActivate = () => {
    setActivationError('');
    setShowHeilmittelModal(true);
  };

  const handleConfirmHeilmittel = async (selectedHeilmittel) => {
    if (!onActivateBookingRequests || activationLoading) return;
    setActivationLoading(true);
    setActivationError('');
    const result = await onActivateBookingRequests(selectedHeilmittel);
    setActivationLoading(false);
    if (!result?.ok) {
      setActivationError(result?.message ?? 'Aktivierung fehlgeschlagen.');
      return;
    }
    setShowHeilmittelModal(false);
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setSelectedDate(startOfDay(today));
    setVisibleWeekStart(startOfWeek(today));
  };

  // Stats-card taps jump the week strip + selected day to the next upcoming
  // day that actually has a slot of that kind — there's no separate filtered
  // list view to land on anymore, so "focus free/booked/Anfragen" means this.
  const jumpToNextDayWithKind = (kind) => {
    const bookingBySlotId = {};
    incomingBookings.forEach((b) => { if (b.slotId) bookingBySlotId[b.slotId] = b; });
    const today = startOfDay(new Date());

    const matchingDates = mySlots
      .filter((s) => {
        if (s.status === 'CANCELLED') return false;
        if (kind === 'free') return s.status === 'AVAILABLE';
        const booking = bookingBySlotId[s.id];
        if (kind === 'booked') return s.status === 'BOOKED' && booking?.status === 'CONFIRMED';
        if (kind === 'pending') return s.status === 'BOOKED' && booking?.status === 'PENDING';
        return false;
      })
      .map((s) => startOfDay(new Date(s.startsAt)))
      .filter((d) => d >= today)
      .sort((a, b) => a - b);

    const target = matchingDates[0];
    if (!target) return;
    setSelectedDate(target);
    setVisibleWeekStart(startOfWeek(target));
  };

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../../../assets/icon.png')} style={styles.logoMark} />
          <Text style={[styles.headerTitle, { color: c.text, flex: 1 }]}>{'Meine Übersicht'}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 90, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <TherapistSummaryCard
          c={c}
          freeCount={freeSlots.length}
          confirmedCount={confirmedBookingsCount}
          pendingCount={pendingIncomingBookings.length}
          onPressFree={() => jumpToNextDayWithKind('free')}
          onPressBooked={() => jumpToNextDayWithKind('booked')}
          onPressPending={() => jumpToNextDayWithKind('pending')}
        />

        {slotBookingEnabled ? (
          <>
            <TherapistWeekStrip
              c={c}
              selectedDate={selectedDate}
              visibleWeekStart={visibleWeekStart}
              mySlots={mySlots}
              onSelectDate={setSelectedDate}
              onPrevWeek={() => setVisibleWeekStart((prev) => addDays(prev, -7))}
              onNextWeek={() => setVisibleWeekStart((prev) => addDays(prev, 7))}
              onPressCalendar={handleJumpToToday}
            />

            <TherapistDayTimeline
              c={c}
              selectedDate={selectedDate}
              mySlots={mySlots}
              incomingBookings={incomingBookings}
              slotsLoading={slotsLoading}
              slotsLastLoadedAt={slotsLastLoadedAt}
              incomingBookingsLoading={incomingBookingsLoading}
              incomingBookingsLastLoadedAt={incomingBookingsLastLoadedAt}
              deletingSlotIds={deletingSlotIds}
              onOpenBooking={onOpenBookingDetail}
              onCancelSlot={onCancelSlot}
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

      <HeilmittelSelectModal
        visible={showHeilmittelModal}
        onClose={() => setShowHeilmittelModal(false)}
        onConfirm={handleConfirmHeilmittel}
        options={Array.isArray(heilmittelOptions) ? heilmittelOptions : []}
        loading={activationLoading}
        error={activationError}
        c={c}
      />
    </View>
  );
}
