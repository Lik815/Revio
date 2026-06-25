import React, { useMemo, useState } from 'react';
import {
  Pressable, RefreshControl, ScrollView,
  Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, startOfDay, startOfWeek } from '../../utils/app-utils';
import { AccountHeader } from '../../components/AccountHeader';
import { HeilmittelSelectModal } from '../../modals/HeilmittelSelectModal';
import { TherapistSummaryCard } from '../../components/TherapistSummaryCard';
import { TherapistWeekStrip } from '../../components/TherapistWeekStrip';
import { TherapistDayTimeline } from '../../components/TherapistDayTimeline';
import { TherapistMonthCalendar } from '../../components/TherapistMonthCalendar';
import { TherapistTimeline } from '../../components/SlotComposer';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

const FILTER_LIST_TITLES = {
  free: 'Freie Termine',
  booked: 'Gebuchte Termine',
  pending: 'Anfragen',
};

export function TherapyTabTherapist({
  mySlots, slotsLoading, incomingBookings, incomingBookingsLoading,
  deletingSlotIds,
  therapyRefreshing, slotsLastLoadedAt, incomingBookingsLastLoadedAt,
  onRefresh, onOpenTherapistById,
  onCancelSlot, onRespond, onTherapistCancelRequest, onSelectTherapistDetailBooking, setShowSlotComposerModal,
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
  const [filterListKind, setFilterListKind] = useState(null); // null | 'free' | 'booked' | 'pending'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [visibleMonth, setVisibleMonth] = useState(() => ({
    year: startOfDay(new Date()).getFullYear(),
    month: startOfDay(new Date()).getMonth(),
  }));

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

  const handleOpenCalendar = () => {
    setVisibleMonth({ year: selectedDate.getFullYear(), month: selectedDate.getMonth() });
    setViewMode('calendar');
  };

  const handleSelectCalendarDate = (date) => {
    setSelectedDate(startOfDay(date));
    setVisibleWeekStart(startOfWeek(date));
  };

  const handlePrevMonth = () => {
    setVisibleMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const handleNextMonth = () => {
    setVisibleMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const handleTherapistCancel = (bookingId) => {
    onTherapistCancelRequest(bookingId);
  };

  const handleOpenDetail = (booking) => {
    onSelectTherapistDetailBooking(booking);
    onTherapistCancelRequest(booking.id);
  };

  if (filterListKind) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, backgroundColor: c.background }}>
          <Pressable
            onPress={() => setFilterListKind(null)}
            style={{ alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Ionicons name="chevron-back" size={16} color={c.primary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Zurück</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.text }]}>{FILTER_LIST_TITLES[filterListKind]}</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: 8 }]}
          showsVerticalScrollIndicator={false}
        >
          <TherapistTimeline
            c={c}
            mySlots={mySlots}
            incomingBookings={incomingBookings}
            activeFilter={filterListKind}
            deletingSlotIds={deletingSlotIds}
            onCancelSlot={onCancelSlot}
            onRespond={onRespond}
            onTherapistCancel={handleTherapistCancel}
            onOpenDetail={handleOpenDetail}
            slotsLoading={shouldShowSectionLoading(slotsLoading, slotsLastLoadedAt)}
            incomingLoading={shouldShowSectionLoading(incomingBookingsLoading, incomingBookingsLastLoadedAt)}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AccountHeader
        c={c}
        subtitle="Termine"
        rightSlot={slotBookingEnabled ? (
          <Pressable
            onPress={() => setShowSlotComposerModal(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 }}
          >
            <Ionicons name="calendar-outline" size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>+ Termin</Text>
          </Pressable>
        ) : null}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <TherapistSummaryCard
          c={c}
          freeCount={freeSlots.length}
          confirmedCount={confirmedBookingsCount}
          pendingCount={pendingIncomingBookings.length}
          onPressFree={() => setFilterListKind('free')}
          onPressBooked={() => setFilterListKind('booked')}
          onPressPending={() => setFilterListKind('pending')}
        />

        {slotBookingEnabled ? (
          viewMode === 'calendar' ? (
            <TherapistMonthCalendar
              c={c}
              mySlots={mySlots}
              incomingBookings={incomingBookings}
              selectedDate={selectedDate}
              onSelectDate={handleSelectCalendarDate}
              visibleMonth={visibleMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onPressList={() => setViewMode('list')}
              onOpenBooking={onOpenBookingDetail}
              onCancelSlot={onCancelSlot}
              deletingSlotIds={deletingSlotIds}
              onAddSlot={() => setShowSlotComposerModal(true)}
            />
          ) : (
            <>
              <TherapistWeekStrip
                c={c}
                selectedDate={selectedDate}
                visibleWeekStart={visibleWeekStart}
                mySlots={mySlots}
                onSelectDate={setSelectedDate}
                onPrevWeek={() => setVisibleWeekStart((prev) => addDays(prev, -7))}
                onNextWeek={() => setVisibleWeekStart((prev) => addDays(prev, 7))}
                onPressCalendar={handleOpenCalendar}
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
          )
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
