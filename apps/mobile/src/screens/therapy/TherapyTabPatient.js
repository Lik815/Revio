import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl,
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
  // Tapping the next-appointment card's Kommend/Vergangen counters swaps
  // which list renders below — not an inline expansion, so only one list
  // is ever on screen at a time, in the same spot.
  const [activeView, setActiveView] = useState('kommend');
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
  const isPastView = activeView === 'vergangen';
  const activeList = isPastView ? vergangen : kommend;

  const openTherapist = (th) => {
    if (th?.id) onOpenTherapistById(th.id, th);
  };

  const rows = useMemo(() => {
    if (activeList.length === 0) return [{ type: 'empty', key: 'empty' }];
    return activeList.map((appointment, index) => ({
      type: 'appointment', key: appointment.id, appointment,
      isPast: isPastView,
      isFirst: index === 0, isLast: index === activeList.length - 1,
    }));
  }, [activeList, isPastView]);

  const showLoading = shouldShowSectionLoading(myAppointmentsLoading, appointmentsLastLoadedAt);
  const heading = isPastView ? 'Vergangene Termine' : 'Deine Termine';

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
          if (item.type === 'empty') {
            if (!isPastView) {
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
            return (
              <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Keine vergangenen Termine</Text>
              </View>
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
              activeView={activeView}
              onSelectKommend={() => setActiveView('kommend')}
              onSelectVergangen={() => setActiveView('vergangen')}
            />
            <Text style={{ fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 12 }}>{heading}</Text>
          </>
        )}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={therapyRefreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      />
    </View>
  );
}
