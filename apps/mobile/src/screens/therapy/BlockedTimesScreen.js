import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS } from '../../utils/app-utils';
import { useToast } from '../../hooks/use-toast';
import { ToastOverlay } from '../../components/ToastOverlay';
import { BackButton } from '../../components/BackButton';

const GRUND_LABELS = {
  URLAUB: 'Urlaub',
  FORTBILDUNG: 'Fortbildung',
  KRANKHEIT: 'Krankheit',
  SONSTIGES: 'Sonstiges',
};

const GRUND_ICONS = {
  URLAUB: 'airplane-outline',
  FORTBILDUNG: 'school-outline',
  KRANKHEIT: 'medkit-outline',
  SONSTIGES: 'calendar-outline',
};

// Blockzeit (grund=null) → Datum+Uhrzeit-Bereich. Abwesenheit (grund gesetzt) →
// Tages-Bereich, da sie stets auf volle Tage gerundet gespeichert wird.
function formatRange(entry) {
  if (!entry.startsAt) return '—';
  const start = new Date(entry.startsAt);
  const end = entry.endsAt ? new Date(entry.endsAt) : null;

  if (entry.grund) {
    const fmt = (d) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!end || start.toDateString() === end.toDateString()) return fmt(start);
    return `${fmt(start)} – ${fmt(end)}`;
  }

  const date = start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const startTime = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const endTime = end ? end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
  return `${date} · ${startTime}${endTime ? `–${endTime}` : ''} Uhr`;
}

