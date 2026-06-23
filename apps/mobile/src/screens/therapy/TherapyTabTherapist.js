import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView,
  Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, startOfDay, startOfWeek } from '../../utils/app-utils';
import { TherapistTimeline } from '../../components/SlotComposer';
import { HeilmittelSelectModal } from '../../modals/HeilmittelSelectModal';
import { PatientTherapistToggle } from '../../components/PatientTherapistToggle';
import { TherapistSummaryCard } from '../../components/TherapistSummaryCard';
import { TherapistWeekStrip } from '../../components/TherapistWeekStrip';
import { ScheduleModeTabs } from '../../components/ScheduleModeTabs';
import { TherapistDayTimeline } from '../../components/TherapistDayTimeline';
import { PatientsPane } from './TherapistPatientsScreen';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

export function TherapyTabTherapist({
  mySlots, slotsLoading, incomingBookings, incomingBookingsLoading,
  deletingSlotIds, activeFilterTherapist, setActiveFilterTherapist,
  therapyRefreshing, slotsLastLoadedAt, incomingBookingsLastLoadedAt,
  onRefresh, onRespond, onOpenTherapistById,
  onCancelSlot, onTherapistCancelRequest, onSelectTherapistDetailBooking, setShowSlotComposerModal,
  onOpenBookingDetail, onBulkDeleteSlots,
  loggedInTherapist,
  onActivateBookingRequests,
  heilmittelOptions,
  therapistView, setTherapistView,
  patients, patientsLoading, patientsLastLoadedAt, onSelectPatient,
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
  const [scheduleView, setScheduleView] = useState('timeline');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const goToListFilter = (filterKey) => {
    setTherapistView('termine');
    setScheduleView('list');
    setActiveFilterTherapist(filterKey);
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setSelectedDate(startOfDay(today));
    setVisibleWeekStart(startOfWeek(today));
  };

  const handleToggleSelect = (slotId) => {
    setSelectedSlotIds((prev) => (
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    ));
  };

  const handleToggleSelectAll = () => {
    setSelectedSlotIds((prev) => (prev.length === freeSlots.length ? [] : freeSlots.map((s) => s.id)));
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedSlotIds([]);
  };

  const handleConfirmBulkDelete = () => {
    const count = selectedSlotIds.length;
    if (count === 0 || !onBulkDeleteSlots) return;
    Alert.alert(
      `${count} freie ${count === 1 ? 'Termin' : 'Termine'} löschen?`,
      'Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            setBulkDeleting(true);
            try {
              await onBulkDeleteSlots(selectedSlotIds);
            } finally {
              setBulkDeleting(false);
              handleCancelSelection();
            }
          },
        },
      ],
    );
  };

  // 'pending' is intentionally not a Liste filter anymore — the dedicated
  // "Angefragt" tab (ScheduleModeTabs) replaced it, so the old chip + badge
  // and the new tab + badge no longer both show the same count side by side.
  const FILTERS = [
    { key: 'all', label: 'Alle' },
    { key: 'booked', label: 'Gebucht' },
    { key: 'free', label: 'Frei' },
  ];

  const nextFreeSlot = useMemo(
    () => [...freeSlots].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] ?? null,
    [freeSlots],
  );
  const nextFreeSlotDate = nextFreeSlot ? new Date(nextFreeSlot.startsAt) : null;
  const nextFreeSlotTime = nextFreeSlotDate
    ? nextFreeSlotDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;
  const nextFreeSlotDateLabel = nextFreeSlotDate
    ? nextFreeSlotDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
    : '–';
  const nextFreeSlotIsWithin24h = nextFreeSlotDate
    ? nextFreeSlotDate.getTime() - Date.now() < 24 * 60 * 60 * 1000
    : false;
  const nextFreeSlotSummaryLabel = !nextFreeSlotDate
    ? nextFreeSlotDateLabel
    : nextFreeSlotIsWithin24h
      ? `${nextFreeSlotTime} Uhr`
      : nextFreeSlotDateLabel;

  // Shared between the "Termine" (ScrollView) and "Patienten" (FlatList) views,
  // each of which owns its own single scroll root so the patient list can virtualize properly.
  const summaryAndToggle = (
    <>
      <TherapistSummaryCard
        c={c}
        freeCount={freeSlots.length}
        confirmedCount={confirmedBookingsCount}
        nextSlotLabel={nextFreeSlotSummaryLabel}
        onPressFree={() => goToListFilter('free')}
        onPressBooked={() => goToListFilter('booked')}
      />

      <PatientTherapistToggle
        c={c}
        value={therapistView}
        onChange={setTherapistView}
        terminCount={mySlots.length}
        patientCount={patients.length}
      />
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../../../assets/icon.png')} style={styles.logoMark} />
          <Text style={[styles.headerTitle, { color: c.text, flex: 1 }]}>{'Meine Übersicht'}</Text>
        </View>
      </View>

      {therapistView === 'patients' ? (
        <PatientsPane
          patients={patients}
          patientsLoading={patientsLoading}
          patientsLastLoadedAt={patientsLastLoadedAt}
          onSelectPatient={onSelectPatient}
          c={c}
          headerContent={summaryAndToggle}
          therapyRefreshing={therapyRefreshing}
          onRefresh={onRefresh}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 90, paddingTop: 8 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        >
          {summaryAndToggle}

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

              <ScheduleModeTabs
                c={c}
                value={scheduleView}
                onChange={(next) => { setScheduleView(next); handleCancelSelection(); }}
                pendingCount={pendingIncomingBookings.length}
              />

              {scheduleView === 'list' ? (
                <>
                  {/* ── Segment-Tabs / Auswahl-Toolbar ──────────────────────── */}
                  {selectionMode ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
                      <Pressable onPress={handleCancelSelection} hitSlop={8}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted }}>Abbrechen</Text>
                      </Pressable>
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: c.text, textAlign: 'center' }}>
                        {selectedSlotIds.length} ausgewählt
                      </Text>
                      <Pressable onPress={handleToggleSelectAll} hitSlop={8}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>
                          {selectedSlotIds.length === freeSlots.length ? 'Keine' : 'Alle'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleConfirmBulkDelete}
                        disabled={selectedSlotIds.length === 0 || bulkDeleting}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: selectedSlotIds.length === 0 ? c.border : (c.error ?? '#DC2626') }}
                      >
                        {bulkDeleting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Löschen</Text>
                        )}
                      </Pressable>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 16 }}>
                      {FILTERS.map(({ key, label }) => {
                        const active = activeFilterTherapist === key;
                        return (
                          <Pressable
                            key={key}
                            onPress={() => setActiveFilterTherapist(key)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: active ? (c.success ?? '#5A9E8E') : 'transparent' }}
                          >
                            <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? c.text : c.muted }}>{label}</Text>
                          </Pressable>
                        );
                      })}
                      {activeFilterTherapist === 'free' && freeSlots.length > 0 && (
                        <Pressable onPress={() => setSelectionMode(true)} hitSlop={8} style={{ paddingHorizontal: 4, paddingBottom: 10 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Auswählen</Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  <TherapistTimeline
                    c={c}
                    mySlots={mySlots}
                    incomingBookings={incomingBookings}
                    activeFilter={activeFilterTherapist}
                    deletingSlotIds={deletingSlotIds}
                    onCancelSlot={onCancelSlot}
                    onRespond={onRespond}
                    onTherapistCancel={handleTherapistCancel}
                    onOpenDetail={handleOpenDetail}
                    slotsLoading={shouldShowSectionLoading(slotsLoading, slotsLastLoadedAt)}
                    incomingLoading={shouldShowSectionLoading(incomingBookingsLoading, incomingBookingsLastLoadedAt)}
                    selectionMode={selectionMode}
                    selectedSlotIds={selectedSlotIds}
                    onToggleSelect={handleToggleSelect}
                  />
                </>
              ) : scheduleView === 'timeline' ? (
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
              ) : scheduleView === 'requested' ? (
                <TherapistTimeline
                  c={c}
                  mySlots={mySlots}
                  incomingBookings={incomingBookings}
                  activeFilter="pending"
                  deletingSlotIds={deletingSlotIds}
                  onCancelSlot={onCancelSlot}
                  onRespond={onRespond}
                  onTherapistCancel={handleTherapistCancel}
                  onOpenDetail={handleOpenDetail}
                  slotsLoading={shouldShowSectionLoading(slotsLoading, slotsLastLoadedAt)}
                  incomingLoading={shouldShowSectionLoading(incomingBookingsLoading, incomingBookingsLastLoadedAt)}
                />
              ) : (
                <View style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={28} color={c.muted} style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' }}>Kalenderansicht folgt in Kürze</Text>
                  <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                    Nutze bis dahin Liste oder Timeline.
                  </Text>
                </View>
              )}
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
      )}

      {/* ── FAB ─────────────────────────────────────────────────────── */}
      {therapistView === 'termine' && slotBookingEnabled && (scheduleView === 'timeline' || scheduleView === 'list') && (
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
