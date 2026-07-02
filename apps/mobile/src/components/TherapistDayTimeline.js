import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOW, computeDayPeriods } from '../utils/app-utils';

const PIXELS_PER_MIN = 2.0;
const TIME_COL_WIDTH = 52;
const CARD_GAP = 6;

function formatTimeFromMin(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

// Greedy interval scheduling: assigns each item a column to avoid visual overlaps.
function assignColumns(items) {
  const sorted = [...items].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const colEnds = [];

  const withCols = sorted.map((item) => {
    const start = new Date(item.startsAt).getTime();
    const end = new Date(item.endsAt).getTime();
    let col = colEnds.findIndex((ce) => ce <= start);
    if (col === -1) col = colEnds.length;
    colEnds[col] = end;
    return { item, col };
  });

  return withCols.map(({ item, col }) => {
    const start = new Date(item.startsAt).getTime();
    const end = new Date(item.endsAt).getTime();
    const maxCol = Math.max(...withCols
      .filter(({ item: o }) => new Date(o.startsAt).getTime() < end && new Date(o.endsAt).getTime() > start)
      .map(({ col: c }) => c));
    return { item, col, totalCols: maxCol + 1 };
  });
}

export function TherapistDayTimeline({
  c, selectedDate, incomingBookings, workingHoursRules, blockedTimes,
  incomingBookingsLoading, incomingBookingsLastLoadedAt,
  onOpenBooking,
}) {
  const [cardAreaWidth, setCardAreaWidth] = useState(0);

  const periods = useMemo(
    () => computeDayPeriods(workingHoursRules, blockedTimes, incomingBookings, selectedDate),
    [workingHoursRules, blockedTimes, incomingBookings, selectedDate],
  );

  const dayHeading = useMemo(
    () => selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [selectedDate],
  );

  const timeline = useMemo(() => {
    const weekday = selectedDate.getDay();
    const activeRules = (Array.isArray(workingHoursRules) ? workingHoursRules : []).filter((r) => {
      if (!r.isActive || r.weekday !== weekday) return false;
      if (r.effectiveFrom && new Date(r.effectiveFrom) > selectedDate) return false;
      if (r.effectiveUntil && new Date(r.effectiveUntil) < selectedDate) return false;
      return true;
    });
    if (!activeRules.length) return null;

    const dayStartMin = Math.min(...activeRules.map((r) => r.startMinute));
    const dayEndMin = Math.max(...activeRules.map((r) => r.endMinute));
    const totalHeight = (dayEndMin - dayStartMin) * PIXELS_PER_MIN;

    const startSlot = Math.floor(dayStartMin / 30);
    const endSlot = Math.ceil(dayEndMin / 30);
    const gridLines = Array.from({ length: endSlot - startSlot }, (_, i) => {
      const slotMin = (startSlot + i) * 30;
      return { slotMin, top: (slotMin - dayStartMin) * PIXELS_PER_MIN };
    });

    const nonFree = periods.filter((p) => p.kind !== 'free');
    const positioned = assignColumns(nonFree).map(({ item, col, totalCols }) => {
      const d = new Date(item.startsAt);
      const itemMinFromStart = d.getHours() * 60 + d.getMinutes() - dayStartMin;
      const durationMin = Math.round((new Date(item.endsAt) - new Date(item.startsAt)) / 60_000);
      return {
        item,
        col,
        totalCols,
        top: itemMinFromStart * PIXELS_PER_MIN,
        height: Math.max(28, durationMin * PIXELS_PER_MIN),
      };
    });

    return { totalHeight, gridLines, positioned };
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
      ) : !timeline ? (
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
        <View
            style={{ height: timeline.totalHeight, position: 'relative' }}
            onLayout={(e) => setCardAreaWidth(e.nativeEvent.layout.width - TIME_COL_WIDTH - CARD_GAP)}
          >
            {timeline.gridLines.map(({ slotMin, top }) => (
              <View
                key={slotMin}
                style={{ position: 'absolute', top, left: 0, right: 0, flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, width: TIME_COL_WIDTH }}>
                  {formatTimeFromMin(slotMin)}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              </View>
            ))}

            {cardAreaWidth > 0 && timeline.positioned.map(({ item, col, totalCols, top, height }) => {
              const colW = (cardAreaWidth - CARD_GAP * (totalCols - 1)) / totalCols;
              const cardLeft = TIME_COL_WIDTH + CARD_GAP + col * (colW + CARD_GAP);
              const showSubtitle = height >= 40;

              if (item.kind === 'blocked') {
                return (
                  <View
                    key={`blocked-${item.blockedTime?.id ?? item.startsAt}`}
                    style={{
                      position: 'absolute', top, left: cardLeft, width: colW, height,
                      paddingVertical: 4, paddingHorizontal: 8,
                      borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border,
                      backgroundColor: c.mutedBg ?? '#F3F4F6',
                      justifyContent: 'center', overflow: 'hidden',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: c.text }} numberOfLines={1}>
                      {item.blockedTime?.title ?? 'Blockiert'}
                    </Text>
                    {showSubtitle ? (
                      <Text style={{ fontSize: 11, color: c.muted }} numberOfLines={1}>
                        {formatTime(item.startsAt)} · {formatDuration(item.startsAt, item.endsAt)}
                      </Text>
                    ) : null}
                  </View>
                );
              }

              const title = item.booking?.patientName ?? (item.kind === 'requested' ? 'Neue Anfrage' : 'Gebucht');
              const cardBg = item.kind === 'requested' ? (c.warningBg ?? '#FEF5DC') : (c.successBg ?? '#EAF4F1');

              return (
                <Pressable
                  key={item.booking?.id ?? `booking-${item.startsAt}`}
                  onPress={() => onOpenBooking?.(item.booking)}
                  style={{
                    position: 'absolute', top, left: cardLeft, width: colW, height,
                    paddingVertical: 4, paddingHorizontal: 8,
                    borderRadius: RADIUS.sm, backgroundColor: cardBg,
                    justifyContent: 'center', overflow: 'hidden',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: c.text, flex: 1 }} numberOfLines={1}>
                      {title}
                    </Text>
                    {item.kind === 'requested' ? (
                      <View style={{ backgroundColor: c.warning ?? '#B78700', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginLeft: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>NEU</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={13} color={c.muted} />
                    )}
                  </View>
                  {showSubtitle ? (
                    <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }} numberOfLines={1}>
                      {formatTime(item.startsAt)} · {formatDuration(item.startsAt, item.endsAt)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
      )}
    </View>
  );
}
