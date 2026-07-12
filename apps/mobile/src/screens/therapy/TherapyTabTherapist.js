import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, LayoutAnimation, Modal, Pressable, RefreshControl, ScrollView, Switch, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, isSameDay, startOfDay, SPACE, getBaseUrl, TUNNEL_HEADERS } from '../../utils/app-utils';
import { InquiryCard } from '../../components/InquiryCard';
import { computeTherapistDashboardStats } from '../../utils/therapist-dashboard';
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

function formatAutoConfirmedDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatAutoConfirmedTime(startIso, endIso) {
  const opts = { hour: '2-digit', minute: '2-digit' };
  const start = new Date(startIso).toLocaleTimeString('de-DE', opts);
  const end = new Date(endIso).toLocaleTimeString('de-DE', opts);
  return `${start}–${end}`;
}

function AutoConfirmedCard({ slot, c }) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: 12, borderRadius: RADIUS.sm, borderWidth: 1,
        borderColor: c.border, backgroundColor: c.card,
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: c.primaryBg ?? '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="flash" size={16} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{slot.patientName}</Text>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>
          {formatAutoConfirmedDate(slot.startsAt)} · {formatAutoConfirmedTime(slot.startsAt, slot.endsAt)}
        </Text>
      </View>
      <View style={{ backgroundColor: c.successBg ?? '#D1FAE5', borderRadius: RADIUS.full, paddingVertical: 3, paddingHorizontal: 8 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: c.success ?? '#10B981' }}>AUTO BESTÄTIGT</Text>
      </View>
    </View>
  );
}

