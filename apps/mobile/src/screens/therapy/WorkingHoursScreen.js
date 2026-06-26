import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SHADOW, getBaseUrl, TUNNEL_HEADERS } from '../../utils/app-utils';
import { WEEKDAY_OPTIONS } from '../../utils/recurring-slots';
import { SLOT_DURATIONS, TIME_HOURS, formatSlotTime } from '../../components/SlotComposer';
import { useToast } from '../../hooks/use-toast';
import { ToastOverlay } from '../../components/ToastOverlay';

let blockIdCounter = 0;
function nextBlockId() {
  blockIdCounter += 1;
  return `block-${blockIdCounter}`;
}

function minutesToHourMinute(totalMinutes) {
  return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
}

function hourMinuteToMinutes(hour, minute) {
  return hour * 60 + minute;
}

function emptyBlock() {
  return {
    id: nextBlockId(),
    weekdays: [],
    startMinute: 8 * 60,
    endMinute: 12 * 60,
    durationMin: 20,
  };
}

// Groups flat rules (as returned by GET /therapist/working-hours) back into
// editable "blocks" — rules that share the same time range + duration
// collapse into one block with multiple weekdays selected, so existing
// working hours don't show up as N confusing single-day blocks.
function groupRulesIntoBlocks(rules) {
  const byKey = new Map();
  for (const rule of rules) {
    const key = `${rule.startMinute}-${rule.endMinute}-${rule.durationMin}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: nextBlockId(),
        weekdays: [],
        startMinute: rule.startMinute,
        endMinute: rule.endMinute,
        durationMin: rule.durationMin,
      });
    }
    byKey.get(key).weekdays.push(rule.weekday);
  }
  return [...byKey.values()];
}

function blocksToRules(blocks) {
  return blocks
    .filter((b) => b.weekdays.length > 0 && b.endMinute >= b.startMinute)
    .flatMap((b) =>
      b.weekdays.map((weekday) => ({
        weekday,
        startMinute: b.startMinute,
        endMinute: b.endMinute,
        durationMin: b.durationMin,
      })),
    );
}

function TimePickerModal({ visible, onClose, c, selected, onSelect }) {
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

function WorkingHoursBlockCard({ c, block, onChange, onRemove, canRemove }) {
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const from = minutesToHourMinute(block.startMinute);
  const to = minutesToHourMinute(block.endMinute);
  const invalidRange = block.endMinute < block.startMinute;

  const toggleWeekday = (key) => {
    onChange({
      ...block,
      weekdays: block.weekdays.includes(key)
        ? block.weekdays.filter((k) => k !== key)
        : [...block.weekdays, key],
    });
  };

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12, ...SHADOW.card }}>
      {canRemove ? (
        <Pressable onPress={onRemove} style={{ alignSelf: 'flex-end' }} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={c.muted} />
        </Pressable>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>WOCHENTAGE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: 6 }}>
          {WEEKDAY_OPTIONS.map(({ key, label }) => {
            const active = block.weekdays.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggleWeekday(key)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : c.mutedBg }}
              >
                <Text style={{ fontSize: 12, fontWeight: active ? '700' : '400', color: active ? c.primary : c.muted }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>ZEITBLOCK</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => setShowFromPicker(true)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 9 }}
          >
            <Text style={{ fontSize: 11, color: c.muted }}>Von</Text>
            <Text style={{ fontSize: 14, color: c.text, flex: 1 }}>{formatSlotTime(from.hour, from.minute)}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowToPicker(true)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: invalidRange ? c.error : c.border, paddingHorizontal: 12, paddingVertical: 9 }}
          >
            <Text style={{ fontSize: 11, color: c.muted }}>Bis</Text>
            <Text style={{ fontSize: 14, color: c.text, flex: 1 }}>{formatSlotTime(to.hour, to.minute)}</Text>
          </Pressable>
        </View>
        {invalidRange ? (
          <Text style={{ fontSize: 12, color: c.error }}>„Bis" muss nach „Von" liegen.</Text>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.5 }}>DAUER</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SLOT_DURATIONS.map((dur) => {
            const active = block.durationMin === dur;
            return (
              <Pressable
                key={dur}
                onPress={() => onChange({ ...block, durationMin: dur })}
                style={{ flex: 1, paddingVertical: 7, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : c.mutedBg }}
              >
                <Text style={{ fontSize: 13, fontWeight: active ? '700' : '400', color: active ? c.primary : c.muted }}>{dur}'</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TimePickerModal
        visible={showFromPicker}
        onClose={() => setShowFromPicker(false)}
        c={c}
        selected={from}
        onSelect={(hour, minute) => onChange({ ...block, startMinute: hourMinuteToMinutes(hour, minute) })}
      />
      <TimePickerModal
        visible={showToPicker}
        onClose={() => setShowToPicker(false)}
        c={c}
        selected={to}
        onSelect={(hour, minute) => onChange({ ...block, endMinute: hourMinuteToMinutes(hour, minute) })}
      />
    </View>
  );
}

export function WorkingHoursScreen({ c, authToken, onBack }) {
  const insets = useSafeAreaInsets();
  const { toastMsg, toastAnim, showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [blocks, setBlocks] = useState([emptyBlock()]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/therapist/working-hours`, {
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.rules) && data.rules.length > 0) {
          setBlocks(groupRulesIntoBlocks(data.rules));
        }
      } catch {
        // Keep the default empty block — the therapist can still create
        // working hours even if the initial fetch failed.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authToken]);

  const rules = useMemo(() => blocksToRules(blocks), [blocks]);
  const canSave = rules.length > 0 && !saving;

  const updateBlock = (id, next) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? next : b)));
  };

  const removeBlock = (id) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const addBlock = () => {
    setBlocks((prev) => [...prev, emptyBlock()]);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/working-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ rules }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Arbeitszeiten konnten nicht gespeichert werden.');
        return;
      }
      showToast('Arbeitszeiten gespeichert');
    } catch {
      setError('Arbeitszeiten konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, backgroundColor: c.background }}>
        <Pressable
          onPress={onBack}
          style={{ alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons name="chevron-back" size={16} color={c.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Zurück</Text>
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>Arbeitszeiten</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 13, color: c.muted, lineHeight: 18 }}>
              Lege deine wiederkehrenden Arbeitszeiten fest. Daraus werden automatisch buchbare Termine für die nächsten Wochen erstellt — du musst sie nicht mehr manuell anlegen.
            </Text>

            {blocks.map((block) => (
              <WorkingHoursBlockCard
                key={block.id}
                c={c}
                block={block}
                onChange={(next) => updateBlock(block.id, next)}
                onRemove={() => removeBlock(block.id)}
                canRemove={blocks.length > 1}
              />
            ))}

            <Pressable
              onPress={addBlock}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: c.border, borderStyle: 'dashed' }}
            >
              <Ionicons name="add" size={16} color={c.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Weiteren Zeitblock hinzufügen</Text>
            </Pressable>

            <View style={{ backgroundColor: c.primaryBg, borderRadius: RADIUS.sm, padding: 10 }}>
              <Text style={{ fontSize: 12, color: c.primary, textAlign: 'center' }}>
                Es werden Termine für die nächsten 8 Wochen erstellt.
              </Text>
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 12, gap: 8 }}>
            {!!error && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.errorBg ?? '#FEF2F2', borderRadius: RADIUS.sm, padding: 8 }}>
                <Ionicons name="alert-circle-outline" size={14} color={c.error} />
                <Text style={{ fontSize: 12, color: c.error, flex: 1 }}>{error}</Text>
              </View>
            )}
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={{ backgroundColor: canSave ? c.primary : c.border, borderRadius: RADIUS.sm, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                {saving ? 'Wird gespeichert…' : 'Arbeitszeiten speichern'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}
