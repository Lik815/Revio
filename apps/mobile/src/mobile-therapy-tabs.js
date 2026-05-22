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
  myAppointments, myAppointmentsLoading, favorites,
  activeFilterPatient, setActiveFilterPatient,
  therapyRefreshing, appointmentsLastLoadedAt,
  notifications, dismissedNotifIds, onShowNotifications,
  onRefresh, onOpenTherapistById, onSelectAppointment,
  renderFavoritesVertical, renderTherapyTabShell, renderTherapySectionLoading,
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

  const filteredKommend = activeFilterPatient === 'vergangen' || activeFilterPatient === 'favoriten' ? [] : kommend;
  const filteredVergangen = activeFilterPatient === 'kommend' || activeFilterPatient === 'favoriten' ? [] : vergangen;

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
          <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
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
            style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: c.successBg ?? '#EAF4F1', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="calendar-outline" size={24} color={c.success ?? '#5A9E8E'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Nächster Termin</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: c.text, marginTop: 2 }}>
                {new Date(getDate(nextApt)).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}{', '}
                {new Date(getDate(nextApt)).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {countdown && <Text style={{ fontSize: 12, color: c.success ?? '#5A9E8E', marginTop: 2 }}>{countdown}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Pressable>
        ) : null}

        {/* ── KPI-Karten ──────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <Pressable
            onPress={() => setActiveFilterPatient(activeFilterPatient === 'kommend' ? 'all' : 'kommend')}
            style={{ flex: 1, backgroundColor: c.primaryBg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', borderWidth: activeFilterPatient === 'kommend' ? 2 : 0, borderColor: c.primary }}
          >
            <Text style={{ fontSize: 20, fontWeight: '800', color: c.primary }}>{kommend.length}</Text>
            <Text style={{ fontSize: 10, color: c.primary, fontWeight: '600', marginTop: 2, textAlign: 'center' }}>Gebuchte Termine</Text>
            <Ionicons name="calendar-outline" size={14} color={c.primary} style={{ marginTop: 3, opacity: 0.7 }} />
            <Ionicons name="chevron-forward" size={10} color={c.primary} style={{ position: 'absolute', top: 8, right: 6, opacity: 0.5 }} />
          </Pressable>
          <Pressable
            onPress={() => setActiveFilterPatient(activeFilterPatient === 'vergangen' ? 'all' : 'vergangen')}
            style={{ flex: 1, backgroundColor: c.warningBg ?? '#FEF5DC', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', borderWidth: activeFilterPatient === 'vergangen' ? 2 : 0, borderColor: c.warning ?? '#8A6000' }}
          >
            <Text style={{ fontSize: 20, fontWeight: '800', color: c.warning ?? '#8A6000' }}>{vergangen.length}</Text>
            <Text style={{ fontSize: 10, color: c.warning ?? '#8A6000', fontWeight: '600', marginTop: 2, textAlign: 'center' }}>Vergangene Termine</Text>
            <Ionicons name="time-outline" size={14} color={c.warning ?? '#8A6000'} style={{ marginTop: 3, opacity: 0.7 }} />
            <Ionicons name="chevron-forward" size={10} color={c.warning ?? '#8A6000'} style={{ position: 'absolute', top: 8, right: 6, opacity: 0.5 }} />
          </Pressable>
          <Pressable
            onPress={() => setActiveFilterPatient(activeFilterPatient === 'favoriten' ? 'all' : 'favoriten')}
            style={{ flex: 1, backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', borderWidth: activeFilterPatient === 'favoriten' ? 2 : 0, borderColor: c.error ?? '#ef4444' }}
          >
            <Text style={{ fontSize: 20, fontWeight: '800', color: c.error ?? '#ef4444' }}>{favorites.length}</Text>
            <Text style={{ fontSize: 10, color: c.error ?? '#ef4444', fontWeight: '600', marginTop: 2, textAlign: 'center' }}>Favoriten</Text>
            <Ionicons name="heart-outline" size={14} color={c.error ?? '#ef4444'} style={{ marginTop: 3, opacity: 0.7 }} />
            <Ionicons name="chevron-forward" size={10} color={c.error ?? '#ef4444'} style={{ position: 'absolute', top: 8, right: 6, opacity: 0.5 }} />
          </Pressable>
        </View>

        {/* ── Filter-Tabs ─────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[
              { key: 'all', label: 'Alle' },
              { key: 'kommend', label: 'Kommend' },
              { key: 'vergangen', label: 'Vergangen' },
              { key: 'favoriten', label: 'Favoriten' },
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

        {/* ── Favoriten-Filter ────────────────────────────────────── */}
        {activeFilterPatient === 'favoriten' ? (
          <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingBottom: 4 }}>
            {renderFavoritesVertical((fav) => onOpenTherapist(fav), { showAll: true })}
          </View>
        ) : (
          <>
            {/* ── Timeline ──────────────────────────────────────── */}
            {shouldShowSectionLoading(myAppointmentsLoading, appointmentsLastLoadedAt) ? (
              renderTherapySectionLoading()
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

            {/* ── Gespeicherte Therapeuten ────────────────────────── */}
            <Text style={[styles.sectionLabel, { color: c.text, marginTop: 16, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }]}>Gespeicherte Therapeuten</Text>
            <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingBottom: 4 }}>
              {renderFavoritesVertical((fav) => onOpenTherapist(fav), { onShowAll: () => setActiveFilterPatient('favoriten') })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export function TherapyTabTherapist({
  authToken, mySlots, slotsLoading, incomingBookings, incomingBookingsLoading,
  favorites, deletingSlotIds, activeFilterTherapist, setActiveFilterTherapist,
  therapyRefreshing, slotsLastLoadedAt, incomingBookingsLastLoadedAt,
  notifications, dismissedNotifIds, onShowNotifications,
  onRefresh, onLoadMySlots, onLoadIncomingBookings, onOpenTherapistById,
  onCancelSlot, onTherapistCancelRequest, onSelectTherapistDetailBooking, setShowSlotComposerModal,
  loggedInTherapist,
  renderFavoritesVertical, renderTherapyTabShell, renderTherapySectionLoading, renderTherapySectionEmpty,
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
    { key: 'favoriten', label: 'Favoriten' },
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
          <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
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
              style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: c.successBg ?? '#EAF4F1', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="time-outline" size={24} color={c.success ?? '#5A9E8E'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Freie Termine heute</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, marginTop: 2 }}>{freeSlots.length} freie Termine</Text>
                {nextFreeSlotTime && <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>Nächster Slot: {nextFreeSlotTime} Uhr</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>

            {/* ── KPI-Karten ──────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {[
                { key: 'booked', label: 'Gebuchte Termine', value: bookedSlots.length, color: c.primary, icon: 'calendar-outline' },
                { key: 'pending', label: 'Anfragen', value: pendingIncomingBookings.length, color: c.warning ?? '#B7791F', icon: 'person-outline' },
                { key: 'favoriten', label: 'Favoriten', value: favorites.length, color: c.error ?? '#ef4444', icon: 'heart-outline' },
              ].map(({ key, label, value, color, icon }) => {
                const active = activeFilterTherapist === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setActiveFilterTherapist(active ? 'all' : key)}
                    style={{
                      flex: 1,
                      backgroundColor: c.card,
                      borderRadius: 14,
                      paddingVertical: 16,
                      paddingHorizontal: 4,
                      alignItems: 'center',
                      borderWidth: active ? 1.6 : 1.25,
                      borderColor: color,
                      shadowColor: color,
                      shadowOpacity: active ? 0.10 : 0.04,
                      shadowRadius: active ? 8 : 4,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: active ? 2 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: '800', color }}>{value}</Text>
                    <Text style={{ fontSize: 10, color, fontWeight: '600', marginTop: 2, textAlign: 'center' }}>{label}</Text>
                    <Ionicons name={icon} size={15} color={color} style={{ marginTop: 8 }} />
                  </Pressable>
                );
              })}
            </View>

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

            {/* ── Timeline oder Favoriten ──────────────────────────── */}
            {activeFilterTherapist === 'favoriten' ? (
              <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingBottom: 4 }}>
                {renderFavoritesVertical((fav) => onOpenTherapistById(fav.id), { showAll: true })}
              </View>
            ) : (
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
            )}
          </>
        ) : (
          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            {renderTherapySectionEmpty('Terminanfragen sind noch nicht aktiviert.', 'Aktiviere Terminanfragen in deinem Profil, um Slots anzulegen.')}
          </View>
        )}

        {/* ── Gespeicherte Therapeuten ─────────────────────────────── */}
        {activeFilterTherapist !== 'favoriten' && (
          <>
            <Text style={[styles.sectionLabel, { color: c.text, marginTop: 16, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }]}>Gespeicherte Therapeuten</Text>
            <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingBottom: 4 }}>
              {renderFavoritesVertical((fav) => onOpenTherapistById(fav.id), { onShowAll: () => setActiveFilterTherapist('favoriten') })}
            </View>
          </>
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

