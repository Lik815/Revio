import React from 'react';
import {
  ActivityIndicator, Image, Pressable, RefreshControl, ScrollView,
  Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACE, formatDayHeader, getBaseUrl, TUNNEL_HEADERS } from './mobile-utils';
import { PatientAppointmentCard, TherapistBookingCard, STATUS_COLORS } from './mobile-booking';
import { TherapistTimeline } from './mobile-slot-composer';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

export function TherapyTabPatient({
  myAppointments, myAppointmentsLoading,
  activeFilterPatient, setActiveFilterPatient,
  therapyRefreshing, appointmentsLastLoadedAt,
  notifications, dismissedNotifIds, onShowNotifications,
  onRefresh, onOpenTherapistById, onSelectAppointment,
  c, t, styles,
}) {
  const getDate = (a) => new Date(a.slot?.startsAt ?? a.confirmedSlotAt ?? 0);
  const now = new Date();

  const kommend = [...myAppointments]
    .filter(a => ['CONFIRMED', 'PENDING'].includes(a.status) && getDate(a) >= now)
    .sort((a, b) => getDate(a) - getDate(b));

  const vergangen = [...myAppointments]
    .filter(a =>
      ['CANCELLED', 'DECLINED', 'EXPIRED'].includes(a.status) ||
      (a.status === 'CONFIRMED' && getDate(a) < now)
    )
    .sort((a, b) => getDate(b) - getDate(a));

  const nextApt = kommend[0] ?? null;

  const openTherapist = (th) => {
    if (th?.id) onOpenTherapistById(th.id, th);
  };

  const groupByDay = (appointments) => {
    const groups = {};
    appointments.forEach(apt => {
      const key = formatDayHeader(getDate(apt).toISOString());
      if (!groups[key]) groups[key] = [];
      groups[key].push(apt);
    });
    return groups;
  };

  const filteredKommend = activeFilterPatient === 'vergangen' ? [] : kommend;
  const filteredVergangen = activeFilterPatient === 'kommend' ? [] : vergangen;

  const msUntil = nextApt ? getDate(nextApt) - now : 0;
  const hoursUntil = Math.floor(msUntil / 3600000);
  const minsUntil = Math.floor((msUntil % 3600000) / 60000);
  const countdown = msUntil > 0
    ? (hoursUntil > 0 ? `in ${hoursUntil} Std. ${minsUntil} Min.` : `in ${minsUntil} Min.`)
    : null;

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../assets/icon.png')} style={styles.logoMark} />
          <Text style={[styles.headerTitle, { color: c.text, flex: 1 }]}>Meine Termine</Text>
          <Pressable onPress={() => onShowNotifications()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications-outline" size={18} color={c.text} />
            {notifications.filter(n => !dismissedNotifIds.has(n.id)).length > 0 && (
              <View style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: c.error }} />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {/* ── Hero ────────────────────────────────────────────────── */}
        {nextApt ? (
          <Pressable
            onPress={() => onSelectAppointment(nextApt)}
            style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: c.successBg ?? '#EAF4F1', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar-outline" size={24} color={c.success ?? '#5A9E8E'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Nächster Termin</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: c.text, marginTop: 2 }}>
                  {new Date(getDate(nextApt)).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}{', '}
                  {new Date(getDate(nextApt)).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {countdown && <Text style={{ fontSize: 12, color: c.success ?? '#5A9E8E', marginTop: 2 }}>{countdown}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </View>
            {/* ── Stats-Zeile ── */}
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="calendar-outline" size={12} color={c.primary} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>{kommend.length} kommend</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="time-outline" size={12} color={c.muted} />
                <Text style={{ fontSize: 12, fontWeight: '500', color: c.muted }}>{vergangen.length} vergangen</Text>
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: c.mutedBg ?? '#F4F4F4', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar-outline" size={24} color={c.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Nächster Termin</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginTop: 2 }}>Kein bevorstehender Termin</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="calendar-outline" size={12} color={c.primary} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>{kommend.length} kommend</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="time-outline" size={12} color={c.muted} />
                <Text style={{ fontSize: 12, fontWeight: '500', color: c.muted }}>{vergangen.length} vergangen</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Filter-Tabs ─────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[
              { key: 'all', label: 'Alle' },
              { key: 'kommend', label: 'Kommend' },
              { key: 'vergangen', label: 'Vergangen' },
            ].map(({ key, label }) => {
              const active = activeFilterPatient === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setActiveFilterPatient(key)}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: active ? c.primary : c.card, borderWidth: 1, borderColor: active ? c.primary : c.border }}
                >
                  <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? '#fff' : c.text }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* ── Timeline ──────────────────────────────────────────────── */}
        {shouldShowSectionLoading(myAppointmentsLoading, appointmentsLastLoadedAt) ? (
          <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 20 }]}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : myAppointments.length === 0 ? (
          <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="calendar-outline" size={36} color={c.muted} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, textAlign: 'center' }}>Noch keine Termine</Text>
            <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
              Suche eine Therapeutin oder einen Therapeuten und buche deinen ersten Termin.
            </Text>
          </View>
        ) : (
          <>
            {Object.entries(groupByDay(filteredKommend)).map(([day, apts]) => (
              <View key={day} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 8 }}>{day}</Text>
                {apts.map(apt => (
                  <PatientAppointmentCard key={apt.id} c={c} appointment={apt} onOpenDetail={() => onSelectAppointment(apt)} onViewTherapist={() => openTherapist(apt.therapist)} />
                ))}
              </View>
            ))}
            {filteredVergangen.length > 0 && (
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 8, marginTop: filteredKommend.length > 0 ? 8 : 0 }}>
                Vergangene Termine
              </Text>
            )}
            {Object.entries(groupByDay(filteredVergangen)).map(([day, apts]) => (
              <View key={day} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 8 }}>{day}</Text>
                {apts.map(apt => (
                  <PatientAppointmentCard key={apt.id} c={c} appointment={apt} isPast onOpenDetail={() => onSelectAppointment(apt)} onViewTherapist={() => openTherapist(apt.therapist)} />
                ))}
              </View>
            ))}
            {filteredKommend.length === 0 && filteredVergangen.length === 0 && (
              <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' }}>Keine Termine</Text>
                <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 4 }}>Für diesen Filter gibt es keine Einträge.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export function TherapyTabTherapist({
  authToken, mySlots, slotsLoading, incomingBookings, incomingBookingsLoading,
  deletingSlotIds, activeFilterTherapist, setActiveFilterTherapist,
  therapyRefreshing, slotsLastLoadedAt, incomingBookingsLastLoadedAt,
  notifications, dismissedNotifIds, onShowNotifications,
  onRefresh, onLoadMySlots, onLoadIncomingBookings, onOpenTherapistById,
  onCancelSlot, onTherapistCancelRequest, onSelectTherapistDetailBooking, setShowSlotComposerModal,
  loggedInTherapist,
  c, t, styles,
}) {
  const slotBookingEnabled = loggedInTherapist?.bookingMode === 'FIRST_APPOINTMENT_REQUEST';
  const pendingIncomingBookings = incomingBookings.filter((r) => r.status === 'PENDING');
  const freeSlots = mySlots.filter(s => s.status === 'AVAILABLE');
  const bookedSlots = mySlots.filter(s => s.status === 'BOOKED');

  const handleRespond = async (id, body) => {
    const res = await fetch(`${getBaseUrl()}/bookings/${id}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? `Fehler ${res.status}`);
    }
    onLoadIncomingBookings(authToken);
    onLoadMySlots(authToken);
  };

  const handleTherapistCancel = (bookingId) => {
    onTherapistCancelRequest(bookingId);
  };

  const handleOpenDetail = (booking) => {
    onSelectTherapistDetailBooking(booking);
    onTherapistCancelRequest(booking.id);
  };

  const FILTERS = [
    { key: 'all', label: 'Alle' },
    { key: 'booked', label: 'Gebucht' },
    { key: 'free', label: 'Frei' },
    { key: 'pending', label: 'Anfragen' },
  ];

  const nextFreeSlot = [...freeSlots].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
  const nextFreeSlotTime = nextFreeSlot
    ? new Date(nextFreeSlot.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../assets/icon.png')} style={styles.logoMark} />
          <Text style={[styles.headerTitle, { color: c.text, flex: 1 }]}>{'Meine Termine'}</Text>
          <Pressable onPress={() => onShowNotifications()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications-outline" size={18} color={c.text} />
            {notifications.filter(n => !dismissedNotifIds.has(n.id)).length > 0 && (
              <View style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: c.error }} />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 90, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {slotBookingEnabled ? (
          <>
            {/* ── Hero ────────────────────────────────────────────── */}
            <Pressable
              onPress={() => setActiveFilterTherapist('free')}
              style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: c.successBg ?? '#EAF4F1', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="time-outline" size={24} color={c.success ?? '#5A9E8E'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Freie Termine heute</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, marginTop: 2 }}>{freeSlots.length} freie Termine</Text>
                  {nextFreeSlotTime && <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>Nächster Slot: {nextFreeSlotTime} Uhr</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </View>
              {/* ── Stats-Zeile ── */}
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="calendar-outline" size={12} color={c.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>{bookedSlots.length} gebucht</Text>
                </View>
                {pendingIncomingBookings.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="person-outline" size={12} color={c.warning ?? '#B7791F'} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: c.warning ?? '#B7791F' }}>{pendingIncomingBookings.length} Anfragen</Text>
                  </View>
                )}
              </View>
            </Pressable>

            {/* ── Segment-Filterleiste ────────────────────────────── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {FILTERS.map(({ key, label }) => {
                  const active = activeFilterTherapist === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setActiveFilterTherapist(key)}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: active ? c.primary : c.card, borderWidth: 1, borderColor: active ? c.primary : c.border }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? '#fff' : c.text }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* ── Timeline ────────────────────────────────────────── */}
            <TherapistTimeline
              c={c}
              mySlots={mySlots}
              incomingBookings={incomingBookings}
              activeFilter={activeFilterTherapist}
              deletingSlotIds={deletingSlotIds}
              onCancelSlot={onCancelSlot}
              onRespond={handleRespond}
              onTherapistCancel={handleTherapistCancel}
              onOpenDetail={handleOpenDetail}
              slotsLoading={shouldShowSectionLoading(slotsLoading, slotsLastLoadedAt)}
              incomingLoading={shouldShowSectionLoading(incomingBookingsLoading, incomingBookingsLastLoadedAt)}
            />
          </>
        ) : (
          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 20 }]}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>Terminanfragen sind noch nicht aktiviert.</Text>
              <Text style={[styles.emptyBody, { color: c.muted }]}>Aktiviere Terminanfragen in deinem Profil, um Slots anzulegen.</Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── FAB ─────────────────────────────────────────────────────── */}
      {slotBookingEnabled && (
        <Pressable
          onPress={() => setShowSlotComposerModal(true)}
          style={{ position: 'absolute', bottom: 24, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}
    </View>
  );
};

