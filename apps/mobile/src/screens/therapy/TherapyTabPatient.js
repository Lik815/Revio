import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccountHeader } from '../../components/AccountHeader';
import { PatientAppointmentCard, PatientNextAppointmentCard } from './AppointmentCards';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

export function TherapyTabPatient({
  myAppointments, myAppointmentsLoading,
  therapyRefreshing, appointmentsLastLoadedAt,
  onRefresh, onOpenTherapistById, onSelectAppointment,
  c, t, styles,
}) {
  const [showPast, setShowPast] = useState(false);
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

  // Flat row list instead of SectionList: the "Vergangene Termine
  // anzeigen" toggle and the empty-kommend placeholder both need to sit
  // between the upcoming and past segments, which section header/footer
  // slots can't express once a section's data is empty. Sentinel rows
  // keep that ordering simple and avoid SectionList's empty-list quirks.
  const rows = useMemo(() => {
    const result = [];
    if (kommend.length === 0) {
      result.push({ type: 'empty-kommend', key: 'empty-kommend' });
    } else {
      kommend.forEach((appointment, index) => result.push({
        type: 'appointment', key: appointment.id, appointment, isPast: false,
        isFirst: index === 0, isLast: index === kommend.length - 1,
      }));
    }
    if (vergangen.length > 0) {
      result.push({ type: 'toggle', key: 'toggle' });
      if (showPast) {
        result.push({ type: 'past-label', key: 'past-label' });
        vergangen.forEach((appointment, index) => result.push({
          type: 'appointment', key: appointment.id, appointment, isPast: true,
          isFirst: index === 0, isLast: index === vergangen.length - 1,
        }));
      }
    }
    return result;
  }, [kommend, vergangen, showPast]);

  const showLoading = shouldShowSectionLoading(myAppointmentsLoading, appointmentsLastLoadedAt);

  if (showLoading) {
    return (
      <View style={{ flex: 1 }}>
        <AccountHeader c={c} subtitle="Termine" />
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 20, marginHorizontal: 16 }]}>
          <ActivityIndicator color={c.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AccountHeader c={c} subtitle="Termine" />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => {
          if (item.type === 'empty-kommend') {
            const trulyEmpty = myAppointments.length === 0;
            return (
              <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: trulyEmpty ? 32 : 24, paddingHorizontal: 20, alignItems: 'center', marginBottom: 12 }}>
                {trulyEmpty ? (
                  <>
                    <Ionicons name="calendar-outline" size={36} color={c.muted} style={{ marginBottom: 12 }} />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, textAlign: 'center' }}>Noch keine Termine</Text>
                    <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                      Suche einen Therapeuten und buche deinen ersten Termin.
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Keine kommenden Termine</Text>
                )}
              </View>
            );
          }

          if (item.type === 'toggle') {
            return (
              <Pressable
                onPress={() => setShowPast((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4, marginBottom: 12 }}
              >
                <Ionicons name="time-outline" size={18} color={c.success ?? '#5A9E8E'} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: c.success ?? '#5A9E8E' }}>
                  {showPast
                    ? `Vergangene Termine ausblenden (${vergangen.length})`
                    : `Vergangene Termine anzeigen (${vergangen.length})`}
                </Text>
                <Ionicons name={showPast ? 'chevron-up' : 'chevron-down'} size={16} color={c.muted} />
              </Pressable>
            );
          }

          if (item.type === 'past-label') {
            return (
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 10 }}>
                Vergangene Termine
              </Text>
            );
          }

          return (
            <PatientAppointmentCard
              c={c}
              appointment={item.appointment}
              isPast={item.isPast}
              isFirst={item.isFirst}
              isLast={item.isLast}
              onOpenDetail={() => onSelectAppointment(item.appointment)}
            />
          );
        }}
        ListHeaderComponent={(
          <>
            <PatientNextAppointmentCard
              c={c}
              appointment={nextApt}
              kommendCount={kommend.length}
              vergangenCount={vergangen.length}
              onOpenDetail={() => nextApt && onSelectAppointment(nextApt)}
              onViewTherapist={() => nextApt && openTherapist(nextApt.therapist)}
            />
            <Text style={{ fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 12 }}>Deine Termine</Text>
          </>
        )}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      />
    </View>
  );
}
