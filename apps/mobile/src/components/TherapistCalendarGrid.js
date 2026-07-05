import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, activeBookingItems, hasWorkingHoursOnDay, isSameDay, startOfDay } from '../utils/app-utils';
import { buildCalendar } from '../utils/recurring-slots';
import { TherapistWeekStrip } from './TherapistWeekStrip';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const STATUS_RANK = { requested: 2, booked: 1 };
export const CALENDAR_ROW_H = 53; // Zeilenhöhe: 38px Kreis + 3px gap + 6px Punkt + 6px marginBottom

// Kalendergitter als fixer Header.
// collapsed=true zeigt nur die ausgewählte Woche (Höhe = CALENDAR_ROW_H).
// LayoutAnimation muss vom Aufrufer ausgelöst werden bevor collapsed sich ändert.
export function TherapistCalendarGrid({
  c, incomingBookings, workingHoursRules = [], selectedDate, onSelectDate,
  visibleMonth, onPrevMonth, onNextMonth, onPressList, onPressToday,
  collapsed = false,
  visibleWeekStart, onPrevWeek, onNextWeek, onPressCalendar,
}) {
  const items = useMemo(() => activeBookingItems(incomingBookings), [incomingBookings]);

  const dayStatuses = useMemo(() => {
    const statusByDay = {};
    items.forEach(({ startsAt, kind }) => {
      const d = new Date(startsAt);
      if (d.getFullYear() !== visibleMonth.year || d.getMonth() !== visibleMonth.month) return;
      const day = d.getDate();
      if ((STATUS_RANK[kind] ?? 0) > (STATUS_RANK[statusByDay[day]] ?? 0)) statusByDay[day] = kind;
    });
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

  if (collapsed) {
    return (
      <View style={{ paddingHorizontal: 24 }}>
        <TherapistWeekStrip
          c={c}
          selectedDate={selectedDate}
          visibleWeekStart={visibleWeekStart}
          incomingBookings={incomingBookings}
          workingHoursRules={workingHoursRules}
          onSelectDate={onSelectDate}
          onPrevWeek={onPrevWeek}
          onNextWeek={onNextWeek}
          onPressCalendar={onPressCalendar}
          onPressToday={onPressToday}
        />
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
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
                    width: 38, height: 38, borderRadius: RADIUS.md,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSelected ? c.text : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: isSelected ? '#fff' : (isToday ? c.primary : c.text) }}>
                    {day}
                  </Text>
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
    </View>
  );
}
