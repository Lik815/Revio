import React from 'react';
import {
  ActivityIndicator, Image, Pressable, RefreshControl, ScrollView,
  Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDayHeader } from '../../utils/app-utils';
import { PatientAppointmentCard, PatientNextAppointmentCard } from './AppointmentCards';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

export function TherapyTabPatient({
  myAppointments, myAppointmentsLoading,
  activeFilterPatient, setActiveFilterPatient,
  therapyRefreshing, appointmentsLastLoadedAt,
  notifications, dismissedNotifIds, onShowNotifications,
  onRefresh, onOpenTherapistById, onSelectAppointment,
  c, t, styles,
}) {
  const insets = useSafeAreaInsets();
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

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../../../assets/icon.png')} style={styles.logoMark} />
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
        {/* ── Nächster Termin + Kennzahlen ──────────────────────────── */}
        <PatientNextAppointmentCard
          c={c}
          appointment={nextApt}
          kommendCount={kommend.length}
          vergangenCount={vergangen.length}
          onOpenDetail={() => nextApt && onSelectAppointment(nextApt)}
          onViewTherapist={() => nextApt && openTherapist(nextApt.therapist)}
          onSelectKommend={() => setActiveFilterPatient('kommend')}
          onSelectVergangen={() => setActiveFilterPatient('vergangen')}
        />

        {/* ── Segment-Tabs ──────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, marginBottom: 16 }}>
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
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: active ? (c.success ?? '#5A9E8E') : 'transparent' }}
              >
                <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? c.text : c.muted }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

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
              <View key={day} style={{ marginBottom: 20 }}>
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
              <View key={day} style={{ marginBottom: 20 }}>
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
}
