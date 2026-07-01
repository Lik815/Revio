import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOW, isSameDay, activeBookingItems } from '../utils/app-utils';
import { TimelineSlotRow } from './TimelineSlotRow';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

const TIME_COL_WIDTH = 48;
const DOT_COL_WIDTH = 24;
const LINE_WIDTH = 2;

// Tagesansicht: rendert die Termine (Buchungen) des gewählten Tages aus
// incomingBookings (per startsAt) — keine freien Slots mehr.
export function TherapistDayTimeline({
  c, selectedDate, incomingBookings,
  incomingBookingsLoading, incomingBookingsLastLoadedAt,
  onOpenBooking,
}) {
  const rows = useMemo(() => (
    activeBookingItems(incomingBookings).filter((it) => isSameDay(new Date(it.startsAt), selectedDate))
  ), [incomingBookings, selectedDate]);

  const dayHeading = useMemo(
    () => selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [selectedDate],
  );

  const showLoading = shouldShowSectionLoading(incomingBookingsLoading, incomingBookingsLastLoadedAt);

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 16, ...SHADOW.card }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 14 }}>
        {dayHeading}
      </Text>

      {showLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : rows.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Ionicons name="calendar-outline" size={28} color={c.muted} style={{ marginBottom: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' }}>Keine Termine an diesem Tag</Text>
          <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
            Wähle einen anderen Tag.
          </Text>
        </View>
      ) : (
        <View style={{ position: 'relative' }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: TIME_COL_WIDTH + DOT_COL_WIDTH / 2 - LINE_WIDTH / 2,
              top: 14,
              bottom: 14,
              width: LINE_WIDTH,
              backgroundColor: c.border,
            }}
          />
          {rows.map(({ booking, startsAt, durationMin, kind }) => {
            const d = new Date(startsAt);
            const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const title = kind === 'requested' ? 'Neue Anfrage' : (booking?.patientName ?? 'Gebucht');
            return (
              <TimelineSlotRow
                key={booking.id}
                c={c}
                time={time}
                kind={kind}
                title={title}
                durationMin={durationMin}
                onPress={() => onOpenBooking?.(booking)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
