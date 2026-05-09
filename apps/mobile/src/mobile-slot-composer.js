import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  RADIUS,
} from './mobile-utils';

const SLOT_DURATIONS = [20, 30, 40, 50, 60];
const TIME_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

function formatSlotDate(d) {
  if (!d) return 'Datum wählen';
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSlotTime(h, m) {
  if (h === null) return 'Uhrzeit wählen';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} Uhr`;
}

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  return cells;
}

function renderSlotRow({ c, slot, onCancelSlot }) {
  const d = new Date(slot.startsAt);
  const label = `${d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  const isBooked = slot.status === 'BOOKED';

  return (
    <View key={slot.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Text style={{ fontSize: 13, color: isBooked ? c.primary : c.text, flex: 1 }}>
        {label} ({slot.durationMin} Min)
      </Text>
      {isBooked ? (
        <View style={{ backgroundColor: c.primaryBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, color: c.primary, fontWeight: '600' }}>Gebucht</Text>
        </View>
      ) : (
        <Pressable onPress={() => onCancelSlot(slot.id)}>
          <Text style={{ fontSize: 12, color: c.error, paddingHorizontal: 8 }}>Löschen</Text>
        </Pressable>
      )}
    </View>
  );
}

export function TherapistSlotComposer({ c, onAddSlot }) {
  const [slotPickerDate, setSlotPickerDate] = useState(null);
  const [slotPickerHour, setSlotPickerHour] = useState(null);
  const [slotPickerMinute, setSlotPickerMinute] = useState(null);
  const [slotPickerDuration, setSlotPickerDuration] = useState(20);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const slotIsInFuture = useMemo(() => {
    if (slotPickerDate === null || slotPickerHour === null || slotPickerMinute === null) return null;
    const dt = new Date(slotPickerDate);
    dt.setHours(slotPickerHour, slotPickerMinute, 0, 0);
    return dt > new Date() ? dt : null;
  }, [slotPickerDate, slotPickerHour, slotPickerMinute]);

  const slotReady = slotIsInFuture !== null;

  const handleAddSlot = () => {
    if (!slotReady) return;
    onAddSlot({ startsAt: slotIsInFuture.toISOString(), durationMin: slotPickerDuration });
    setSlotPickerDate(null);
    setSlotPickerHour(null);
    setSlotPickerMinute(null);
    setSlotPickerDuration(20);
  };

  return (
    <>
      <View style={{ marginBottom: 16, gap: 10 }}>
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5, marginBottom: 4 }}>DATUM</Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: slotPickerDate ? c.primary : c.border, paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Ionicons name="calendar-outline" size={16} color={slotPickerDate ? c.primary : c.muted} />
            <Text style={{ fontSize: 14, color: slotPickerDate ? c.text : c.muted, flex: 1 }}>{formatSlotDate(slotPickerDate)}</Text>
            {slotPickerDate ? <Ionicons name="checkmark-circle" size={16} color={c.primary} /> : null}
          </Pressable>
        </View>

        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5, marginBottom: 4 }}>UHRZEIT</Text>
          <Pressable
            onPress={() => setShowTimePicker(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: slotPickerHour !== null ? c.primary : c.border, paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Ionicons name="time-outline" size={16} color={slotPickerHour !== null ? c.primary : c.muted} />
            <Text style={{ fontSize: 14, color: slotPickerHour !== null ? c.text : c.muted, flex: 1 }}>{formatSlotTime(slotPickerHour, slotPickerMinute)}</Text>
            {slotPickerHour !== null ? <Ionicons name="checkmark-circle" size={16} color={c.primary} /> : null}
          </Pressable>
        </View>

        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5, marginBottom: 4 }}>DAUER</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SLOT_DURATIONS.map((dur) => {
              const active = slotPickerDuration === dur;
              return (
                <Pressable
                  key={dur}
                  onPress={() => setSlotPickerDuration(dur)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : c.mutedBg }}
                >
                  <Text style={{ fontSize: 13, fontWeight: active ? '700' : '400', color: active ? c.primary : c.muted }}>{dur}'</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {slotPickerDate !== null && slotPickerHour !== null && slotIsInFuture === null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.errorBg ?? '#FEF2F2', borderRadius: RADIUS.sm, padding: 10 }}>
            <Ionicons name="alert-circle-outline" size={14} color={c.error} />
            <Text style={{ fontSize: 12, color: c.error }}>Dieser Zeitpunkt liegt in der Vergangenheit.</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleAddSlot}
          disabled={!slotReady}
          style={{ backgroundColor: slotReady ? c.primary : c.border, borderRadius: RADIUS.sm, paddingVertical: 12, alignItems: 'center', marginTop: 2 }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
            {slotReady
              ? `Termin anlegen · ${formatSlotDate(slotPickerDate)}, ${formatSlotTime(slotPickerHour, slotPickerMinute)}`
              : '+ Termin anlegen'}
          </Text>
        </Pressable>
      </View>

      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setShowDatePicker(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Pressable onPress={() => setCalendarMonth((prev) => {
                const d = new Date(prev.year, prev.month - 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })} style={{ padding: 8 }}>
                <Ionicons name="chevron-back" size={20} color={c.text} />
              </Pressable>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: c.text }}>
                {new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </Text>
              <Pressable onPress={() => setCalendarMonth((prev) => {
                const d = new Date(prev.year, prev.month + 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })} style={{ padding: 8 }}>
                <Ionicons name="chevron-forward" size={20} color={c.text} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: c.muted }}>{d}</Text>
              ))}
            </View>
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const cells = buildCalendar(calendarMonth.year, calendarMonth.month);
              const rows = [];
              for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
              return rows.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', marginBottom: 4 }}>
                  {row.map((day, ci) => {
                    if (!day) return <View key={ci} style={{ flex: 1 }} />;
                    const date = new Date(calendarMonth.year, calendarMonth.month, day);
                    const isPast = date < today;
                    const isSelected = slotPickerDate && date.toDateString() === slotPickerDate.toDateString();
                    return (
                      <Pressable
                        key={ci}
                        disabled={isPast}
                        onPress={() => {
                          setSlotPickerDate(date);
                          setShowDatePicker(false);
                        }}
                        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 20, backgroundColor: isSelected ? c.primary : 'transparent' }}
                      >
                        <Text style={{ fontSize: 14, color: isPast ? c.muted : isSelected ? '#fff' : c.text, fontWeight: isSelected ? '700' : '400', opacity: isPast ? 0.35 : 1 }}>{day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ));
            })()}
            <Pressable onPress={() => setShowDatePicker(false)} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ color: c.muted, fontSize: 14 }}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setShowTimePicker(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: 360 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 14 }}>Uhrzeit wählen</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {TIME_HOURS.map((h) => (
                <View key={h} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                  {[0, 30].map((m) => {
                    const isSelected = slotPickerHour === h && slotPickerMinute === m;
                    let isPast = false;
                    if (slotPickerDate) {
                      const dt = new Date(slotPickerDate);
                      dt.setHours(h, m, 0, 0);
                      isPast = dt <= new Date();
                    }
                    return (
                      <Pressable
                        key={m}
                        disabled={isPast}
                        onPress={() => {
                          setSlotPickerHour(h);
                          setSlotPickerMinute(m);
                          setShowTimePicker(false);
                        }}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: isSelected ? c.primary : c.border, backgroundColor: isSelected ? c.primaryBg : isPast ? c.mutedBg : c.card, opacity: isPast ? 0.4 : 1 }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '400', color: isSelected ? c.primary : isPast ? c.muted : c.text }}>
                          {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => setShowTimePicker(false)} style={{ marginTop: 8, alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ color: c.muted, fontSize: 14 }}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function TherapistSlotList({ c, mySlots, onCancelSlot, slotsLoading }) {
  if (slotsLoading) {
    return <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', paddingVertical: 8 }}>Lädt…</Text>;
  }

  const visibleSlots = Array.isArray(mySlots) ? mySlots.filter((slot) => slot.status !== 'CANCELLED') : [];
  if (visibleSlots.length === 0) {
    return (
      <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', paddingVertical: 8 }}>
        Noch keine Termine angelegt.
      </Text>
    );
  }

  return visibleSlots.map((slot) => renderSlotRow({ c, slot, onCancelSlot }));
}

export function TherapistSlotManagerCard({ c, mySlots, onAddSlot, onCancelSlot, slotsLoading, styles }) {
  return (
    <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Verfügbare Termine</Text>
      <TherapistSlotComposer c={c} onAddSlot={onAddSlot} />
      <TherapistSlotList c={c} mySlots={mySlots} onCancelSlot={onCancelSlot} slotsLoading={slotsLoading} />
    </View>
  );
}
