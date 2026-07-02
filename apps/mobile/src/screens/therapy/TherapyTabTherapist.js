import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl, ScrollView, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  const insets = useSafeAreaInsets();

  const handleOpenDetail = (booking) => {
    onOpenBookingDetail(booking);
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

  const isListView = bookingEnabled && calendarView.viewMode !== 'calendar';

  return (
    <View style={{ flex: 1 }}>
      {/* WeekStrip fixiert oben — scrollt nicht mit */}
      {isListView && (
        <View style={{ paddingTop: insets.top + 12, backgroundColor: c.background, paddingHorizontal: 24 }}>
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
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 8, paddingTop: isListView ? 8 : insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
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

      {/* Gebucht / Anfragen — im normalen Flow ganz unten */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <TherapistSummaryCard
          c={c}
          confirmedCount={confirmedCount}
          pendingCount={pendingCount}
          onPressBooked={() => setFilterListKind('booked')}
          onPressPending={() => setFilterListKind('pending')}
        />
      </View>

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
