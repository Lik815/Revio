import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView,
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
import { WorkingHoursScreen } from './WorkingHoursScreen';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

const FILTER_LIST_TITLES = {
  free: 'Freie Termine',
  booked: 'Gebuchte Termine',
  pending: 'Anfragen',
};

function DeleteFreeSlotsModal({ visible, count, loading, onClose, onConfirm, c }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(16, 37, 49, 0.42)',
          justifyContent: 'center',
          padding: 22,
        }}
      >
        <Pressable
          disabled={loading}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 30,
            padding: 22,
            gap: 18,
            borderWidth: 1,
            borderColor: c.border,
            shadowColor: '#102531',
            shadowOpacity: 0.18,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 16 },
            elevation: 18,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                backgroundColor: '#FFF1F1',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={26} color={c.error} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 22, lineHeight: 27, fontWeight: '800', color: c.text }}>
                Freie Termine löschen?
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: c.muted }}>
                Du löschst alle aktuell freien Termine. Gebuchte Termine bleiben bestehen.
              </Text>
            </View>
          </View>

          <View
            style={{
              borderRadius: 18,
              backgroundColor: c.mutedBg,
              borderWidth: 1,
              borderColor: c.border,
              padding: 16,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: c.muted, textTransform: 'uppercase' }}>
              Betroffen
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: c.text }}>
              {count} freie Termine
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 19, color: c.muted }}>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              disabled={loading}
              onPress={onClose}
              style={{
                flex: 1,
                minHeight: 54,
                borderRadius: 18,
                backgroundColor: c.mutedBg,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading ? 0.55 : 1,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: c.text }}>Abbrechen</Text>
            </Pressable>
            <Pressable
              disabled={loading}
              onPress={onConfirm}
              style={{
                flex: 1,
                minHeight: 54,
                borderRadius: 18,
                backgroundColor: c.error,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading ? 0.72 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Löschen</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
  const [showWorkingHours, setShowWorkingHours] = useState(false);
  const [showDeleteFreeSlotsModal, setShowDeleteFreeSlotsModal] = useState(false);
  const [deleteFreeSlotsLoading, setDeleteFreeSlotsLoading] = useState(false);
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

  const handleDeleteAllFreeSlots = () => {
    if (freeSlots.length === 0) return;
    setShowDeleteFreeSlotsModal(true);
  };

  const handleConfirmDeleteAllFreeSlots = async () => {
    const ids = freeSlots.map((s) => s.id);
    if (ids.length === 0 || deleteFreeSlotsLoading) return;
    setDeleteFreeSlotsLoading(true);
    try {
      await onBulkDeleteSlots?.(ids);
      setShowDeleteFreeSlotsModal(false);
    } finally {
      setDeleteFreeSlotsLoading(false);
    }
  };

  if (showWorkingHours) {
    return (
      <WorkingHoursScreen c={c} authToken={authToken} onBack={() => setShowWorkingHours(false)} />
    );
  }

  if (filterListKind) {
    return (
      <View style={{ flex: 1 }}>
        <DeleteFreeSlotsModal
          visible={showDeleteFreeSlotsModal}
          count={freeSlots.length}
          loading={deleteFreeSlotsLoading}
          onClose={() => setShowDeleteFreeSlotsModal(false)}
          onConfirm={handleConfirmDeleteAllFreeSlots}
          c={c}
        />
        <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, backgroundColor: c.background }}>
          <Pressable
            onPress={() => setFilterListKind(null)}
            style={{ alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Ionicons name="chevron-back" size={16} color={c.primary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Zurück</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>{FILTER_LIST_TITLES[filterListKind]}</Text>
            {filterListKind === 'free' && freeSlots.length > 0 ? (
              <Pressable
                onPress={handleDeleteAllFreeSlots}
                hitSlop={{ top: 14, right: 14, bottom: 14, left: 14 }}
                style={{ minHeight: 40, paddingLeft: 14, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.error }}>Alle löschen</Text>
              </Pressable>
            ) : null}
          </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => setShowWorkingHours(true)}
              hitSlop={8}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.mutedBg, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="time-outline" size={16} color={c.primary} />
            </Pressable>
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
