import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SHADOW, activeBookingItems } from '../../utils/app-utils';

const FILTER_LIST_TITLES = {
  booked: 'Gebuchte Termine',
  pending: 'Anfragen',
};

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

// Gefilterte Terminliste (Gebucht / Anfragen) aus incomingBookings.
// Der frühere "Frei"-Filter entfällt — freie Slots existieren nicht mehr.
export function TherapistFilteredSlotsScreen({
  filterListKind, incomingBookings,
  onClose, onOpenDetail,
  incomingBookingsLoading, incomingBookingsLastLoadedAt,
  c, styles,
}) {
  const insets = useSafeAreaInsets();

  const items = useMemo(() => {
    const wantKind = filterListKind === 'pending' ? 'requested' : 'booked';
    return activeBookingItems(incomingBookings).filter((it) => it.kind === wantKind);
  }, [incomingBookings, filterListKind]);

  const showLoading = shouldShowSectionLoading(incomingBookingsLoading, incomingBookingsLastLoadedAt);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, backgroundColor: c.background }}>
        <Pressable
          onPress={onClose}
          style={{ alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons name="chevron-back" size={16} color={c.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Zurück</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]}>{FILTER_LIST_TITLES[filterListKind] ?? 'Termine'}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {showLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Ionicons name="calendar-outline" size={28} color={c.muted} style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 14, color: c.muted }}>Keine Einträge</Text>
          </View>
        ) : (
          items.map(({ booking, startsAt, durationMin, kind }) => {
            const d = new Date(startsAt);
            const dateLabel = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
            const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const dotColor = kind === 'requested' ? (c.warning ?? '#B78700') : c.primary;
            return (
              <Pressable
                key={booking.id}
                onPress={() => onOpenDetail?.(booking)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10, ...SHADOW.card }}
              >
                <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: dotColor }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                    {booking?.patientName ?? (kind === 'requested' ? 'Neue Anfrage' : 'Gebucht')}
                  </Text>
                  <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>
                    {dateLabel} · {time} Uhr · {durationMin} Min
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.muted} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