export function TherapyTabTherapist({
  authToken,
  incomingBookings, incomingBookingsLoading,
  therapyRefreshing, incomingBookingsLastLoadedAt,
  incomingInquiries, incomingInquiriesLoading, incomingInquiriesLastLoadedAt,
  loadIncomingInquiries,
  onInquiryUpdate,
  onRefresh, onOpenBookingDetail, onSelectTherapistDetailBooking, onTherapistCancelRequest,
  loggedInTherapist,
  onActivateBookingRequests,
  heilmittelOptions,
  initialSubTab,
  c, t, styles,
}) {
  const bookingEnabled = loggedInTherapist?.bookingMode === 'FIRST_APPOINTMENT_REQUEST';
  const reviewApproved = loggedInTherapist?.reviewStatus === 'APPROVED';
  const [filterListKind, setFilterListKind] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [therapistTab, setTherapistTab] = useState(initialSubTab === 'anfragen' ? 'anfragen' : 'termine');

  // Dashboard-Tap ("Offene Aufgaben") — Anfragen-Tab direkt öffnen, auch wenn
  // der Screen schon gemountet war (initialSubTab allein reicht dann nicht).
  useEffect(() => {
    if (initialSubTab === 'anfragen') setTherapistTab('anfragen');
  }, [initialSubTab]);

  // Eingehende Anfragen beim ersten Öffnen des Tabs nachladen wenn noch nicht geladen.
  useEffect(() => {
    if (therapistTab === 'anfragen' && incomingInquiriesLastLoadedAt === 0 && !incomingInquiriesLoading && authToken) {
      loadIncomingInquiries?.(authToken);
    }
  }, [therapistTab]);

  const pendingInquiries = useMemo(() => (incomingInquiries ?? []).filter((q) => ['SENT', 'SEEN', 'COUNTER_PROPOSED'].includes(q.status)), [incomingInquiries]);
  const pendingInquiryCount = pendingInquiries.length;

  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState(loggedInTherapist?.autoAcceptEnabled ?? false);
  const [autoAcceptSingle, setAutoAcceptSingle] = useState(loggedInTherapist?.autoAcceptSingle ?? false);
  const [autoAcceptSeries, setAutoAcceptSeries] = useState(loggedInTherapist?.autoAcceptSeries ?? false);

  useEffect(() => {
    setAutoAcceptEnabled(loggedInTherapist?.autoAcceptEnabled ?? false);
    setAutoAcceptSingle(loggedInTherapist?.autoAcceptSingle ?? false);
    setAutoAcceptSeries(loggedInTherapist?.autoAcceptSeries ?? false);
  }, [loggedInTherapist?.autoAcceptEnabled, loggedInTherapist?.autoAcceptSingle, loggedInTherapist?.autoAcceptSeries]);

  const patchAutoAccept = useCallback(async (patch) => {
    if (!authToken) return;
    try {
      await fetch(`${getBaseUrl()}/auth/me/auto-accept`, {
        method: 'PATCH',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch (_) {}
  }, [authToken]);

  // Automatisch bestätigte Termine, die der Therapeut noch nicht gesehen hat.
  // Werden beim Öffnen des Anfragen-Tabs geladen, für den Rest dieses Besuchs
  // angezeigt und sofort serverseitig als gesehen markiert — beim nächsten
  // Öffnen sind sie dann weg ("einmal gesehen, verschwinden sie").
  const [autoConfirmedUnseen, setAutoConfirmedUnseen] = useState([]);

  useEffect(() => {
    if (therapistTab !== 'anfragen' || !authToken) return;
    let cancelled = false;
    fetch(`${getBaseUrl()}/bookings/auto-confirmed-unseen`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((slots) => {
        if (cancelled) return;
        setAutoConfirmedUnseen(Array.isArray(slots) ? slots : []);
        if (Array.isArray(slots) && slots.length > 0) {
          fetch(`${getBaseUrl()}/bookings/auto-confirmed-unseen/mark-seen`, {
            method: 'POST',
            headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
          }).catch(() => {});
        }
      })
      .catch(() => { if (!cancelled) setAutoConfirmedUnseen([]); });
    return () => { cancelled = true; };
  }, [therapistTab, authToken]);

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

  const dayStats = useMemo(() => computeTherapistDashboardStats({
    bookings: incomingBookings,
    workingHoursRules,
    blockedTimes,
    date: calendarView.selectedDate,
  }), [incomingBookings, workingHoursRules, blockedTimes, calendarView.selectedDate]);

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
  const hasFixedWeekStrip = isListView && therapistTab === 'termine';

  return (
    <View style={{ flex: 1 }}>
      {/* WeekStrip fixiert oben (Listenansicht) */}
      {hasFixedWeekStrip && (
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
        <>
          {/* Tab-Umschalter Termine | Anfragen — nur wenn Buchung aktiv */}
          {bookingEnabled && (
            <View style={{ paddingTop: hasFixedWeekStrip ? 10 : insets.top + 20, paddingHorizontal: 20, paddingBottom: 4, backgroundColor: c.background }}>
              <View style={{ flexDirection: 'row', backgroundColor: c.mutedBg ?? c.card, borderRadius: RADIUS.md, padding: 3, borderWidth: 1, borderColor: c.border }}>
                {[
                  { key: 'termine', label: 'Termine' },
                  { key: 'anfragen', label: pendingInquiryCount > 0 ? `Anfragen  ${pendingInquiryCount}` : 'Anfragen' },
                ].map((tab) => (
                  <Pressable
                    key={tab.key}
                    onPress={() => setTherapistTab(tab.key)}
                    style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: RADIUS.sm - 2, backgroundColor: therapistTab === tab.key ? c.card : 'transparent' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: therapistTab === tab.key ? '700' : '500', color: therapistTab === tab.key ? c.primary : c.muted }}>
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {therapistTab === 'anfragen' ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: SPACE.md, gap: 10, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
            >
              {/* Auto-Accept Toggle */}
              <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: autoAcceptEnabled ? `${c.primary}40` : c.border, overflow: 'hidden' }}>
                <Pressable
                  onPress={() => {
                    const next = !autoAcceptEnabled;
                    let patch = { autoAcceptEnabled: next };
                    if (next && !autoAcceptSingle && !autoAcceptSeries) {
                      setAutoAcceptSingle(true);
                      setAutoAcceptSeries(true);
                      patch = { ...patch, autoAcceptSingle: true, autoAcceptSeries: true };
                    }
                    setAutoAcceptEnabled(next);
                    patchAutoAccept(patch);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: autoAcceptEnabled ? c.primary : c.mutedBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="flash" size={18} color={autoAcceptEnabled ? '#fff' : c.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>Automatisch bestaetigen</Text>
                    <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>Neue Anfragen direkt bestaetigen</Text>
                  </View>
                  <Switch
                    value={autoAcceptEnabled}
                    onValueChange={(val) => {
                      let patch = { autoAcceptEnabled: val };
                      if (val && !autoAcceptSingle && !autoAcceptSeries) {
                        setAutoAcceptSingle(true);
                        setAutoAcceptSeries(true);
                        patch = { ...patch, autoAcceptSingle: true, autoAcceptSeries: true };
                      }
                      setAutoAcceptEnabled(val);
                      patchAutoAccept(patch);
                    }}
                    trackColor={{ false: c.border, true: c.primary }}
                    thumbColor="#fff"
                  />
                </Pressable>
                {autoAcceptEnabled && (
                  <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 14, paddingBottom: 10 }}>
                    <Pressable
                      onPress={() => {
                        const v = !autoAcceptSingle;
                        let patch = { autoAcceptSingle: v };
                        if (!v && !autoAcceptSeries) { setAutoAcceptEnabled(false); patch = { ...patch, autoAcceptEnabled: false }; }
                        setAutoAcceptSingle(v);
                        patchAutoAccept(patch);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}
                    >
                      <Ionicons name="calendar-outline" size={16} color={c.primary} />
                      <Text style={{ flex: 1, fontSize: 13, color: c.text }}>Einzeltermine</Text>
                      <Switch
                        value={autoAcceptSingle}
                        onValueChange={(v) => {
                          let patch = { autoAcceptSingle: v };
                          if (!v && !autoAcceptSeries) { setAutoAcceptEnabled(false); patch = { ...patch, autoAcceptEnabled: false }; }
                          setAutoAcceptSingle(v);
                          patchAutoAccept(patch);
                        }}
                        trackColor={{ false: c.border, true: c.primary }}
                        thumbColor="#fff"
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const v = !autoAcceptSeries;
                        let patch = { autoAcceptSeries: v };
                        if (!v && !autoAcceptSingle) { setAutoAcceptEnabled(false); patch = { ...patch, autoAcceptEnabled: false }; }
                        setAutoAcceptSeries(v);
                        patchAutoAccept(patch);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}
                    >
                      <Ionicons name="layers-outline" size={16} color={c.primary} />
                      <Text style={{ flex: 1, fontSize: 13, color: c.text }}>Serientermine</Text>
                      <Switch
                        value={autoAcceptSeries}
                        onValueChange={(v) => {
                          let patch = { autoAcceptSeries: v };
                          if (!v && !autoAcceptSingle) { setAutoAcceptEnabled(false); patch = { ...patch, autoAcceptEnabled: false }; }
                          setAutoAcceptSeries(v);
                          patchAutoAccept(patch);
                        }}
                        trackColor={{ false: c.border, true: c.primary }}
                        thumbColor="#fff"
                      />
                    </Pressable>
                  </View>
                )}
              </View>

              {autoConfirmedUnseen.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Neu automatisch bestätigt
                  </Text>
                  {autoConfirmedUnseen.map((slot) => (
                    <AutoConfirmedCard key={slot.id} slot={slot} c={c} />
                  ))}
                </View>
              )}

              {incomingInquiriesLoading && (!incomingInquiries || incomingInquiries.length === 0) ? (
                <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
              ) : pendingInquiries.length === 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
                  <Ionicons name="mail-open-outline" size={40} color={c.muted} />
                  <Text style={{ fontSize: 15, color: c.muted, textAlign: 'center' }}>Keine offenen Anfragen</Text>
                </View>
              ) : (
                pendingInquiries.map((inquiry) => (
                  <InquiryCard
                    key={inquiry.id}
                    inquiry={inquiry}
                    authToken={authToken}
                    c={c}
                    onUpdate={onInquiryUpdate}
                  />
                ))
              )}
            </ScrollView>
          ) : (
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
        </>
      )}

      <Modal
        visible={showStatsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
          onPress={() => setShowStatsModal(false)}
        >
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: c.background, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingHorizontal: 24, paddingTop: 20, paddingBottom: insets.bottom + 24 }}>
              {/* Handle */}
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: 20 }} />

              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <View>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>Statistik</Text>
                  <Text style={{ fontSize: 13, color: c.muted, marginTop: 3 }}>
                    {calendarView.selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {isSameDay(calendarView.selectedDate, startOfDay(new Date())) ? ' · Heute' : ''}
                  </Text>
                </View>
                <Pressable onPress={() => setShowStatsModal(false)} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="close" size={22} color={c.muted} />
                </Pressable>
              </View>

              {/* 2×2 Karten */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                {/* Termine */}
                <View style={{ flex: 1, backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 16 }}>
                  <View style={{ width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: `${c.primary}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Ionicons name="calendar-outline" size={20} color={c.primary} />
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: c.text }}>{dayStats.confirmedToday.length}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: c.text, marginTop: 2 }}>Termine</Text>
                  <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>heute gebucht</Text>
                </View>

                {/* Geplante Zeit */}
                <View style={{ flex: 1, backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 16 }}>
                  <View style={{ width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: `${c.primary}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Ionicons name="time-outline" size={20} color={c.primary} />
                  </View>
                  {(() => {
                    const h = Math.floor(dayStats.bookedMinutes / 60);
                    const m = Math.round(dayStats.bookedMinutes % 60);
                    return (
                      <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>
                        {h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}<Text style={{ fontSize: 14, fontWeight: '600' }}> Min</Text>
                      </Text>
                    );
                  })()}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: c.text, marginTop: 2 }}>Geplante Zeit</Text>
                  <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>gesamt heute</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {/* Anfragen */}
                <Pressable
                  onPress={() => { setShowStatsModal(false); setTherapistTab('anfragen'); }}
                  style={{ flex: 1, backgroundColor: autoAcceptEnabled ? `${c.primary}10` : pendingInquiryCount > 0 ? `${c.warning ?? '#B78700'}12` : c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: autoAcceptEnabled ? `${c.primary}40` : pendingInquiryCount > 0 ? `${c.warning ?? '#B78700'}40` : c.border, padding: 16 }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: autoAcceptEnabled ? `${c.primary}20` : `${c.warning ?? '#B78700'}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Ionicons name={autoAcceptEnabled ? 'flash' : 'person-outline'} size={20} color={autoAcceptEnabled ? c.primary : c.warning ?? '#B78700'} />
                  </View>
                  {autoAcceptEnabled ? (
                    <>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: c.primary, marginBottom: 2 }}>Auto-Bestaetigung</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: c.text }}>Anfragen</Text>
                      <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>aktiv</Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 26, fontWeight: '800', color: pendingInquiryCount > 0 ? (c.warning ?? '#B78700') : c.text }}>{pendingInquiryCount}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: c.text, marginTop: 2 }}>Anfragen</Text>
                      <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{pendingInquiryCount === 0 ? 'keine offen' : `${pendingInquiryCount} offen`}</Text>
                    </>
                  )}
                </Pressable>

                {/* Auslastung */}
                <View style={{ flex: 1, backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 16 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 5, borderColor: dayStats.utilizationPercent > 0 ? c.primary : c.border, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: dayStats.utilizationPercent > 0 ? c.primary : c.muted }}>{dayStats.utilizationPercent}%</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: c.text }}>Auslastung</Text>
                  <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>von Arbeitszeit{'\n'}belegt</Text>
                </View>
              </View>

              {/* Footer */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
                <Ionicons name="information-circle-outline" size={16} color={c.muted} />
                <Text style={{ fontSize: 12, color: c.muted, flex: 1 }}>Die Werte basieren auf dem Terminplan des gewaehlten Tages.</Text>
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
