import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation, Modal, Pressable, RefreshControl, ScrollView, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS } from '../../utils/app-utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeilmittelSelectModal } from '../../modals/HeilmittelSelectModal';
import { TherapistWeekStrip } from '../../components/TherapistWeekStrip';
import { TherapistDayTimeline } from '../../components/TherapistDayTimeline';
import { TherapistCalendarGrid } from '../../components/TherapistCalendarGrid';
import { TherapistActivationPrompt } from '../../components/TherapistActivationPrompt';
import { TherapistFilteredSlotsScreen } from './TherapistFilteredSlotsScreen';
import { useBookingActivation } from '../../hooks/use-booking-activation';
import { useTherapistCalendarView } from '../../hooks/use-therapist-calendar-view';
import { useTherapistScheduleData } from '../../hooks/use-therapist-schedule-data';
import { useTherapistServices } from '../../hooks/use-therapist-services';

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
  const [showStatsModal, setShowStatsModal] = useState(false);

  const activation = useBookingActivation({ onActivateBookingRequests });
  const calendarView = useTherapistCalendarView();
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const calendarCollapsedRef = useRef(false);

  // Beim Wechsel in Kalenderansicht immer aufklappen.
  useEffect(() => {
    if (calendarView.viewMode === 'calendar') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCalendarCollapsed(false);
      calendarCollapsedRef.current = false;
    }
  }, [calendarView.viewMode]);

  // Scroll-Handler: klappt Kalender zu/auf wenn Schwelle überschritten wird.
  const onCalendarScroll = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    const shouldCollapse = y > 60;
    if (shouldCollapse !== calendarCollapsedRef.current) {
      calendarCollapsedRef.current = shouldCollapse;
      LayoutAnimation.configureNext({
        duration: 220,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });
      setCalendarCollapsed(shouldCollapse);
    }
  }, []);

  // Datum-Wahl: Kalender aufklappen damit die neue Woche im Monat sichtbar ist.
  const handleSelectCalendarDate = useCallback((date) => {
    if (calendarCollapsedRef.current) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCalendarCollapsed(false);
      calendarCollapsedRef.current = false;
    }
    calendarView.handleSelectCalendarDate(date);
  }, [calendarView]);

  // Kalender-Icon im WeekStrip (Collapsed-Zustand) → aufklappen.
  const handleExpandCalendar = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCalendarCollapsed(false);
    calendarCollapsedRef.current = false;
  }, []);

  // Arbeitszeiten und Blockzeiten laden — Grundlage für die Tagesansicht.
  const { workingHoursRules, blockedTimes } = useTherapistScheduleData({ authToken });
  // Leistungsfarben laden fuer Timeline- und Kalender-Einfaerbung.
  const { servicesByKey } = useTherapistServices({ authToken });

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
  const isCalendarMode = bookingEnabled && calendarView.viewMode === 'calendar';

  return (
    <View style={{ flex: 1 }}>
      {/* WeekStrip fixiert oben (Listenansicht) */}
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
            onPressStats={() => setShowStatsModal(true)}
          />
        </View>
      )}

      {isCalendarMode ? (
        // KALENDERANSICHT: Monatsraster als kollabierender Header, Tagesinhalt scrollt darunter.
        <>
          <View style={{ paddingTop: insets.top + 12, backgroundColor: c.background }}>
            <TherapistCalendarGrid
              c={c}
              incomingBookings={incomingBookings}
              workingHoursRules={workingHoursRules}
              selectedDate={calendarView.selectedDate}
              onSelectDate={handleSelectCalendarDate}
              visibleMonth={calendarView.visibleMonth}
              onPrevMonth={calendarView.handlePrevMonth}
              onNextMonth={calendarView.handleNextMonth}
              onPressList={calendarView.handleShowList}
              onPressToday={calendarView.handleGoToToday}
              collapsed={calendarCollapsed}
              visibleWeekStart={calendarView.visibleWeekStart}
              onPrevWeek={calendarView.handlePrevWeek}
              onNextWeek={calendarView.handleNextWeek}
              onPressCalendar={handleExpandCalendar}
            />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24, paddingTop: 8 }]}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={onCalendarScroll}
            refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          >
            <TherapistDayTimeline
              c={c}
              selectedDate={calendarView.selectedDate}
              incomingBookings={incomingBookings}
              workingHoursRules={workingHoursRules}
              blockedTimes={blockedTimes}
              incomingBookingsLoading={incomingBookingsLoading}
              incomingBookingsLastLoadedAt={incomingBookingsLastLoadedAt}
              onOpenBooking={onOpenBookingDetail}
              servicesByKey={servicesByKey}
            />
          </ScrollView>
        </>
      ) : (
        // LISTENANSICHT / DEAKTIVIERT: normaler ScrollView
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 8, paddingTop: isListView ? 8 : insets.top + 12 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        >
          {bookingEnabled ? (
            <TherapistDayTimeline
              c={c}
              selectedDate={calendarView.selectedDate}
              incomingBookings={incomingBookings}
              workingHoursRules={workingHoursRules}
              blockedTimes={blockedTimes}
              incomingBookingsLoading={incomingBookingsLoading}
              incomingBookingsLastLoadedAt={incomingBookingsLastLoadedAt}
              onOpenBooking={onOpenBookingDetail}
              servicesByKey={servicesByKey}
            />
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
      )}

      <Modal
        visible={showStatsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
          onPress={() => setShowStatsModal(false)}
        >
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: c.background, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: 24, paddingBottom: insets.bottom + 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: c.text }}>Statistik</Text>
                <Pressable onPress={() => setShowStatsModal(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={c.muted} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => { setShowStatsModal(false); setFilterListKind('booked'); }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.full, paddingVertical: 14 }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
                  <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>{confirmedCount}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Gebucht</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setShowStatsModal(false); setFilterListKind('pending'); }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.full, paddingVertical: 14 }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.warning ?? '#B78700' }} />
                  <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>{pendingCount}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Anfragen</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
