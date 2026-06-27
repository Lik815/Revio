import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatDayHeader } from '../utils/app-utils';
import { FreeSlotCard } from './FreeSlotCard';
import { BookedSlotCard } from './BookedSlotCard';

// ─── TherapistTimeline ────────────────────────────────────────────────────────
// Chronologische Timeline: freie Slots + gebuchte Termine; Anfragen bekommen eine eigene Liste.

function getDayKey(isoString) {
  return formatDayHeader(isoString);
}

export function TherapistTimeline({
  c, mySlots, incomingBookings, activeFilter, deletingSlotIds, onCancelSlot, onRespond, onTherapistCancel, slotsLoading, incomingLoading, onOpenDetail,
  selectionMode, selectedSlotIds, onToggleSelect,
}) {
  const items = useMemo(() => {
    if (!Array.isArray(mySlots)) return {};
    const bookingBySlotId = {};
    if (Array.isArray(incomingBookings)) {
      incomingBookings.forEach(b => { if (b.slotId) bookingBySlotId[b.slotId] = b; });
    }

    const visible = mySlots.filter(s => {
      if (s.status === 'CANCELLED') return false;
      if (activeFilter === 'free') return s.status === 'AVAILABLE';
      if (activeFilter === 'booked') return s.status === 'BOOKED' && bookingBySlotId[s.id]?.status === 'CONFIRMED';
      if (activeFilter === 'pending') return s.status === 'BOOKED' && bookingBySlotId[s.id]?.status === 'PENDING';
      return true;
    });

    const sorted = [...visible].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    const groups = {};
    sorted.forEach(slot => {
      const key = getDayKey(slot.startsAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push({ slot, booking: bookingBySlotId[slot.id] ?? null });
    });
    return groups;
  }, [mySlots, incomingBookings, activeFilter]);

  const pendingItems = activeFilter === 'pending'
    ? Object.values(items)
      .reduce((all, dayItems) => all.concat(dayItems), [])
      .sort((a, b) => {
        const aDate = a.booking?.createdAt ?? a.slot.startsAt;
        const bDate = b.booking?.createdAt ?? b.slot.startsAt;
        return new Date(bDate) - new Date(aDate);
      })
    : [];

  if (slotsLoading && (!Array.isArray(mySlots) || mySlots.length === 0)) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (activeFilter === 'pending' && incomingLoading && pendingItems.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  const days = Object.keys(items);
  if (days.length === 0) {
    return (
      <View style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', marginBottom: 4 }}>
        <Ionicons name="calendar-outline" size={28} color={c.muted} style={{ marginBottom: 8 }} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' }}>
          {activeFilter === 'free' ? 'Keine freien Slots' : activeFilter === 'pending' ? 'Keine offenen Anfragen' : 'Keine Termine'}
        </Text>
        <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
          {activeFilter === 'free' ? 'Lege neue Slots über den + Button an.' : 'Neue Einträge erscheinen hier automatisch.'}
        </Text>
      </View>
    );
  }

  if (activeFilter === 'pending') {
    return (
      <>
        {pendingItems.map(({ slot, booking }) => (
          <BookedSlotCard
            key={slot.id}
            c={c}
            slot={slot}
            booking={booking}
            onRespond={onRespond}
            onOpenDetail={onOpenDetail}
          />
        ))}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: c.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.border,
            paddingVertical: 14,
            paddingHorizontal: 16,
            marginTop: 10,
            marginBottom: 8,
          }}
        >
          <Ionicons name="information-circle-outline" size={18} color={c.muted} />
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: c.textMuted ?? c.muted }}>
            Anfragen sind noch nicht in deinem Kalender bestätigt.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      {days.map(day => (
        <View key={day} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 8 }}>{day}</Text>
          {items[day].map(({ slot, booking }) => (
            slot.status === 'AVAILABLE'
              ? (
                <FreeSlotCard
                  key={slot.id} c={c} slot={slot} onCancelSlot={onCancelSlot} deletingSlotIds={deletingSlotIds}
                  selectionMode={selectionMode}
                  isSelected={!!selectedSlotIds?.includes(slot.id)}
                  onToggleSelect={onToggleSelect}
                />
              )
              : <BookedSlotCard key={slot.id} c={c} slot={slot} booking={booking} onRespond={onRespond} onTherapistCancel={onTherapistCancel} onOpenDetail={onOpenDetail} />
          ))}
        </View>
      ))}
    </>
  );
}
