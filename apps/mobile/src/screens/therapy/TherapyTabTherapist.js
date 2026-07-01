import React, { useMemo, useState } from 'react';
import {
  RefreshControl, ScrollView, View,
} from 'react-native';
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

// Therapeuten-Tab "Termine": zeigt die Termine (Buchungen) im Kalender.
// Verfügbarkeit wird nicht mehr hier verwaltet, sondern im Profil über
// Arbeitszeiten / Leistungen / Blockzeiten (dynamisches Buchungssystem).
export function TherapyTabTherapist({
  incomingBookings, incomingBookingsLoading,
  therapyRefreshing, incomingBookingsLastLoadedAt,
  onRefresh, onOpenBookingDetail, onSelectTherapistDetailBooking, onTherapistCancelRequest,
  loggedInTherapist,
  onActivateBookingRequests,
  heilmittelOptions,
  c, t, styles,
}) {
  const bookingEnabled = loggedInTherapist?.bookingMode === 'FIRST_APPOINTMENT_REQUEST';
  const reviewApproved = loggedInTherapist?.reviewStatus === 'APPROVED';
  const [filterListKind, setFilterListKind] = useState(null); // null | 'booked' | 'pending'

  const activation = useBookingActivation({ onActivateBookingRequests });
  const calendarView = useTherapistCalendarView();

  const pendingCount = useMemo(
    () => incomingBookings.filter((r) => r.status === 'PENDING').length,
    [incomingBookings],
  );
  const confirmedCount = useMemo(
    () => incomingBookings.filter((b) => b.status === 'CONFIRMED').length,
    [incomingBookings],
  );

  const handleOpenDetail = (booking) => {
    onSelectTherapistDetailBooking(booking);
    onTherapistCancelRequest(booking.id);
  };

  if (filterListKind) {
    return (
      <TherapistFilteredSlotsScreen
        filterListKind={filterListKind}
        incomingBookings={incomingBookings}
        onClose={() => setFilterListKind(null)}
        onOpenDetail={handleOpenDetail}
        incomingBookingsLoading={incomingBookingsLoading}
        incomingBookingsLastLoadedAt={incomingBookingsLastLoadedAt}
        c={c}
        styles={styles}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AccountHeader c={c} subtitle="Termine" />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <TherapistSummaryCard
          c={c}
          confirmedCount={confirmedCount}
          pendingCount={pendingCount}
          onPressBooked={() => setFilterListKind('booked')}
          onPressPending={() => setFilterListKind('pending')}
        />

        {bookingEnabled ? (
          calendarView.viewMode === 'calendar' ? (
            <TherapistMonthCalendar
              c={c}
              incomingBookings={incomingBookings}
              selectedDate={calendarView.selectedDate}
              onSelectDate={calendarView.handleSelectCalendarDate}
              visibleMonth={calendarView.visibleMonth}
              onPrevMonth={calendarView.handlePrevMonth}
              onNextMonth={calendarView.handleNextMonth}
              onPressList={calendarView.handleShowList}
              onPressToday={calendarView.handleGoToToday}
              onOpenBooking={onOpenBookingDetail}
            />
          ) : (
            <>
              <TherapistWeekStrip
                c={c}
                selectedDate={calendarView.selectedDate}
                visibleWeekStart={calendarView.visibleWeekStart}
                incomingBookings={incomingBookings}
                onSelectDate={calendarView.setSelectedDate}
                onPrevWeek={calendarView.handlePrevWeek}
                onNextWeek={calendarView.handleNextWeek}
                onPressCalendar={calendarView.handleOpenCalendar}
                onPressToday={calendarView.handleGoToToday}
              />

              <TherapistDayTimeline
                c={c}
                selectedDate={calendarView.selectedDate}
                incomingBookings={incomingBookings}
                incomingBookingsLoading={incomingBookingsLoading}
                incomingBookingsLastLoadedAt={incomingBookingsLastLoadedAt}
                onOpenBooking={onOpenBookingDetail}
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
