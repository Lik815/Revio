import React, { useEffect, useMemo, useState } from 'react';
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

function formatTotalMin(min) {
  if (min === 0) return '0 Min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} Min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m} Min`;
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

function hexLightBg(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.13)`;
}

function StatCell({ icon, value, label, c }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 10 }}>
      <Ionicons name={icon} size={20} color={c.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: c.text }} numberOfLines={1}>{value}</Text>
        {label ? <Text style={{ fontSize: 10, color: c.muted }} numberOfLines={1}>{label}</Text> : null}
      </View>
    </View>
  );
}

export function TherapistDayTimeline({
  c, selectedDate, incomingBookings, workingHoursRules, blockedTimes,
  incomingBookingsLoading, incomingBookingsLastLoadedAt,
  onOpenBooking,
  servicesByKey = {},
}) {
  const [cardAreaWidth, setCardAreaWidth] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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

    return { totalHeight, gridLines, positioned, dayStartMin, dayEndMin };
  }, [periods, selectedDate, workingHoursRules]);

  // Stats für den ausgewählten Tag
  const dayStats = useMemo(() => {
    const appointments = periods.filter(p => p.kind === 'booked' || p.kind === 'requested');
    const totalMin = periods
      .filter(p => p.kind === 'booked')
      .reduce((sum, p) => sum + Math.round((new Date(p.endsAt) - new Date(p.startsAt)) / 60_000), 0);
    const upcoming = appointments
      .filter(p => new Date(p.startsAt) > now)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    const next = upcoming[0] ?? null;
    const nextInMin = next ? Math.max(1, Math.round((new Date(next.startsAt) - now) / 60_000)) : null;
    return { count: appointments.length, totalMin, nextBooking: next?.booking ?? null, nextStartsAt: next?.startsAt ?? null, nextInMin };
  }, [periods, now]);

  // ID des nächsten Termins (für "Nächster"-Badge)
  const nextBookingId = useMemo(() => {
    const upcoming = periods
      .filter(p => (p.kind === 'booked' || p.kind === 'requested') && new Date(p.startsAt) > now)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    return upcoming[0]?.booking?.id ?? null;
  }, [periods, now]);

  // Position der "Jetzt"-Linie im Timeline-Grid
  const nowLineTop = useMemo(() => {
    if (!timeline) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < timeline.dayStartMin || nowMin > timeline.dayEndMin) return null;
    return (nowMin - timeline.dayStartMin) * PIXELS_PER_MIN;
  }, [timeline, now]);

  const showLoading = incomingBookingsLoading && incomingBookingsLastLoadedAt === 0;

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 16, ...SHADOW.card }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 12 }}>
        {dayHeading}
      </Text>

      {/* ── Stats-Streifen ─────────────────────────────────────────── */}
      {!showLoading && (
        <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, marginBottom: 14, overflow: 'hidden' }}>
          <StatCell
            icon="calendar-outline"
            value={`${dayStats.count} ${dayStats.count === 1 ? 'Termin' : 'Termine'}`}
            label="heute"
            c={c}
          />
          <View style={{ width: 1, backgroundColor: c.border, marginVertical: 8 }} />
          <StatCell
            icon="time-outline"
            value={formatTotalMin(dayStats.totalMin)}
            label="Gesamtzeit"
            c={c}
          />
          <View style={{ width: 1, backgroundColor: c.border, marginVertical: 8 }} />
          <StatCell
            icon="play-outline"
            value={dayStats.nextStartsAt ? 'Nächster Termin' : 'Kein Termin'}
            label={dayStats.nextStartsAt ? `in ${dayStats.nextInMin} Min · ${formatTime(dayStats.nextStartsAt)}` : ''}
            c={c}
          />
        </View>
      )}

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
          {/* Zeitraster-Linien */}
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

          {/* ── "Jetzt"-Linie ─────────────────────────────────────── */}
          {nowLineTop !== null && (
            <View style={{ position: 'absolute', top: nowLineTop, left: 0, right: 0, zIndex: 10 }}>
              {/* Label im Zeitspalten-Bereich */}
              <View style={{ position: 'absolute', top: -13, left: 0, width: TIME_COL_WIDTH }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: c.primary, lineHeight: 11 }}>Jetzt</Text>
                <Text style={{ fontSize: 9, fontWeight: '800', color: c.primary, lineHeight: 11 }}>
                  {`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}
                </Text>
              </View>
              {/* Punkt + Linie */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: TIME_COL_WIDTH - 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
                <View style={{ flex: 1, height: 1.5, backgroundColor: c.primary }} />
              </View>
            </View>
          )}

          {/* Termin-Karten */}
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
            const heilmittel = item.booking?.heilmittel;
            const serviceColor = heilmittel ? (servicesByKey[heilmittel]?.colorHex ?? null) : null;
            const cardBg = item.kind === 'requested'
              ? (c.warningBg ?? '#FEF5DC')
              : (hexLightBg(serviceColor) ?? c.successBg ?? '#EAF4F1');
            const accentColor = item.kind === 'requested'
              ? (c.warning ?? '#B78700')
              : (serviceColor ?? c.primary);
            const isNext = item.booking?.id != null && item.booking.id === nextBookingId;

            return (
              <Pressable
                key={item.booking?.id ?? `booking-${item.startsAt}`}
                onPress={() => onOpenBooking?.(item.booking)}
                style={{
                  position: 'absolute', top, left: cardLeft, width: colW, height,
                  paddingVertical: 4, paddingHorizontal: 8,
                  borderRadius: RADIUS.sm, backgroundColor: cardBg,
                  borderLeftWidth: 3, borderLeftColor: accentColor,
                  justifyContent: 'center', overflow: 'hidden',
                }}
              >
                {/* Name + Badges */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: c.text, flex: 1 }} numberOfLines={1}>
                    {title}
                  </Text>
                  {isNext && (
                    <View style={{ backgroundColor: accentColor, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>Nächster</Text>
                    </View>
                  )}
                  {item.kind === 'requested' ? (
                    <View style={{ backgroundColor: c.warning ?? '#B78700', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginLeft: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>NEU</Text>
                    </View>
                  ) : !isNext ? (
                    <Ionicons name="chevron-forward" size={13} color={c.muted} />
                  ) : null}
                </View>

                {/* Subtitle: Zeit · Dauer · [Heilmittel-Pill] */}
                {showSubtitle ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <Text style={{ fontSize: 11, color: c.muted }} numberOfLines={1}>
                      {formatTime(item.startsAt)} · {formatDuration(item.startsAt, item.endsAt)}
                    </Text>
                    {heilmittel ? (
                      <View style={{ backgroundColor: accentColor + '28', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, flexShrink: 0 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: accentColor }}>{heilmittel}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
