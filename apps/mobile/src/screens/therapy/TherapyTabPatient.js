import React, { useMemo } from 'react';
import {
  ActivityIndicator, Image, Pressable, RefreshControl, SectionList,
  Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDayHeader } from '../../utils/app-utils';
import { PatientAppointmentCard, PatientNextAppointmentCard } from './AppointmentCards';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

function groupByDay(appointments, getDate) {
  const groups = {};
  appointments.forEach(apt => {
    const key = formatDayHeader(getDate(apt).toISOString());
    if (!groups[key]) groups[key] = [];
    groups[key].push(apt);
  });
  return groups;
}

export function TherapyTabPatient({
  myAppointments, myAppointmentsLoading,
  activeFilterPatient, setActiveFilterPatient,
  therapyRefreshing, appointmentsLastLoadedAt,
  onRefresh, onOpenTherapistById, onSelectAppointment,
  c, t, styles,
}) {
  const insets = useSafeAreaInsets();
  const getDate = (a) => new Date(a.slot?.startsAt ?? a.confirmedSlotAt ?? 0);

  const { kommend, vergangen } = useMemo(() => {
    const now = new Date();
    const upcoming = [...myAppointments]
      .filter(a => ['CONFIRMED', 'PENDING'].includes(a.status) && getDate(a) >= now)
      .sort((a, b) => getDate(a) - getDate(b));
    const past = [...myAppointments]
      .filter(a =>
        ['CANCELLED', 'DECLINED', 'EXPIRED'].includes(a.status) ||
        (a.status === 'CONFIRMED' && getDate(a) < now)
      )
      .sort((a, b) => getDate(b) - getDate(a));
    return { kommend: upcoming, vergangen: past };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAppointments]);

  const nextApt = kommend[0] ?? null;

  const openTherapist = (th) => {
    if (th?.id) onOpenTherapistById(th.id, th);
  };

  const filteredKommend = activeFilterPatient === 'vergangen' ? [] : kommend;
  const filteredVergangen = activeFilterPatient === 'kommend' ? [] : vergangen;

  const sections = useMemo(() => {
    const result = [];
    Object.entries(groupByDay(filteredKommend, getDate)).forEach(([day, apts]) => {
      result.push({ title: day, data: apts, isPast: false, isFirstPast: false });
    });
    const vergangenEntries = Object.entries(groupByDay(filteredVergangen, getDate));
    vergangenEntries.forEach(([day, apts], index) => {
      result.push({ title: day, data: apts, isPast: true, isFirstPast: index === 0 });
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredKommend, filteredVergangen]);

  const showLoading = shouldShowSectionLoading(myAppointmentsLoading, appointmentsLastLoadedAt);

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../../../assets/icon.png')} style={styles.logoMark} />
          <Text style={[styles.headerTitle, { color: c.text, flex: 1 }]}>Meine Termine</Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderItem={({ item, section }) => (
          <PatientAppointmentCard
            c={c}
            appointment={item}
            isPast={section.isPast}
            onOpenDetail={() => onSelectAppointment(item)}
            onViewTherapist={() => openTherapist(item.therapist)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View>
            {section.isFirstPast ? (
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 8 }}>
                Vergangene Termine
              </Text>
            ) : null}
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 8 }}>
              {section.title}
            </Text>
          </View>
        )}
        renderSectionFooter={() => <View style={{ marginBottom: 12 }} />}
        ListHeaderComponent={(
          <>
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
          </>
        )}
        ListEmptyComponent={(
          showLoading ? (
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
            <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' }}>Keine Termine</Text>
              <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 4 }}>Für diesen Filter gibt es keine Einträge.</Text>
            </View>
          )
        )}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      />
    </View>
  );
}
