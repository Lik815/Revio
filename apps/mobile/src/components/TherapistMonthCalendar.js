import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOW, isSameDay, startOfDay, activeBookingItems, hasWorkingHoursOnDay, computeDayPeriods } from '../utils/app-utils';
import { buildCalendar } from '../utils/recurring-slots';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const STATUS_RANK = { requested: 2, booked: 1 };

// Monatskalender: markiert Tage mit Terminen und zeigt die Termine des
// gewählten Tages. Quelle: incomingBookings (per startsAt) — keine Slots.
function hexLightBg(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.13)`;
}

export function TherapistMonthCalendar({
  c, incomingBookings, workingHoursRules = [], blockedTimes = [], selectedDate, onSelectDate,
  visibleMonth, onPrevMonth, onNextMonth, onPressList, onPressToday,
  onOpenBooking,
  servicesByKey = {},
}) {
  const items = useMemo(() => activeBookingItems(incomingBookings), [incomingBookings]);

  const dayStatuses = useMemo(() => {
    const statusByDay = {};
    // Buchungen eintragen
    items.forEach(({ startsAt, kind }) => {
      const d = new Date(startsAt);
      if (d.getFullYear() !== visibleMonth.year || d.getMonth() !== visibleMonth.month) return;
      const day = d.getDate();
      if ((STATUS_RANK[kind] ?? 0) > (STATUS_RANK[statusByDay[day]] ?? 0)) statusByDay[day] = kind;
    });
    // Arbeitstage ohne Buchungen als 'free' markieren
    const daysInMonth = new Date(visibleMonth.year, visibleMonth.month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      if (statusByDay[day]) continue;
      const date = new Date(visibleMonth.year, visibleMonth.month, day);
      if (hasWorkingHoursOnDay(workingHoursRules, date)) statusByDay[day] = 'free';
    }
    return statusByDay;
  }, [items, visibleMonth.year, visibleMonth.month, workingHoursRules]);

  const dotColorFor = (status) => ({
    requested: c.warning ?? '#B78700',
    booked: c.primary,
    free: c.success ?? '#5A9E8E',
  }[status] ?? c.border);

  const rows = useMemo(() => {
    const cells = buildCalendar(visibleMonth.year, visibleMonth.month);
    const out = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [visibleMonth.year, visibleMonth.month]);

  const monthLabel = useMemo(
    () => new Date(visibleMonth.year, visibleMonth.month).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
    [visibleMonth.year, visibleMonth.month],
  );
  const today = startOfDay(new Date());

  const dayPeriods = useMemo(
    () => computeDayPeriods(workingHoursRules, blockedTimes, incomingBookings, selectedDate),
    [workingHoursRules, blockedTimes, incomingBookings, selectedDate],
  );

  const [calCardAreaWidth, setCalCardAreaWidth] = useState(0);

  const CAL_PIXELS_PER_MIN = 2.0;
  const CAL_TIME_COL = 44;
  const CAL_CARD_GAP = 5;

  const dayTimeline = useMemo(() => {
    if (!dayPeriods.length) return null;
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
    const totalHeight = (dayEndMin - dayStartMin) * CAL_PIXELS_PER_MIN;
    const startSlot = Math.floor(dayStartMin / 30);
    const endSlot = Math.ceil(dayEndMin / 30);
    const gridLines = Array.from({ length: endSlot - startSlot }, (_, i) => {
      const slotMin = (startSlot + i) * 30;
      const h = Math.floor(slotMin / 60);
      const m = slotMin % 60;
      return { label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, top: (slotMin - dayStartMin) * CAL_PIXELS_PER_MIN };
    });
    const nonFree = dayPeriods.filter((p) => p.kind !== 'free');
    const sorted = [...nonFree].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    const colEnds = [];
    const withCols = sorted.map((item) => {
      const start = new Date(item.startsAt).getTime();
      const end = new Date(item.endsAt).getTime();
      let col = colEnds.findIndex((ce) => ce <= start);
      if (col === -1) col = colEnds.length;
      colEnds[col] = end;
      return { item, col };
    });
    const positioned = withCols.map(({ item, col }) => {
      const start = new Date(item.startsAt).getTime();
      const end = new Date(item.endsAt).getTime();
      const maxCol = Math.max(...withCols.filter(({ item: o }) => new Date(o.startsAt).getTime() < end && new Date(o.endsAt).getTime() > start).map(({ col: c }) => c));
      const d = new Date(item.startsAt);
      const itemMin = d.getHours() * 60 + d.getMinutes() - dayStartMin;
      const durationMin = Math.round((end - start) / 60_000);
      return { item, col, totalCols: maxCol + 1, top: itemMin * CAL_PIXELS_PER_MIN, height: Math.max(28, durationMin * CAL_PIXELS_PER_MIN) };
    });
    return { totalHeight, gridLines, positioned };
  }, [dayPeriods, selectedDate, workingHoursRules]);

  const dayHeading = selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View style={{ marginBottom: 12 }}>
      {/* Monats-Navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <Pressable onPress={onPrevMonth} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: c.text }}>{monthLabel}</Text>
          <Ionicons name="chevron-down" size={16} color={c.muted} />
        </View>
        <Pressable onPress={onNextMonth} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="chevron-forward" size={20} color={c.text} />
        </Pressable>
        <Pressable
          onPress={onPressToday}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.full, borderWidth: 1, borderColor: c.border }}
        >
          <Ionicons name="today-outline" size={16} color={c.text} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>Heute</Text>
        </Pressable>
        <Pressable
          onPress={onPressList}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.full, borderWidth: 1, borderColor: c.border }}
        >
          <Ionicons name="list-outline" size={16} color={c.text} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>Liste</Text>
        </Pressable>
      </View>

      {/* Wochentags-Header */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {WEEKDAY_LABELS.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: c.muted }}>{d}</Text>
        ))}
      </View>

      {/* Raster */}
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', marginBottom: 6 }}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={{ flex: 1 }} />;
            const date = new Date(visibleMonth.year, visibleMonth.month, day);
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, today);
            const status = dayStatuses[day];
            return (
              <Pressable key={ci} onPress={() => onSelectDate(date)} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: 38, height: 38, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSelected ? c.text : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: isSelected ? '#fff' : (isToday ? c.primary : c.text) }}>{day}</Text>
                </View>
                <View
                  style={{
                    width: 6, height: 6, borderRadius: 3, marginTop: 3,
                    backgroundColor: isSelected ? '#fff' : (status ? dotColorFor(status) : c.border),
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Tagesdetail */}
      <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 16, marginTop: 16, ...SHADOW.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: c.text, flex: 1 }}>{dayHeading}</Text>
          {(() => {
            const bookedCount = dayPeriods.filter((p) => p.kind === 'booked' || p.kind === 'requested').length;
            return bookedCount > 0 ? (
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary }}>
                {bookedCount} {bookedCount === 1 ? 'Termin' : 'Termine'}
              </Text>
            ) : null;
          })()}
        </View>

        {!dayTimeline ? (
          <Text style={{ fontSize: 13, color: c.muted }}>Keine Arbeitszeit an diesem Tag.</Text>
        ) : (
          <View
            style={{ height: dayTimeline.totalHeight, position: 'relative' }}
            onLayout={(e) => setCalCardAreaWidth(e.nativeEvent.layout.width - CAL_TIME_COL - CAL_CARD_GAP)}
          >
            {dayTimeline.gridLines.map(({ label, top }) => (
              <View key={label} style={{ position: 'absolute', top, left: 0, right: 0, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, width: CAL_TIME_COL }}>{label}</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              </View>
            ))}
            {calCardAreaWidth > 0 && dayTimeline.positioned.map(({ item, col, totalCols, top, height }) => {
              const colW = (calCardAreaWidth - CAL_CARD_GAP * (totalCols - 1)) / totalCols;
              const cardLeft = CAL_TIME_COL + CAL_CARD_GAP + col * (colW + CAL_CARD_GAP);
              const showSub = height >= 40;
              const startTime = new Date(item.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
              const durationMin = Math.round((new Date(item.endsAt) - new Date(item.startsAt)) / 60_000);
              const durationLabel = durationMin < 60 ? `${durationMin} Min` : (() => { const hh = Math.floor(durationMin / 60); const mm = durationMin % 60; return mm === 0 ? `${hh} Std` : `${hh} Std ${mm} Min`; })();
              if (item.kind === 'blocked') {
                return (
                  <View key={`blocked-${item.blockedTime?.id ?? item.startsAt}`} style={{ position: 'absolute', top, left: cardLeft, width: colW, height, paddingVertical: 4, paddingHorizontal: 8, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.mutedBg ?? '#F3F4F6', justifyContent: 'center', overflow: 'hidden' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: c.text }} numberOfLines={1}>{item.blockedTime?.title ?? 'Blockiert'}</Text>
                    {showSub ? <Text style={{ fontSize: 11, color: c.muted }} numberOfLines={1}>{startTime} · {durationLabel}</Text> : null}
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
              return (
                <Pressable key={item.booking?.id ?? `booking-${item.startsAt}`} onPress={() => onOpenBooking?.(item.booking)} style={{ position: 'absolute', top, left: cardLeft, width: colW, height, paddingVertical: 4, paddingHorizontal: 8, borderRadius: RADIUS.sm, backgroundColor: cardBg, borderLeftWidth: 3, borderLeftColor: accentColor, justifyContent: 'center', overflow: 'hidden' }}>
                  {showSub && heilmittel ? (
                    <Text style={{ fontSize: 10, fontWeight: '700', color: accentColor, marginBottom: 2 }} numberOfLines={1}>{heilmittel}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: c.text, flex: 1 }} numberOfLines={1}>{title}</Text>
                    {item.kind === 'requested' ? (
                      <View style={{ backgroundColor: c.warning ?? '#B78700', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginLeft: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>NEU</Text>
                      </View>
                    ) : <Ionicons name="chevron-forward" size={13} color={c.muted} />}
                  </View>
                  {showSub ? <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }} numberOfLines={1}>{startTime} · {durationLabel}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
