import React, { useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { RADIUS } from '../utils/app-utils';
import { SLOT_DURATIONS, TIME_HOURS, buildCalendar, formatSlotDate, formatSlotTime } from '../utils/recurring-slots';

const TIME_ROW_HEIGHT = 46;

export function TherapistSlotComposer({ c, onAddSlot, loading = false }) {
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
  const timeScrollRef = useRef(null);

  const handleShowTimePicker = () => {
    setShowTimePicker(true);
    if (!slotPickerDate) return;
    const now = new Date();
    if (slotPickerDate.toDateString() !== now.toDateString()) return;
    const firstAvailableIndex = TIME_HOURS.findIndex((h) => {
      const dt = new Date(slotPickerDate);
      dt.setHours(h, 30, 0, 0);
      return dt > now;
    });
    if (firstAvailableIndex > 0) {
      requestAnimationFrame(() => {
        timeScrollRef.current?.scrollTo({ y: firstAvailableIndex * TIME_ROW_HEIGHT, animated: false });
      });
    }
  };

  const slotIsInFuture = useMemo(() => {
    if (slotPickerDate === null || slotPickerHour === null || slotPickerMinute === null) return null;
    const dt = new Date(slotPickerDate);
    dt.setHours(slotPickerHour, slotPickerMinute, 0, 0);
    return dt > new Date() ? dt : null;
  }, [slotPickerDate, slotPickerHour, slotPickerMinute]);

  const slotReady = slotIsInFuture !== null;

  const handleAddSlot = () => {
    if (!slotReady || loading) return;
    onAddSlot({ startsAt: slotIsInFuture.toISOString(), durationMin: slotPickerDuration });
    setSlotPickerDate(null);
    setSlotPickerHour(null);
    setSlotPickerMinute(null);
    setSlotPickerDuration(20);
  };

  return (
    <>
      <View style={{ marginBottom: 16, gap: 8 }}>
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

        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5, marginBottom: 4 }}>DATUM</Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: slotPickerDate ? c.primary : c.border, paddingHorizontal: 12, paddingVertical: 9 }}
          >
            <Ionicons name="calendar-outline" size={16} color={slotPickerDate ? c.primary : c.muted} />
            <Text style={{ fontSize: 14, color: slotPickerDate ? c.text : c.muted, flex: 1 }}>{formatSlotDate(slotPickerDate)}</Text>
            {slotPickerDate ? <Ionicons name="checkmark-circle" size={16} color={c.primary} /> : null}
          </Pressable>
        </View>

        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5, marginBottom: 4 }}>UHRZEIT</Text>
          <Pressable
            onPress={handleShowTimePicker}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: slotPickerHour !== null ? c.primary : c.border, paddingHorizontal: 12, paddingVertical: 9 }}
          >
            <Ionicons name="time-outline" size={16} color={slotPickerHour !== null ? c.primary : c.muted} />
            <Text style={{ fontSize: 14, color: slotPickerHour !== null ? c.text : c.muted, flex: 1 }}>{formatSlotTime(slotPickerHour, slotPickerMinute)}</Text>
            {slotPickerHour !== null ? <Ionicons name="checkmark-circle" size={16} color={c.primary} /> : null}
          </Pressable>
        </View>

        {slotPickerDate !== null && slotPickerHour !== null && slotIsInFuture === null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.errorBg ?? '#FEF2F2', borderRadius: RADIUS.sm, padding: 10 }}>
            <Ionicons name="alert-circle-outline" size={14} color={c.error} />
            <Text style={{ fontSize: 12, color: c.error }}>Dieser Zeitpunkt liegt in der Vergangenheit.</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleAddSlot}
          disabled={!slotReady || loading}
          style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: slotReady && !loading ? c.primary : c.border, borderRadius: RADIUS.sm, paddingVertical: 12, marginTop: 2 }}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
            {loading
              ? 'Wird angelegt…'
              : slotReady
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
            <ScrollView ref={timeScrollRef} showsVerticalScrollIndicator={false}>
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
