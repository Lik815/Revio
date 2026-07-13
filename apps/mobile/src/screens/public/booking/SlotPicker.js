// Wochenbasierter Slot-Picker mit Kalender-Strip (← Woche →) und
// aufklappbaren Tageskarten. Genutzt vom InquiryRequestForm für Einzeltermin
// (Single-Select mit Auto-Weiter) und Serie (Multi-Select bis maxSelect).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, RADIUS, TUNNEL_HEADERS } from '../../../utils/app-utils';
import {
  addWeeks, dateGroupKey, formatWeekRange, getThisWeekMonday, getWeekDays,
  getWeekEnd, groupSlotsByDate, WEEK_DAY_LABELS, weekKey,
} from './booking-form-utils';
import { SlotDayGroup } from './BookingFormShared';

export function SlotPicker({ therapistId, heilmittel, selectedSlot, selectedTermine, multiSelect, maxSelect, onSelectSlot, onPicked, c }) {
  const todayMonday = useMemo(() => getThisWeekMonday(), []);
  const [weekStart, setWeekStart] = useState(() => getThisWeekMonday());
  const [slotsByWeek, setSlotsByWeek] = useState({});
  const [loadingWeek, setLoadingWeek] = useState(null);
  const [errorWeek, setErrorWeek] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);
  const [showAllFor, setShowAllFor] = useState(() => new Set());

  const currentKey = weekKey(weekStart);

  useEffect(() => {
    if (slotsByWeek[currentKey] !== undefined) return;
    setLoadingWeek(currentKey);
    setErrorWeek(null);
    fetch(
      `${getBaseUrl()}/therapists/${therapistId}/available-slots?heilmittel=${encodeURIComponent(heilmittel)}&from=${weekStart.toISOString()}&to=${getWeekEnd(weekStart).toISOString()}`,
      { headers: { ...TUNNEL_HEADERS } },
    )
      .then((r) => r.json())
      .then((data) => {
        const slotList = Array.isArray(data.slots) ? data.slots : [];
        setSlotsByWeek((prev) => ({ ...prev, [currentKey]: slotList }));
        setLoadingWeek(null);
        const firstSlot = slotList[0];
        setExpandedDate(firstSlot ? dateGroupKey(firstSlot.startsAt) : null);
      })
      .catch(() => { setErrorWeek(currentKey); setLoadingWeek(null); });
  }, [currentKey, therapistId, heilmittel]);

  useEffect(() => { setShowAllFor(new Set()); }, [currentKey]);

  const currentSlots = slotsByWeek[currentKey] ?? [];
  const isLoading = loadingWeek === currentKey;
  const hasError = errorWeek === currentKey;

  const byDate = useMemo(() => groupSlotsByDate(currentSlots), [currentSlots]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = today.toISOString().slice(0, 10);
  const isFirstWeek = currentKey === weekKey(todayMonday);
  const weekDays = getWeekDays(weekStart);

  const isSlotActive = (slot) => (multiSelect
    ? (selectedTermine ?? []).some((s) => s.startsAt === slot.startsAt)
    : selectedSlot?.startsAt === slot.startsAt);
  const isSlotDisabled = (slot) => (
    multiSelect && (selectedTermine ?? []).length >= (maxSelect ?? 10) && !isSlotActive(slot)
  );

  return (
    <View style={{ gap: 8 }}>
      {/* Wochen-Strip */}
      <View style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingVertical: 12, paddingHorizontal: 4 }}>
        {/* Header: ← Woche → */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 10 }}>
          <Pressable
            onPress={() => { if (!isFirstWeek) setWeekStart(addWeeks(weekStart, -1)); }}
            disabled={isFirstWeek}
            style={{ padding: 6, opacity: isFirstWeek ? 0.25 : 1 }}
          >
            <Ionicons name="chevron-back" size={18} color={c.text} />
          </Pressable>
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>{formatWeekRange(weekStart)}</Text>
          <Pressable onPress={() => setWeekStart(addWeeks(weekStart, 1))} style={{ padding: 6 }}>
            <Ionicons name="chevron-forward" size={18} color={c.text} />
          </Pressable>
        </View>
        {/* Tages-Zellen */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {weekDays.map((day, idx) => {
            const dk = day.toISOString().slice(0, 10);
            const isPast = day < today;
            const isToday = dk === todayKey;
            const hasSlotsForDay = byDate.some((g) => g.dateKey === dk);
            const hasSelection = multiSelect
              ? (selectedTermine ?? []).some((s) => s.startsAt?.slice(0, 10) === dk)
              : selectedSlot?.startsAt?.slice(0, 10) === dk;
            return (
              <Pressable
                key={dk}
                onPress={() => {
                  if (isPast || !hasSlotsForDay) return;
                  setExpandedDate(expandedDate === dk ? null : dk);
                }}
                style={{ alignItems: 'center', gap: 2, paddingVertical: 2, paddingHorizontal: 4, opacity: isPast ? 0.3 : 1 }}
              >
                <Text style={{ fontSize: 11, color: c.muted, fontWeight: '500' }}>{WEEK_DAY_LABELS[idx]}</Text>
                <Text style={{
                  fontSize: 14,
                  fontWeight: hasSelection || isToday ? '800' : '400',
                  color: hasSelection ? c.primary : isToday ? c.primary : hasSlotsForDay ? c.text : c.muted,
                }}>
                  {day.getDate()}
                </Text>
                <View style={{
                  width: 5, height: 5, borderRadius: 3,
                  backgroundColor: hasSelection ? c.primary : (isToday && hasSlotsForDay ? `${c.primary}60` : 'transparent'),
                }} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Slot-Liste */}
      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 20 }} />
      ) : hasError ? (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <Ionicons name="alert-circle-outline" size={24} color={c.error ?? '#EF4444'} style={{ marginBottom: 6 }} />
          <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center' }}>Termine konnten nicht geladen werden.</Text>
        </View>
      ) : byDate.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center' }}>Keine freien Termine in dieser Woche.</Text>
        </View>
      ) : (
        byDate.map((group) => (
          <SlotDayGroup
            key={group.dateKey}
            group={group}
            isOpen={expandedDate === group.dateKey}
            onToggleOpen={() => setExpandedDate(expandedDate === group.dateKey ? null : group.dateKey)}
            showAll={showAllFor.has(group.dateKey)}
            onShowAll={() => setShowAllFor((prev) => new Set([...prev, group.dateKey]))}
            isSlotActive={isSlotActive}
            isSlotDisabled={isSlotDisabled}
            onPressSlot={(slot) => {
              onSelectSlot(slot);
              if (!multiSelect) onPicked?.(slot);
            }}
            c={c}
          />
        ))
      )}
    </View>
  );
}
