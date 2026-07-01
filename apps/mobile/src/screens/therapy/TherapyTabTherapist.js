import React, { useEffect, useMemo, useState } from 'react';
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
import { getBaseUrl, TUNNEL_HEADERS } from '../../utils/app-utils';

export function TherapyTabTherapist({
  authToken,
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
  const [filterListKind, setFilterListKind] = useState(null);

  const activation = useBookingActivation({ onActivateBookingRequests });
  const calendarView = useTherapistCalendarView();

  // Arbeitszeiten und Blockzeiten laden — Grundlage für die Tagesansicht.
  const [workingHoursRules, setWorkingHoursRules] = useState([]);
  const [blockedTimes, setBlockedTimes] = useState([]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;

    fetch(`${getBaseUrl()}/therapist/working-hours`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    })
      .then((r) => (r.ok ? r.json() : { rules: [] }))
      .then((d) => { if (!cancelled) setWorkingHoursRules(d.rules ?? []); })
      .catch(() => {});

    const from = new Date();
    from.setDate(from.getDate() - 7);
    const to = new Date();
    to.setDate(to.getDate() + 90);
    fetch(
      `${getBaseUrl()}/therapist/blocked-times?from=${from.toISOString()}&to=${to.toISOString()}`,
      { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` } },
    )
      .then((r) => (r.ok ? r.json() : { blockedTimes: [] }))
      .then((d) => { if (!cancelled) setBlockedTimes(d.blockedTimes ?? []); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [authToken]);

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
              workingHoursRules={workingHoursRules}
              blockedTimes={blockedTimes}
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
                workingHoursRules={workingHoursRules}
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
                workingHoursRules={workingHoursRules}
                blockedTimes={blockedTimes}
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
