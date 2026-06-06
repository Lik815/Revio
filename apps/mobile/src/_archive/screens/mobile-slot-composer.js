import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  RADIUS,
  formatDayHeader,
} from '../../utils/app-utils';

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

function renderSlotRow({ c, deletingSlotIds, slot, onCancelSlot }) {
  const d = new Date(slot.startsAt);
  const dateStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const isBooked = slot.status === 'BOOKED';
  const isDeleting = deletingSlotIds.includes(slot.id);

  if (isBooked) {
    // Gebuchter Termin — hochwertiger, mehr Infos
    return (
      <View key={slot.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{dateStr} · {timeStr}</Text>
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{slot.durationMin} Min</Text>
          </View>
          <View style={{ backgroundColor: c.successBg ?? '#EAF4F1', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: c.success ?? '#5A9E8E' }}>Gebucht</Text>
          </View>
        </View>
        {slot.patientName ? (
          <View style={{ marginTop: 7, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="person-circle-outline" size={13} color={c.primary} />
              <Text style={{ fontSize: 13, color: c.text, fontWeight: '600' }}>{slot.patientName}</Text>
            </View>
            {slot.patientEmail ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 1 }}>
                <Ionicons name="mail-outline" size={12} color={c.muted} />
                <Text style={{ fontSize: 12, color: c.muted }}>{slot.patientEmail}</Text>
              </View>
            ) : null}
            {slot.patientPhone ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 1 }}>
                <Ionicons name="call-outline" size={12} color={c.muted} />
                <Text style={{ fontSize: 12, color: c.muted }}>{slot.patientPhone}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  // Freier Slot — kompakt, schnell scannbar
  return (
    <View key={slot.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: c.text, fontWeight: '500' }}>{dateStr} · {timeStr}</Text>
        <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{slot.durationMin} Min</Text>
      </View>
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingLeft: 12 }}>
        {isDeleting ? (
          <ActivityIndicator size="small" color={c.muted} />
        ) : (
          <Pressable onPress={() => onCancelSlot(slot.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={16} color={c.muted} />
          </Pressable>
        )}
      </View>
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

export function TherapistSlotList({ c, deletingSlotIds = [], mySlots, onCancelSlot, slotsLoading, groupByStatus = false, emptyText = 'Noch keine Termine angelegt.' }) {
  if (slotsLoading) {
    return <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', paddingVertical: 16 }}>Lädt…</Text>;
  }

  const visibleSlots = Array.isArray(mySlots) ? mySlots.filter((slot) => slot.status !== 'CANCELLED') : [];
  if (visibleSlots.length === 0) {
    return (
      <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', paddingVertical: 12 }}>
        {emptyText}
      </Text>
    );
  }

  if (groupByStatus) {
    const sortedSlots = [...visibleSlots].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    const availableSlots = sortedSlots.filter((slot) => slot.status === 'AVAILABLE');
    const bookedSlots = sortedSlots.filter((slot) => slot.status === 'BOOKED');
    return (
      <>
        {/* Freie Slots — eigene Karte */}
        <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, marginBottom: 12, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.success ?? '#5A9E8E' }} />
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase' }}>Freie Slots · {availableSlots.length}</Text>
          </View>
          <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
            {availableSlots.length === 0
              ? <Text style={{ fontSize: 13, color: c.muted, paddingVertical: 10 }}>Keine freien Slots verfügbar.</Text>
              : availableSlots.map((slot) => renderSlotRow({ c, deletingSlotIds, slot, onCancelSlot }))}
          </View>
        </View>

        {/* Gebuchte Termine — eigene Karte mit Akzent */}
        {bookedSlots.length > 0 && (
          <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase' }}>Gebuchte Termine · {bookedSlots.length}</Text>
            </View>
            <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
              {bookedSlots.map((slot) => renderSlotRow({ c, deletingSlotIds, slot, onCancelSlot }))}
            </View>
          </View>
        )}
      </>
    );
  }

  return visibleSlots.map((slot) => renderSlotRow({ c, deletingSlotIds, slot, onCancelSlot }));
}

export function TherapistSlotManagerCard({ c, deletingSlotIds = [], mySlots, onAddSlot, onCancelSlot, slotsLoading, styles }) {
  return (
    <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Verfügbare Termine</Text>
      <TherapistSlotComposer c={c} onAddSlot={onAddSlot} />
      <TherapistSlotList c={c} deletingSlotIds={deletingSlotIds} mySlots={mySlots} onCancelSlot={onCancelSlot} slotsLoading={slotsLoading} />
    </View>
  );
}

// ─── TherapistTimeline ────────────────────────────────────────────────────────
// Chronologische Timeline: freie Slots + gebuchte Termine + Anfragen nach Tag

function getDayKey(isoString) {
  return formatDayHeader(isoString);
}

function FreeSlotCard({ c, slot, onCancelSlot, deletingSlotIds }) {
  const d = new Date(slot.startsAt);
  const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const isDeleting = deletingSlotIds.includes(slot.id);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      backgroundColor: c.background,
      paddingVertical: 10, paddingHorizontal: 14, marginBottom: 6,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.success ?? '#5A9E8E', marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted }}>{timeStr} Uhr</Text>
        <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{slot.durationMin} Min · Frei</Text>
      </View>
      {isDeleting ? (
        <ActivityIndicator size="small" color={c.muted} />
      ) : (
        <Pressable onPress={() => onCancelSlot(slot.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-outline" size={16} color={c.muted} />
        </Pressable>
      )}
    </View>
  );
}

function BookedSlotCard({ c, slot, booking, onRespond, onTherapistCancel, onOpenDetail }) {
  const [loading, setLoading] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declinedReason, setDeclinedReason] = useState('');
  const [error, setError] = useState('');
  const d = new Date(slot.startsAt);
  const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const isPending = booking?.status === 'PENDING';
  const isConfirmed = booking?.status === 'CONFIRMED';

  // Defensiver Fallback: Slot ist BOOKED aber kein Booking-Objekt vorhanden
  if (!booking) {
    return (
      <View style={{ backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border, marginBottom: 6, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.muted, marginRight: 10 }} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted, flex: 1 }}>{timeStr} Uhr · {slot.durationMin} Min</Text>
        <View style={{ backgroundColor: c.mutedBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.muted }}>GEBUCHT</Text>
        </View>
      </View>
    );
  }

  const handleRespond = async (action) => {
    if (!onRespond || !booking) return;
    setError(''); setLoading(true);
    try {
      const body = action === 'CONFIRM' ? { action: 'CONFIRM' } : { action: 'DECLINE', declinedReason: declinedReason.trim() || undefined };
      await onRespond(booking.id, body);
    } catch (e) {
      setError(e?.message ?? 'Fehler beim Speichern.');
    } finally {
      setLoading(false);
    }
  };

  const accentColor = isPending ? (c.warning ?? '#8A6000') : (c.primary);
  const accentBg = isPending ? (c.warningBg ?? '#FEF5DC') : (c.primaryBg);

  // CONFIRMED → kompakte tappable Zeile
  if (isConfirmed) {
    return (
      <Pressable
        onPress={() => onOpenDetail?.(booking)}
        style={{ backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.primary, marginBottom: 6, overflow: 'hidden' }}
      >
        <View style={{ height: 3, backgroundColor: c.primary }} />
        <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.success ?? '#22c55e', marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{timeStr} Uhr · {slot.durationMin} Min</Text>
            {booking.patientName ? <Text style={{ fontSize: 13, color: c.text, marginTop: 2 }}>{booking.patientName}</Text> : null}
            {booking.patientPhone ? <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{booking.patientPhone}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={{ backgroundColor: c.primaryBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: c.primary }}>GEBUCHT</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={c.muted} />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{
      backgroundColor: c.card, borderRadius: 10, borderWidth: 1,
      borderColor: accentColor, marginBottom: 6, overflow: 'hidden',
    }}>
      <View style={{ height: 3, backgroundColor: accentColor }} />
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{timeStr} Uhr · {slot.durationMin} Min</Text>
            {booking?.patientName ? (
              <Text style={{ fontSize: 13, color: c.text, marginTop: 2 }}>{booking.patientName}</Text>
            ) : null}
            {booking?.patientPhone ? (
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{booking.patientPhone}</Text>
            ) : null}
            {booking?.message ? (
              <Text style={{ fontSize: 12, color: c.muted, fontStyle: 'italic', marginTop: 3 }}>„{booking.message}"</Text>
            ) : null}
          </View>
          <View style={{ backgroundColor: accentBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: accentColor }}>
              {isPending ? 'ANFRAGE' : 'BESTÄTIGT'}
            </Text>
          </View>
        </View>

        {isPending && showDecline && (
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, backgroundColor: c.mutedBg, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: c.muted }} onChangeText={setDeclinedReason}>{declinedReason}</Text>
          </View>
        )}
        {!!error && <Text style={{ fontSize: 12, color: c.error ?? '#DC2626', marginBottom: 6 }}>{error}</Text>}

        {isPending && onRespond && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => showDecline ? handleRespond('DECLINE') : setShowDecline(true)}
              disabled={loading}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted }}>{showDecline ? 'Ablehnen' : 'Ablehnen'}</Text>
            </Pressable>
            <Pressable
              onPress={() => handleRespond('CONFIRM')}
              disabled={loading}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: c.primary, alignItems: 'center' }}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Bestätigen</Text>}
            </Pressable>
          </View>
        )}

        {isConfirmed && onTherapistCancel && (
          <Pressable
            onPress={() => onTherapistCancel(booking.id)}
            style={{ paddingVertical: 6, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 12, color: c.muted }}>Termin absagen</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function TherapistTimeline({ c, mySlots, incomingBookings, activeFilter, deletingSlotIds, onCancelSlot, onRespond, onTherapistCancel, slotsLoading, incomingLoading, onOpenDetail }) {
  const items = useMemo(() => {
    if (!Array.isArray(mySlots)) return {};
    const bookingBySlotId = {};
    if (Array.isArray(incomingBookings)) {
      incomingBookings.forEach(b => { if (b.slotId) bookingBySlotId[b.slotId] = b; });
    }

    const visible = mySlots.filter(s => {
      if (s.status === 'CANCELLED') return false;
      if (activeFilter === 'free') return s.status === 'AVAILABLE';
      if (activeFilter === 'booked') return s.status === 'BOOKED' && bookingBySlotId[s.id]?.status === 'CONFIRMED';
      if (activeFilter === 'pending') return s.status === 'BOOKED' && bookingBySlotId[s.id]?.status === 'PENDING';
      return true;
    });

    const sorted = [...visible].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    const groups = {};
    sorted.forEach(slot => {
      const key = getDayKey(slot.startsAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push({ slot, booking: bookingBySlotId[slot.id] ?? null });
    });
    return groups;
  }, [mySlots, incomingBookings, activeFilter]);

  if (slotsLoading && (!Array.isArray(mySlots) || mySlots.length === 0)) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  const days = Object.keys(items);
  if (days.length === 0) {
    return (
      <View style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', marginBottom: 4 }}>
        <Ionicons name="calendar-outline" size={28} color={c.muted} style={{ marginBottom: 8 }} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, textAlign: 'center' }}>
          {activeFilter === 'free' ? 'Keine freien Slots' : activeFilter === 'pending' ? 'Keine offenen Anfragen' : 'Keine Termine'}
        </Text>
        <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
          {activeFilter === 'free' ? 'Lege neue Slots über den + Button an.' : 'Neue Einträge erscheinen hier automatisch.'}
        </Text>
      </View>
    );
  }

  return (
    <>
      {days.map(day => (
        <View key={day} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 8 }}>{day}</Text>
          {items[day].map(({ slot, booking }) => (
            slot.status === 'AVAILABLE'
              ? <FreeSlotCard key={slot.id} c={c} slot={slot} onCancelSlot={onCancelSlot} deletingSlotIds={deletingSlotIds} />
              : <BookedSlotCard key={slot.id} c={c} slot={slot} booking={booking} onRespond={onRespond} onTherapistCancel={onTherapistCancel} onOpenDetail={onOpenDetail} />
          ))}
        </View>
      ))}
    </>
  );
}
