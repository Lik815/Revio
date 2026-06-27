import React, { useMemo, useState } from 'react';
import {
  Pressable, RefreshControl, ScrollView, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccountHeader } from '../../components/AccountHeader';
import { HeilmittelSelectModal } from '../../modals/HeilmittelSelectModal';
import { TherapistSummaryCard } from '../../components/TherapistSummaryCard';
import { TherapistWeekStrip } from '../../components/TherapistWeekStrip';
import { TherapistDayTimeline } from '../../components/TherapistDayTimeline';
import { TherapistMonthCalendar } from '../../components/TherapistMonthCalendar';
import { TherapistActivationPrompt } from '../../components/TherapistActivationPrompt';
import { TherapistFilteredSlotsScreen } from './TherapistFilteredSlotsScreen';
import { useBookingActivation } from '../../hooks/use-booking-activation';
import { useTherapistCalendarView } from '../../hooks/use-therapist-calendar-view';

export function TherapyTabTherapist({
  mySlots, slotsLoading, incomingBookings, incomingBookingsLoading,
  deletingSlotIds,
  therapyRefreshing, slotsLastLoadedAt, incomingBookingsLastLoadedAt,
  onRefresh, onOpenTherapistById,
  onCancelSlot, onBulkDeleteSlots, onRespond, onTherapistCancelRequest, onSelectTherapistDetailBooking, setShowSlotComposerModal,
  onOpenBookingDetail,
  loggedInTherapist,
  onActivateBookingRequests,
  heilmittelOptions,
  authToken,
  c, t, styles,
}) {
  const slotBookingEnabled = loggedInTherapist?.bookingMode === 'FIRST_APPOINTMENT_REQUEST';
  const reviewApproved = loggedInTherapist?.reviewStatus === 'APPROVED';
  const [filterListKind, setFilterListKind] = useState(null); // null | 'free' | 'booked' | 'pending'

  const activation = useBookingActivation({ onActivateBookingRequests });
  const calendarView = useTherapistCalendarView();

  const pendingIncomingBookings = useMemo(
    () => incomingBookings.filter((r) => r.status === 'PENDING'),
    [incomingBookings],
  );
  const freeSlots = useMemo(() => mySlots.filter(s => s.status === 'AVAILABLE'), [mySlots]);
  const confirmedBookingsCount = useMemo(
    () => incomingBookings.filter((b) => b.status === 'CONFIRMED').length,
    [incomingBookings],
  );

  const handleTherapistCancel = (bookingId) => {
    onTherapistCancelRequest(bookingId);
  };

  const handleOpenDetail = (booking) => {
    onSelectTherapistDetailBooking(booking);
    onTherapistCancelRequest(booking.id);
  };

  if (filterListKind) {
    return (
      <TherapistFilteredSlotsScreen
        filterListKind={filterListKind}
        freeSlots={freeSlots}
        mySlots={mySlots}
        incomingBookings={incomingBookings}
        deletingSlotIds={deletingSlotIds}
        onClose={() => setFilterListKind(null)}
        onCancelSlot={onCancelSlot}
        onRespond={onRespond}
        onTherapistCancel={handleTherapistCancel}
        onOpenDetail={handleOpenDetail}
        onBulkDeleteSlots={onBulkDeleteSlots}
        slotsLoading={slotsLoading}
        incomingBookingsLoading={incomingBookingsLoading}
        slotsLastLoadedAt={slotsLastLoadedAt}
        incomingBookingsLastLoadedAt={incomingBookingsLastLoadedAt}
        c={c}
        styles={styles}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AccountHeader
        c={c}
        subtitle="Termine"
        rightSlot={slotBookingEnabled ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => setShowSlotComposerModal(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 }}
            >
              <Ionicons name="calendar-outline" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>+ Termin</Text>
            </Pressable>
          </View>
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
          calendarView.viewMode === 'calendar' ? (
            <TherapistMonthCalendar
              c={c}
              mySlots={mySlots}
              incomingBookings={incomingBookings}
              selectedDate={calendarView.selectedDate}
              onSelectDate={calendarView.handleSelectCalendarDate}
              visibleMonth={calendarView.visibleMonth}
              onPrevMonth={calendarView.handlePrevMonth}
              onNextMonth={calendarView.handleNextMonth}
              onPressList={calendarView.handleShowList}
              onOpenBooking={onOpenBookingDetail}
              onCancelSlot={onCancelSlot}
              deletingSlotIds={deletingSlotIds}
              onAddSlot={() => setShowSlotComposerModal(true)}
            />
          ) : (
            <>
              <TherapistWeekStrip
                c={c}
                selectedDate={calendarView.selectedDate}
                visibleWeekStart={calendarView.visibleWeekStart}
                mySlots={mySlots}
                onSelectDate={calendarView.setSelectedDate}
                onPrevWeek={calendarView.handlePrevWeek}
                onNextWeek={calendarView.handleNextWeek}
                onPressCalendar={calendarView.handleOpenCalendar}
              />

              <TherapistDayTimeline
                c={c}
                selectedDate={calendarView.selectedDate}
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
          <TherapistActivationPrompt
            reviewApproved={reviewApproved}
            activationLoading={activation.activationLoading}
            activationError={activation.activationError}
            onActivate={activation.handleActivate}
            c={c}
            styles={styles}
          />
        )}
      </ScrollView>

      <HeilmittelSelectModal
        visible={activation.showHeilmittelModal}
        onClose={activation.closeHeilmittelModal}
        onConfirm={activation.handleConfirmHeilmittel}
        options={Array.isArray(heilmittelOptions) ? heilmittelOptions : []}
        loading={activation.activationLoading}
        error={activation.activationError}
        c={c}
      />
    </View>
  );
}
