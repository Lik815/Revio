import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOW, computeDayPeriods, splitAtHourBoundaries } from '../utils/app-utils';

const TIME_COL_WIDTH = 52;

function formatHour(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(startsAt, endsAt) {
  const mins = Math.round((new Date(endsAt) - new Date(startsAt)) / 60_000);
  if (mins < 60) return `${mins} Min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} Std` : `${h} Std ${m} Min`;
}

function HourBlock({ c, hour, items, onOpenBooking }) {
  return (
    <View style={{ marginBottom: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: c.muted, width: TIME_COL_WIDTH, letterSpacing: 0.2 }}>
          {formatHour(hour)}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>

      <View style={{ paddingLeft: TIME_COL_WIDTH, gap: 5, marginBottom: 8 }}>
        {items.map((item, idx) => {
          const startTime = formatTime(item.startsAt);
          const duration = formatDuration(item.startsAt, item.endsAt);

          if (item.kind === 'free') {
            return (
              <View
                key={`free-${idx}`}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: RADIUS.sm,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.background,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 2, borderColor: c.success ?? '#5A9E8E' }} />
                <Text style={{ fontSize: 13, color: c.muted }}>
                  {startTime} · Frei · {duration}
                </Text>
              </View>
            );
          }

          if (item.kind === 'blocked') {
            return (
              <View
                key={`blocked-${idx}`}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: RADIUS.sm,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.mutedBg ?? '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                  {item.blockedTime?.title ?? 'Blockiert'}
                </Text>
                <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>
                  {startTime} · {duration}
                </Text>
              </View>
            );
          }

          const title = item.kind === 'requested'
            ? 'Neue Anfrage'
            : (item.booking?.patientName ?? 'Gebucht');
          const cardBg = item.kind === 'requested'
            ? (c.warningBg ?? '#FEF5DC')
            : (c.successBg ?? '#EAF4F1');

          return (
            <Pressable
              key={item.booking?.id ?? `booking-${idx}`}
              onPress={() => onOpenBooking?.(item.booking)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: RADIUS.sm,
                backgroundColor: cardBg,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{title}</Text>
                <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{startTime} · {duration}</Text>
              </View>
              {item.kind === 'requested' ? (
                <View style={{ backgroundColor: c.warning ?? '#B78700', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>NEU</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={c.muted} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Tagesansicht: zeigt die gesamte Arbeitszeit als stündliches Raster.
export function TherapistDayTimeline({
  c, selectedDate, incomingBookings, workingHoursRules, blockedTimes,
  incomingBookingsLoading, incomingBookingsLastLoadedAt,
  onOpenBooking,
}) {
  const periods = useMemo(
    () => computeDayPeriods(workingHoursRules, blockedTimes, incomingBookings, selectedDate),
    [workingHoursRules, blockedTimes, incomingBookings, selectedDate],
  );

  const dayHeading = useMemo(
    () => selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [selectedDate],
  );

  const hourRows = useMemo(() => {
    if (!periods.length) return [];

    const weekday = selectedDate.getDay();
    const activeRules = (Array.isArray(workingHoursRules) ? workingHoursRules : []).filter((r) => {
      if (!r.isActive || r.weekday !== weekday) return false;
      if (r.effectiveFrom && new Date(r.effectiveFrom) > selectedDate) return false;
      if (r.effectiveUntil && new Date(r.effectiveUntil) < selectedDate) return false;
      return true;
    });
    if (!activeRules.length) return [];

    const startHour = Math.floor(Math.min(...activeRules.map((r) => r.startMinute)) / 60);
    const endHour = Math.ceil(Math.max(...activeRules.map((r) => r.endMinute)) / 60);

    const chunks = splitAtHourBoundaries(periods);
    const byHour = {};
    for (const chunk of chunks) {
      const h = new Date(chunk.startsAt).getHours();
      if (!byHour[h]) byHour[h] = [];
      byHour[h].push(chunk);
    }

    return Array.from({ length: endHour - startHour }, (_, i) => {
      const h = startHour + i;
      return { hour: h, items: byHour[h] ?? [] };
    });
  }, [periods, selectedDate, workingHoursRules]);

  const showLoading = incomingBookingsLoading && incomingBookingsLastLoadedAt === 0;

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 16, ...SHADOW.card }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 14 }}>
        {dayHeading}
      </Text>

      {showLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : hourRows.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Ionicons name="calendar-outline" size={28} color={c.muted} style={{ marginBottom: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' }}>
            Keine Arbeitszeit an diesem Tag
          </Text>
          <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
            Lege Arbeitszeiten im Profil fest.
          </Text>
        </View>
      ) : (
        hourRows.map(({ hour, items }) => (
          <HourBlock key={hour} c={c} hour={hour} items={items} onOpenBooking={onOpenBooking} />
        ))
      )}
    </View>
  );
}
