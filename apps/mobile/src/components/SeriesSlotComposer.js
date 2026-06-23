import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { RADIUS } from '../utils/app-utils';
import {
  SLOT_DURATIONS,
  TIME_HOURS,
  buildCalendar,
  formatSlotDate,
  formatSlotTime,
} from './SlotComposer';
import { WEEKDAY_OPTIONS, generateRecurringSlots } from '../utils/recurring-slots';

const TIME_ROW_HEIGHT = 46;
const WEEKS_PRESETS = [2, 4, 8, 12];
const INTERVAL_PRESETS = [1, 2, 3, 4];
const TAKT_PRESETS = [15, 20, 30, 40, 45, 60];
export const MAX_SLOTS = 200;

// Inclusive of both ends: if intervalMin divides evenly into the range, a
// time exactly at `to` is included (matches how Dauer is already treated
// elsewhere in this component — no slot-must-end-before-closing rule exists).
function generateTimeBlock(from, to, intervalMin) {
  if (!from || !to || !intervalMin) return [];
  const fromMin = from.hour * 60 + from.minute;
  const toMin = to.hour * 60 + to.minute;
  if (toMin < fromMin) return [];
  const result = [];
  for (let m = fromMin; m <= toMin; m += intervalMin) {
    result.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return result;
}

function mergeTimes(existing, additions) {
  const merged = [...existing];
  additions.forEach((t) => {
    if (!merged.some((e) => e.hour === t.hour && e.minute === t.minute)) merged.push(t);
  });
  return merged.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
}

function CalendarPickerModal({ visible, onClose, c, calendarMonth, setCalendarMonth, selectedDate, onSelectDate, minDate }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
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
            const minBoundary = minDate ?? new Date();
            const minDay = new Date(minBoundary);
            minDay.setHours(0, 0, 0, 0);
            const cells = buildCalendar(calendarMonth.year, calendarMonth.month);
            const rows = [];
            for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
            return rows.map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', marginBottom: 4 }}>
                {row.map((day, ci) => {
                  if (!day) return <View key={ci} style={{ flex: 1 }} />;
                  const date = new Date(calendarMonth.year, calendarMonth.month, day);
                  const isPast = date < minDay;
                  const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                  return (
                    <Pressable
                      key={ci}
                      disabled={isPast}
                      onPress={() => { onSelectDate(date); onClose(); }}
                      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 20, backgroundColor: isSelected ? c.primary : 'transparent' }}
                    >
                      <Text style={{ fontSize: 14, color: isPast ? c.muted : isSelected ? '#fff' : c.text, fontWeight: isSelected ? '700' : '400', opacity: isPast ? 0.35 : 1 }}>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ));
          })()}
          <Pressable onPress={onClose} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>Abbrechen</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SingleTimePickerModal({ visible, onClose, c, selected, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: 360 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 14 }}>Uhrzeit wählen</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {TIME_HOURS.map((h) => (
              <View key={h} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                {[0, 30].map((m) => {
                  const isSelected = selected && selected.hour === h && selected.minute === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => { onSelect(h, m); onClose(); }}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: isSelected ? c.primary : c.border, backgroundColor: isSelected ? c.primaryBg : c.card }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '400', color: isSelected ? c.primary : c.text }}>
                        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={{ marginTop: 8, alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>Abbrechen</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const SeriesSlotComposer = forwardRef(function SeriesSlotComposer({ c, onAddSlots, onStateChange }, ref) {
  const [startDate, setStartDate] = useState(null);
  const [endMode, setEndMode] = useState('weeks');
  const [endDate, setEndDate] = useState(null);
  const [weeksCount, setWeeksCount] = useState(4);
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);
  const [selectedTimes, setSelectedTimes] = useState([]);
  const [duration, setDuration] = useState(20);
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [timesMode, setTimesMode] = useState('einzeln');
  const [blockFrom, setBlockFrom] = useState(null);
  const [blockTo, setBlockTo] = useState(null);
  const [blockInterval, setBlockInterval] = useState(20);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showBlockFromPicker, setShowBlockFromPicker] = useState(false);
  const [showBlockToPicker, setShowBlockToPicker] = useState(false);
  const [startCalendarMonth, setStartCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [endCalendarMonth, setEndCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const timeScrollRef = useRef(null);

  const toggleWeekday = (key) =>
    setSelectedWeekdays((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const toggleTime = (hour, minute) =>
    setSelectedTimes((prev) => {
      const exists = prev.some((t) => t.hour === hour && t.minute === minute);
      if (exists) return prev.filter((t) => !(t.hour === hour && t.minute === minute));
      return [...prev, { hour, minute }].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
    });

  const blockTimes = useMemo(
    () => generateTimeBlock(blockFrom, blockTo, blockInterval),
    [blockFrom, blockTo, blockInterval],
  );

  const handleApplyBlock = () => {
    if (blockTimes.length === 0) return;
    setSelectedTimes((prev) => mergeTimes(prev, blockTimes));
  };

  const resolvedEndDate = useMemo(() => {
    if (endMode === 'date') return endDate;
    if (!startDate) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + weeksCount * 7 - 1);
    return d;
  }, [endMode, endDate, startDate, weeksCount]);

  const generatedSlots = useMemo(() => generateRecurringSlots({
    startDate,
    endDate: resolvedEndDate,
    weekdays: selectedWeekdays,
    times: selectedTimes,
    durationMin: duration,
    intervalWeeks,
  }), [startDate, resolvedEndDate, selectedWeekdays, selectedTimes, duration, intervalWeeks]);

  const count = generatedSlots.length;
  const overLimit = count > MAX_SLOTS;
  const canSubmit = !!startDate && !!resolvedEndDate && selectedWeekdays.length > 0
    && selectedTimes.length > 0 && count > 0 && !overLimit;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onAddSlots(generatedSlots);
  };

  useImperativeHandle(ref, () => ({ submit: handleSubmit }), [handleSubmit]);

  useEffect(() => {
    onStateChange?.({ canSubmit, count, overLimit });
  }, [canSubmit, count, overLimit]);

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>STARTDATUM</Text>
        <Pressable
          onPress={() => setShowStartPicker(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: startDate ? c.primary : c.border, paddingHorizontal: 12, paddingVertical: 10 }}
        >
          <Ionicons name="calendar-outline" size={16} color={startDate ? c.primary : c.muted} />
          <Text style={{ fontSize: 14, color: startDate ? c.text : c.muted, flex: 1 }}>{formatSlotDate(startDate)}</Text>
          {startDate ? <Ionicons name="checkmark-circle" size={16} color={c.primary} /> : null}
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>ENDE</Text>
        <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: RADIUS.full, borderWidth: 1, borderColor: c.border, padding: 4 }}>
          {[{ key: 'weeks', label: 'Anzahl Wochen' }, { key: 'date', label: 'Enddatum' }].map(({ key, label }) => {
            const active = endMode === key;
            return (
              <Pressable
                key={key}
                onPress={() => setEndMode(key)}
                style={{ flex: 1, borderRadius: RADIUS.full, paddingVertical: 10, alignItems: 'center', backgroundColor: active ? c.primary : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? '#fff' : c.muted }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {endMode === 'weeks' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WEEKS_PRESETS.map((w) => {
              const active = weeksCount === w;
              return (
                <Pressable
                  key={w}
                  onPress={() => setWeeksCount(w)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : c.mutedBg }}
                >
                  <Text style={{ fontSize: 13, fontWeight: active ? '700' : '400', color: active ? c.primary : c.muted }}>{w} Wo.</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Pressable
            onPress={() => setShowEndPicker(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: endDate ? c.primary : c.border, paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Ionicons name="calendar-outline" size={16} color={endDate ? c.primary : c.muted} />
            <Text style={{ fontSize: 14, color: endDate ? c.text : c.muted, flex: 1 }}>{formatSlotDate(endDate)}</Text>
            {endDate ? <Ionicons name="checkmark-circle" size={16} color={c.primary} /> : null}
          </Pressable>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>WOCHENTAGE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WEEKDAY_OPTIONS.map(({ key, label }) => {
            const active = selectedWeekdays.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggleWeekday(key)}
                style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : c.mutedBg }}
              >
                <Text style={{ fontSize: 13, fontWeight: active ? '700' : '400', color: active ? c.primary : c.muted }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>UHRZEITEN</Text>

        <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: RADIUS.full, borderWidth: 1, borderColor: c.border, padding: 4 }}>
          {[{ key: 'einzeln', label: 'Einzeln' }, { key: 'block', label: 'Zeitblock' }].map(({ key, label }) => {
            const active = timesMode === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTimesMode(key)}
                style={{ flex: 1, borderRadius: RADIUS.full, paddingVertical: 10, alignItems: 'center', backgroundColor: active ? c.primary : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? '#fff' : c.muted }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {selectedTimes.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {selectedTimes.map((t) => (
              <Pressable
                key={`${t.hour}-${t.minute}`}
                onPress={() => toggleTime(t.hour, t.minute)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: c.primary, backgroundColor: c.primaryBg }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>{formatSlotTime(t.hour, t.minute)}</Text>
                <Ionicons name="close" size={14} color={c.primary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {timesMode === 'einzeln' ? (
          <Pressable
            onPress={() => setShowTimePicker(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.mutedBg, alignSelf: 'flex-start' }}
          >
            <Ionicons name="add" size={14} color={c.muted} />
            <Text style={{ fontSize: 13, color: c.muted }}>Uhrzeit hinzufügen</Text>
          </Pressable>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setShowBlockFromPicker(true)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: blockFrom ? c.primary : c.border, paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 11, color: c.muted }}>Von</Text>
                <Text style={{ fontSize: 14, color: blockFrom ? c.text : c.muted, flex: 1 }}>
                  {blockFrom ? formatSlotTime(blockFrom.hour, blockFrom.minute) : 'wählen'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowBlockToPicker(true)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: blockTo ? c.primary : c.border, paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 11, color: c.muted }}>Bis</Text>
                <Text style={{ fontSize: 14, color: blockTo ? c.text : c.muted, flex: 1 }}>
                  {blockTo ? formatSlotTime(blockTo.hour, blockTo.minute) : 'wählen'}
                </Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>TAKT</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TAKT_PRESETS.map((mins) => {
                const active = blockInterval === mins;
                return (
                  <Pressable
                    key={mins}
                    onPress={() => setBlockInterval(mins)}
                    style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : c.mutedBg }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: active ? '700' : '400', color: active ? c.primary : c.muted }}>{mins} Min.</Text>
                  </Pressable>
                );
              })}
            </View>

            {blockFrom && blockTo && blockTimes.length === 0 ? (
              <Text style={{ fontSize: 12, color: c.error }}>„Bis" muss nach „Von" liegen.</Text>
            ) : null}

            <Pressable
              onPress={handleApplyBlock}
              disabled={blockTimes.length === 0}
              style={{ paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center', backgroundColor: blockTimes.length > 0 ? c.primary : c.border }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                {blockTimes.length > 0
                  ? `${blockTimes.length} ${blockTimes.length === 1 ? 'Uhrzeit' : 'Uhrzeiten'} übernehmen`
                  : 'Übernehmen'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>DAUER</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SLOT_DURATIONS.map((dur) => {
            const active = duration === dur;
            return (
              <Pressable
                key={dur}
                onPress={() => setDuration(dur)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : c.mutedBg }}
              >
                <Text style={{ fontSize: 13, fontWeight: active ? '700' : '400', color: active ? c.primary : c.muted }}>{dur}'</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>WIEDERHOLUNG</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {INTERVAL_PRESETS.map((n) => {
            const active = intervalWeeks === n;
            return (
              <Pressable
                key={n}
                onPress={() => setIntervalWeeks(n)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : c.mutedBg }}
              >
                <Text style={{ fontSize: 13, fontWeight: active ? '700' : '400', color: active ? c.primary : c.muted }}>
                  {n === 1 ? 'Jede Woche' : `Alle ${n} Wo.`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>


      <CalendarPickerModal
        visible={showStartPicker}
        onClose={() => setShowStartPicker(false)}
        c={c}
        calendarMonth={startCalendarMonth}
        setCalendarMonth={setStartCalendarMonth}
        selectedDate={startDate}
        onSelectDate={setStartDate}
        minDate={new Date()}
      />

      <CalendarPickerModal
        visible={showEndPicker}
        onClose={() => setShowEndPicker(false)}
        c={c}
        calendarMonth={endCalendarMonth}
        setCalendarMonth={setEndCalendarMonth}
        selectedDate={endDate}
        onSelectDate={setEndDate}
        minDate={startDate ?? new Date()}
      />

      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setShowTimePicker(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: 360 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 14 }}>Uhrzeiten wählen</Text>
            <ScrollView ref={timeScrollRef} showsVerticalScrollIndicator={false}>
              {TIME_HOURS.map((h) => (
                <View key={h} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                  {[0, 30].map((m) => {
                    const isSelected = selectedTimes.some((t) => t.hour === h && t.minute === m);
                    return (
                      <Pressable
                        key={m}
                        onPress={() => toggleTime(h, m)}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: isSelected ? c.primary : c.border, backgroundColor: isSelected ? c.primaryBg : c.card }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '400', color: isSelected ? c.primary : c.text }}>
                          {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => setShowTimePicker(false)} style={{ marginTop: 8, backgroundColor: c.primary, borderRadius: RADIUS.sm, alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Fertig</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <SingleTimePickerModal
        visible={showBlockFromPicker}
        onClose={() => setShowBlockFromPicker(false)}
        c={c}
        selected={blockFrom}
        onSelect={(hour, minute) => setBlockFrom({ hour, minute })}
      />

      <SingleTimePickerModal
        visible={showBlockToPicker}
        onClose={() => setShowBlockToPicker(false)}
        c={c}
        selected={blockTo}
        onSelect={(hour, minute) => setBlockTo({ hour, minute })}
      />
    </View>
  );
});