function GrundPicker({ value, onChange, c }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {Object.entries(GRUND_LABELS).map(([key, label]) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingVertical: 7, paddingHorizontal: 12,
              borderRadius: RADIUS.sm,
              borderWidth: 1.5,
              borderColor: active ? c.primary : c.border,
              backgroundColor: active ? `${c.primary}14` : c.card,
            }}
          >
            <Ionicons name={GRUND_ICONS[key]} size={14} color={active ? c.primary : c.muted} />
            <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? c.primary : c.text }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ModeToggle({ mode, onChange, c }) {
  return (
    <View style={{ flexDirection: 'row', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
      {[{ key: 'block', label: 'Blockzeit' }, { key: 'absence', label: 'Abwesenheit' }].map((option, index) => (
        <Pressable
          key={option.key}
          onPress={() => onChange(option.key)}
          style={{
            flex: 1, paddingVertical: 10, alignItems: 'center',
            backgroundColor: mode === option.key ? c.primaryBg : c.card,
            borderLeftWidth: index > 0 ? 1 : 0, borderLeftColor: c.border,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: mode === option.key ? c.primary : c.muted }}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function AddEntryModal({ c, visible, onClose, onSave, saving }) {
  const [mode, setMode] = useState('block');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [title, setTitle] = useState('');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [grund, setGrund] = useState('URLAUB');

  const resetFields = () => {
    setStartsAt(''); setEndsAt(''); setTitle('');
    setVon(''); setBis(''); setGrund('URLAUB');
  };

  const handleSave = () => {
    if (mode === 'block') {
      const s = new Date(startsAt);
      const e = new Date(endsAt);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        Alert.alert('Ungültiges Datum', 'Bitte Datum und Uhrzeit im Format "2026-07-01T09:00" eingeben.');
        return;
      }
      if (e <= s) {
        Alert.alert('Ungültig', 'Das Enddatum muss nach dem Startdatum liegen.');
        return;
      }
      onSave({ startsAt: s.toISOString(), endsAt: e.toISOString(), title: title.trim() || undefined });
    } else {
      const vonDate = new Date(von);
      const bisDate = new Date(bis);
      if (isNaN(vonDate.getTime()) || isNaN(bisDate.getTime())) {
        Alert.alert('Ungültiges Datum', 'Bitte Datum im Format "2026-07-01" eingeben.');
        return;
      }
      if (bisDate < vonDate) {
        Alert.alert('Ungültig', 'Das Enddatum muss nach dem Startdatum liegen.');
        return;
      }
      bisDate.setHours(23, 59, 59, 999);
      onSave({ startsAt: vonDate.toISOString(), endsAt: bisDate.toISOString(), grund });
    }
    resetFields();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, padding: 20, gap: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>Eintrag hinzufügen</Text>

          <ModeToggle mode={mode} onChange={setMode} c={c} />

          {mode === 'block' ? (
            <>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 13, color: c.muted }}>Beginn (z.B. 2026-07-01T09:00)</Text>
                <TextInput
                  value={startsAt}
                  onChangeText={setStartsAt}
                  placeholder="2026-07-01T09:00"
                  placeholderTextColor={c.muted}
                  style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 13, color: c.muted }}>Ende (z.B. 2026-07-01T12:00)</Text>
                <TextInput
                  value={endsAt}
                  onChangeText={setEndsAt}
                  placeholder="2026-07-01T12:00"
                  placeholderTextColor={c.muted}
                  style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 13, color: c.muted }}>Titel (optional)</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="z.B. Pause, Hausbesuch"
                  placeholderTextColor={c.muted}
                  style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
                />
              </View>
            </>
          ) : (
            <>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 13, color: c.muted }}>Von (z.B. 2026-08-01)</Text>
                <TextInput
                  value={von}
                  onChangeText={setVon}
                  placeholder="2026-08-01"
                  placeholderTextColor={c.muted}
                  style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 13, color: c.muted }}>Bis (inkl., z.B. 2026-08-15)</Text>
                <TextInput
                  value={bis}
                  onChangeText={setBis}
                  placeholder="2026-08-15"
                  placeholderTextColor={c.muted}
                  style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
                />
              </View>
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 13, color: c.muted }}>Grund</Text>
                <GrundPicker value={grund} onChange={setGrund} c={c} />
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable
              onPress={() => { resetFields(); onClose(); }}
              style={{ flex: 1, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted }}>Abbrechen</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={{ flex: 1, borderRadius: RADIUS.sm, backgroundColor: saving ? c.border : c.primary, paddingVertical: 12, alignItems: 'center' }}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Speichern</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function BlockedTimesScreen({ c, authToken, onBack }) {
  const insets = useSafeAreaInsets();
  const { toastMsg, toastAnim, showToast } = useToast();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    try {
      // GET /therapist/blocked-times defaults to "jetzt bis +90 Tage" — hier
      // explizit weiter gefasst, damit auch vergangene Abwesenheiten (Historie,
      // wie zuvor bei /schedule/absences) sichtbar bleiben.
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const to = new Date();
      to.setFullYear(to.getFullYear() + 1);
      const res = await fetch(
        `${getBaseUrl()}/therapist/blocked-times?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setEntries(data.blockedTimes ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (payload) => {
    setSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/blocked-times`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setEntries((prev) => [...prev, created].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)));
        setShowAddModal(false);
        if (created.conflicts && created.conflicts.length > 0) {
          const names = created.conflicts.slice(0, 3).map((s) => `• ${s.patientName}`).join('\n');
          Alert.alert(
            'Eintrag gespeichert',
            `Es gibt ${created.conflicts.length} bestehende${created.conflicts.length === 1 ? 'n Termin' : ' Termine'} in diesem Zeitraum:\n\n${names}${created.conflicts.length > 3 ? `\n...und ${created.conflicts.length - 3} weitere` : ''}\n\nBitte informiere deine Patienten.`,
          );
        } else {
          showToast('Gespeichert');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Fehler', data.error ?? 'Speichern fehlgeschlagen');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/blocked-times/${id}`, {
        method: 'DELETE',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        showToast('Gelöscht');
      }
    } catch {
      showToast('Löschen fehlgeschlagen');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackButton onPress={onBack} c={c} label="Abwesenheit & Blockzeiten" />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 13, color: c.muted, lineHeight: 18, marginBottom: 4 }}>
            Blockzeiten und Abwesenheiten schließen Zeitfenster für alle Buchungen aus.
            Nutze „Blockzeit" für Pausen, Hausbesuche oder kurze Reservierungen, und
            „Abwesenheit" für Urlaub, Fortbildung oder Krankheit über mehrere Tage.
          </Text>

          <Pressable
            onPress={() => setShowAddModal(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: c.primary, borderStyle: 'dashed' }}
          >
            <Ionicons name="add" size={16} color={c.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Eintrag hinzufügen</Text>
          </Pressable>

          {entries.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Ionicons name="calendar-outline" size={32} color={c.muted} />
              <Text style={{ fontSize: 14, color: c.muted, marginTop: 8 }}>Keine Einträge vorhanden</Text>
            </View>
          ) : (
            entries.map((entry) => {
              const isPast = new Date(entry.endsAt) < new Date();
              return (
                <View
                  key={entry.id}
                  style={{
                    backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1,
                    borderColor: c.border, padding: SPACE.md,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    opacity: isPast ? 0.55 : 1,
                    ...SHADOW.card,
                  }}
                >
                  {entry.grund ? (
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${c.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={GRUND_ICONS[entry.grund] ?? 'calendar-outline'} size={18} color={c.primary} />
                    </View>
                  ) : null}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                      {entry.grund ? (GRUND_LABELS[entry.grund] ?? entry.grund) : entry.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.muted }}>{formatRange(entry)}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    style={{ padding: 6 }}
                    hitSlop={8}
                  >
                    {deletingId === entry.id
                      ? <ActivityIndicator size="small" color={c.error} />
                      : <Ionicons name="trash-outline" size={18} color={c.error} />}
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <AddEntryModal
        c={c}
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAdd}
        saving={saving}
      />
      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}
