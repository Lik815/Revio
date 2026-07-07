import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

function parseNextSlot(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const sorted = [...slots].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const next = sorted[0];
  const date = new Date(next.startsAt);
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrowDate.toDateString();

  let dayLabel;
  if (date.toDateString() === todayStr) {
    dayLabel = 'Heute';
  } else if (date.toDateString() === tomorrowStr) {
    dayLabel = 'Morgen';
  } else {
    dayLabel = date.toLocaleDateString('de-DE', { weekday: 'long' });
  }

  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  const thisWeekCount = sorted.filter((s) => {
    const d = new Date(s.startsAt);
    return d > date && d <= weekEnd;
  }).length;

  const subtitle = thisWeekCount > 0 ? 'Weitere Termine diese Woche verfügbar.' : null;

  return { dayLabel, time, subtitle };
}

export function TherapistNextSlotBanner({ c, slots, styles, onPress }) {
  const info = parseNextSlot(slots);
  if (!info) return null;

  return (
    <View style={[styles.infoSection, {
      backgroundColor: c.card,
      borderColor: c.border,
      padding: 0,
      overflow: 'hidden',
    }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: c.primary,
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Ionicons name="calendar-outline" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: c.primary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
              Nächster freier Termin
            </Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: c.text }}>
              {info.dayLabel}, {info.time} Uhr
            </Text>
            {info.subtitle ? (
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{info.subtitle}</Text>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={onPress}
          style={{
            backgroundColor: c.primary,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Termine ansehen</Text>
          <Ionicons name="chevron-forward" size={13} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
