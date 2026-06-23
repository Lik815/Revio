import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isSameDay } from '../utils/app-utils';
import { TimelineSlotRow } from './TimelineSlotRow';

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

const TIME_COL_WIDTH = 48;
const DOT_COL_WIDTH = 24;
const LINE_WIDTH = 2;

export function TherapistDayTimeline({
  c, selectedDate, mySlots, incomingBookings,
  slotsLoading, slotsLastLoadedAt, incomingBookingsLoading, incomingBookingsLastLoadedAt,
  onOpenBooking, onOpenFree,
}) {
  const rows = useMemo(() => {
    const bookingBySlotId = {};
    (Array.isArray(incomingBookings) ? incomingBookings : []).forEach((b) => {
      if (b.slotId) bookingBySlotId[b.slotId] = b;
    });

    const daySlots = (Array.isArray(mySlots) ? mySlots : []).filter((s) => (
      s.status !== 'CANCELLED' && isSameDay(new Date(s.startsAt), selectedDate)
    ));

    return daySlots
      .map((slot) => {
        const booking = bookingBySlotId[slot.id] ?? null;
        const kind = slot.status === 'AVAILABLE'
          ? 'free'
          : booking?.status === 'PENDING' ? 'requested' : 'booked';
        return { slot, booking, kind };
      })
      .sort((a, b) => new Date(a.slot.startsAt) - new Date(b.slot.startsAt));
  }, [mySlots, incomingBookings, selectedDate]);

  const showLoading = shouldShowSectionLoading(slotsLoading, slotsLastLoadedAt)
    || shouldShowSectionLoading(incomingBookingsLoading, incomingBookingsLastLoadedAt);

  if (showLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center' }}>
        <Ionicons name="calendar-outline" size={28} color={c.muted} style={{ marginBottom: 8 }} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' }}>Keine Termine an diesem Tag</Text>
        <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
          Wähle einen anderen Tag oder lege neue Slots an.
        </Text>
      </View>
    );
  }

  return (
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
      {rows.map(({ slot, booking, kind }) => {
        const d = new Date(slot.startsAt);
        const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const title = kind === 'free' ? 'Frei' : kind === 'requested' ? 'Neue Anfrage' : (booking?.patientName ?? 'Gebucht');
        return (
          <TimelineSlotRow
            key={slot.id}
            c={c}
            time={time}
            kind={kind}
            title={title}
            durationMin={slot.durationMin}
            onPress={() => {
              if (kind === 'free') onOpenFree?.(slot);
              else onOpenBooking?.(booking);
            }}
          />
        );
      })}
    </View>
  );
}
