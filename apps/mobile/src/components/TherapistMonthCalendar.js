import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOW, isSameDay, startOfDay } from '../utils/app-utils';
import { buildCalendar } from '../utils/recurring-slots';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const STATUS_RANK = { pending: 3, booked: 2, free: 1 };

function getMonthDayStatuses(mySlots, bookingBySlotId, year, month) {
  const statusByDay = {};
  (mySlots ?? []).forEach((slot) => {
    if (slot.status === 'CANCELLED') return;
    const d = new Date(slot.startsAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const day = d.getDate();
    const booking = bookingBySlotId[slot.id];
    const kind = booking?.status === 'PENDING' ? 'pending' : slot.status === 'AVAILABLE' ? 'free' : 'booked';
    if ((STATUS_RANK[kind] ?? 0) > (STATUS_RANK[statusByDay[day]] ?? 0)) statusByDay[day] = kind;
  });
  return statusByDay;
}

export function TherapistMonthCalendar({
  c, mySlots, incomingBookings, selectedDate, onSelectDate,
  visibleMonth, onPrevMonth, onNextMonth, onPressList,
  onOpenBooking, onCancelSlot, deletingSlotIds = [], onAddSlot,
}) {
  const bookingBySlotId = useMemo(() => {
    const map = {};
    (incomingBookings ?? []).forEach((b) => { if (b.slotId) map[b.slotId] = b; });
    return map;
  }, [incomingBookings]);

  const dayStatuses = useMemo(
    () => getMonthDayStatuses(mySlots, bookingBySlotId, visibleMonth.year, visibleMonth.month),
    [mySlots, bookingBySlotId, visibleMonth.year, visibleMonth.month],
  );

  const dotColorFor = (status) => ({
    pending: c.warning ?? '#B78700',
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

  const dayRows = useMemo(() => {
    const daySlots = (mySlots ?? [])
      .filter((s) => s.status !== 'CANCELLED' && isSameDay(new Date(s.startsAt), selectedDate))
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    return daySlots.map((slot) => {
      const booking = bookingBySlotId[slot.id] ?? null;
      const kind = slot.status === 'AVAILABLE' ? 'free' : booking?.status === 'PENDING' ? 'pending' : 'booked';
      return { slot, booking, kind };
    });
  }, [mySlots, bookingBySlotId, selectedDate]);

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
          {dayRows.length > 0 ? (
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.success ?? '#5A9E8E' }}>
              {dayRows.length} {dayRows.length === 1 ? 'Termin' : 'Termine'}
            </Text>
          ) : null}
        </View>

        {dayRows.length === 0 ? (
          <Text style={{ fontSize: 13, color: c.muted }}>Keine Termine an diesem Tag.</Text>
        ) : (
          dayRows.map(({ slot, booking, kind }, index) => {
            const time = new Date(slot.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const isFree = kind === 'free';
            const dotColor = kind === 'pending' ? (c.warning ?? '#B78700') : isFree ? c.muted : (c.success ?? '#5A9E8E');
            const title = isFree ? 'Frei' : (booking?.patientName ?? 'Gebucht');
            const isDeleting = deletingSlotIds.includes(slot.id);

            const rowInner = (
              <>
                <View
                  style={{
                    width: 9, height: 9, borderRadius: 4.5,
                    backgroundColor: isFree ? 'transparent' : dotColor,
                    borderWidth: isFree ? 2 : 0, borderColor: dotColor,
                  }}
                />
                <Text style={{ width: 48, fontSize: 13, fontWeight: '600', color: c.muted }}>{time}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{title}</Text>
                  <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{slot.durationMin} Min</Text>
                </View>
              </>
            );

            const rowStyle = { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.border };

            return isFree ? (
              <View key={slot.id} style={rowStyle}>
                {rowInner}
                {isDeleting ? (
                  <ActivityIndicator size="small" color={c.muted} />
                ) : (
                  <Pressable onPress={() => onCancelSlot?.(slot.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={c.muted} />
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable key={slot.id} onPress={() => onOpenBooking?.(booking)} style={rowStyle}>
                {rowInner}
                <Ionicons name="chevron-forward" size={16} color={c.muted} />
              </Pressable>
            );
          })
        )}

        <Pressable
          onPress={onAddSlot}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 14, marginTop: dayRows.length > 0 ? 0 : 4, borderTopWidth: dayRows.length > 0 ? 1 : 0, borderTopColor: c.border }}
        >
          <Ionicons name="add-circle-outline" size={18} color={c.success ?? '#5A9E8E'} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.success ?? '#5A9E8E' }}>Termin hinzufügen</Text>
        </Pressable>
      </View>
    </View>
  );
}
