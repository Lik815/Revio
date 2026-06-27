import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PendingRequestCard } from './PendingRequestCard';

export function BookedSlotCard({ c, slot, booking, onRespond, onOpenDetail }) {
  const d = new Date(slot.startsAt);
  const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const isPending = booking?.status === 'PENDING';
  const isConfirmed = booking?.status === 'CONFIRMED';

  // Defensiver Fallback: Slot ist BOOKED aber kein Booking-Objekt vorhanden
  if (!booking) {
    return (
      <View style={{ backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border, marginBottom: 8, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.muted, marginRight: 10 }} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted, flex: 1 }}>{timeStr} Uhr · {slot.durationMin} Min</Text>
        <View style={{ backgroundColor: c.mutedBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.muted }}>GEBUCHT</Text>
        </View>
      </View>
    );
  }

  if (isPending) {
    return (
      <PendingRequestCard
        c={c}
        slot={slot}
        booking={booking}
        onRespond={onRespond}
      />
    );
  }

  // CONFIRMED → kompakte tappable Zeile
  if (isConfirmed) {
    return (
      <Pressable
        onPress={() => onOpenDetail?.(booking)}
        style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border, marginBottom: 8, overflow: 'hidden' }}
      >
        <View style={{ width: 4, backgroundColor: c.success ?? '#5A9E8E' }} />
        <View style={{ flex: 1, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{timeStr} Uhr · {slot.durationMin} Min</Text>
            {booking.patientName ? <Text style={{ fontSize: 13, color: c.text, marginTop: 2 }}>{booking.patientName}</Text> : null}
            {booking.patientPhone ? <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{booking.patientPhone}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={{ backgroundColor: c.successBg ?? '#EAF4F1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: c.success ?? '#5A9E8E' }}>GEBUCHT</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={c.muted} />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border, marginBottom: 8, overflow: 'hidden' }}>
      <View style={{ width: 4, backgroundColor: c.muted }} />
      <View style={{ flex: 1, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{timeStr} Uhr · {slot.durationMin} Min</Text>
          {booking.patientName ? <Text style={{ fontSize: 13, color: c.text, marginTop: 2 }}>{booking.patientName}</Text> : null}
          {booking.patientPhone ? <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{booking.patientPhone}</Text> : null}
        </View>
        <View style={{ backgroundColor: c.mutedBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.muted }}>{booking.status ?? 'GEBUCHT'}</Text>
        </View>
      </View>
    </View>
  );
}
