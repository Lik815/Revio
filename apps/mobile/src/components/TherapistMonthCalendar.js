import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOW, isSameDay, startOfDay, activeBookingItems, hasWorkingHoursOnDay, computeDayPeriods, splitAtHourBoundaries } from '../utils/app-utils';
import { buildCalendar } from '../utils/recurring-slots';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const STATUS_RANK = { requested: 2, booked: 1 };

// Monatskalender: markiert Tage mit Terminen und zeigt die Termine des
// gewählten Tages. Quelle: incomingBookings (per startsAt) — keine Slots.
export function TherapistMonthCalendar({
  c, incomingBookings, workingHoursRules = [], blockedTimes = [], selectedDate, onSelectDate,
  visibleMonth, onPrevMonth, onNextMonth, onPressList, onPressToday,
  onOpenBooking,
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

  // Stündliches Raster für das Tagesdetail
  const hourRows = useMemo(() => {
    if (!dayPeriods.length) return [];
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
    const chunks = splitAtHourBoundaries(dayPeriods);
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

        {hourRows.length === 0 ? (
          <Text style={{ fontSize: 13, color: c.muted }}>Keine Arbeitszeit an diesem Tag.</Text>
        ) : (
          hourRows.map(({ hour, items }) => {
            const hourLabel = `${String(hour).padStart(2, '0')}:00`;
            return (
              <View key={hour} style={{ marginBottom: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: c.muted, width: 44, letterSpacing: 0.2 }}>{hourLabel}</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                </View>
                <View style={{ paddingLeft: 44, gap: 5, marginBottom: 6 }}>
                  {items.map((item, idx) => {
                    const startTime = new Date(item.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    const durationMin = Math.round((new Date(item.endsAt) - new Date(item.startsAt)) / 60_000);
                    const durationLabel = durationMin < 60 ? `${durationMin} Min` : (() => { const h = Math.floor(durationMin / 60); const m = durationMin % 60; return m === 0 ? `${h} Std` : `${h} Std ${m} Min`; })();

                    if (item.kind === 'free') {
                      const height = Math.min(Math.max(24, durationMin * 0.8), 120);
                      return <View key={`free-${idx}`} style={{ height }} />;
                    }
                    if (item.kind === 'blocked') {
                      return (
                        <View key={`blocked-${idx}`} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.mutedBg ?? '#F3F4F6' }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{item.blockedTime?.title ?? 'Blockiert'}</Text>
                          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{startTime} · {durationLabel}</Text>
                        </View>
                      );
                    }
                    const title = item.kind === 'requested' ? 'Neue Anfrage' : (item.booking?.patientName ?? 'Gebucht');
                    const cardBg = item.kind === 'requested' ? (c.warningBg ?? '#FEF5DC') : (c.successBg ?? '#EAF4F1');
                    return (
                      <Pressable key={item.booking?.id ?? `booking-${idx}`} onPress={() => onOpenBooking?.(item.booking)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: RADIUS.sm, backgroundColor: cardBg }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{title}</Text>
                          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{startTime} · {durationLabel}</Text>
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
          })
        )}
      </View>
    </View>
  );
}
