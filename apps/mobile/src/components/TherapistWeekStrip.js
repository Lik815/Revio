import React, { useMemo, useRef } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, addDays, getIsoWeekNumber, isSameDay, startOfDay, activeBookingItems, hasWorkingHoursOnDay } from '../utils/app-utils';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const SWIPE_THRESHOLD = 40;

export function TherapistWeekStrip({
  c, selectedDate, visibleWeekStart, incomingBookings, workingHoursRules = [],
  onSelectDate, onPrevWeek, onNextWeek, onPressCalendar, onPressToday, onPressStats,
}) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(visibleWeekStart, i)),
    [visibleWeekStart],
  );

  const monthYearLabel = useMemo(
    () => visibleWeekStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
    [visibleWeekStart],
  );
  const weekNumber = useMemo(() => getIsoWeekNumber(visibleWeekStart), [visibleWeekStart]);
  const rangeLabel = useMemo(() => {
    const start = visibleWeekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
    const end = addDays(visibleWeekStart, 6).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
    return `${start} – ${end}`;
  }, [visibleWeekStart]);

  const onPrevWeekRef = useRef(onPrevWeek);
  onPrevWeekRef.current = onPrevWeek;
  const onNextWeekRef = useRef(onNextWeek);
  onNextWeekRef.current = onNextWeek;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx <= -SWIPE_THRESHOLD) onNextWeekRef.current();
        else if (gesture.dx >= SWIPE_THRESHOLD) onPrevWeekRef.current();
      },
    }),
  ).current;

  const hasActivity = useMemo(() => {
    const activeDays = activeBookingItems(incomingBookings).map((it) => new Date(it.startsAt));
    // Arbeitstag (Arbeitszeiten vorhanden) ODER Buchungen an dem Tag
    return (day) => hasWorkingHoursOnDay(workingHoursRules, day) || activeDays.some((d) => isSameDay(d, day));
  }, [incomingBookings, workingHoursRules]);

  const today = startOfDay(new Date());

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: c.text }}>
            {monthYearLabel} · Woche {weekNumber}
          </Text>
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>
            {rangeLabel}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {onPressStats && (
            <Pressable
              onPress={onPressStats}
              hitSlop={8}
              style={{ height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Ionicons name="bar-chart-outline" size={14} color={c.text} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>Statistik</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onPressToday}
            hitSlop={8}
            style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Heute</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onPrevWeek} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={18} color={c.muted} />
        </Pressable>

        <View
          style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}
          {...panResponder.panHandlers}
        >
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);
            const marked = hasActivity(day);
            return (
              <Pressable
                key={day.toISOString()}
                onPress={() => onSelectDate(day)}
                style={{
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  borderRadius: RADIUS.md,
                  backgroundColor: isSelected ? c.text : 'transparent',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? '#fff' : c.muted }}>
                  {WEEKDAY_LABELS[(day.getDay() + 6) % 7]}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: isSelected ? '#fff' : (isToday ? c.primary : c.text) }}>
                  {day.getDate()}
                </Text>
                <View style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: marked ? (isSelected ? '#fff' : (c.success ?? '#5A9E8E')) : 'transparent',
                }} />
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={onNextWeek} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        </Pressable>

        <Pressable
          onPress={onPressCalendar}
          hitSlop={8}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginLeft: 6 }}
        >
          <Ionicons name="calendar-outline" size={16} color={c.primary} />
        </Pressable>
      </View>
    </View>
  );
}
