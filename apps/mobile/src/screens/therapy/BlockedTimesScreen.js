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

function formatRange(startsAt, endsAt) {
  if (!startsAt) return '—';
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  const date = start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const startTime = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const endTime = end ? end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
  return `${date} · ${startTime}${endTime ? `–${endTime}` : ''} Uhr`;
}

// Einfache ISO-Eingabe für MVP: Therapeut gibt Datum+Uhrzeit als Text ein.
// Für Production wäre hier ein DateTimePicker-Modal sinnvoll.
function AddBlockedTimeModal({ c, visible, onClose, onSave, saving }) {
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [title, setTitle] = useState('');

  const handleSave = () => {
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
    onSave({ startsAt: s.toISOString(), endsAt: e.toISOString(), title: title.trim() || 'Blockiert' });
    setStartsAt('');
    setEndsAt('');
    setTitle('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, padding: 20, gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>Blockzeit hinzufügen</Text>

          <Text style={{ fontSize: 13, color: c.muted }}>Beginn (z.B. 2026-07-01T09:00)</Text>
          <TextInput
            value={startsAt}
            onChangeText={setStartsAt}
            placeholder="2026-07-01T09:00"
            placeholderTextColor={c.muted}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
          />

          <Text style={{ fontSize: 13, color: c.muted }}>Ende (z.B. 2026-07-01T12:00)</Text>
          <TextInput
            value={endsAt}
            onChangeText={setEndsAt}
            placeholder="2026-07-01T12:00"
            placeholderTextColor={c.muted}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
          />

          <Text style={{ fontSize: 13, color: c.muted }}>Titel (optional)</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="z.B. Pause, Urlaub, Fortbildung"
            placeholderTextColor={c.muted}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable
              onPress={onClose}
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

  const [blockedTimes, setBlockedTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/blocked-times`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBlockedTimes(data.blockedTimes ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async ({ startsAt, endsAt, title }) => {
    setSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/blocked-times`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ startsAt, endsAt, title }),
      });
      if (res.ok) {
        const created = await res.json();
        setBlockedTimes((prev) => [created, ...prev]);
        setShowAddModal(false);
        showToast('Blockzeit gespeichert');
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
        setBlockedTimes((prev) => prev.filter((b) => b.id !== id));
        showToast('Blockzeit gelöscht');
      }
    } catch {
      showToast('Löschen fehlgeschlagen');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackButton onBack={onBack} c={c} title="Blockzeiten" />

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
            Blockzeiten schließen Zeitfenster für alle Buchungen aus — egal welches Heilmittel.
            Geeignet für Pausen, Urlaub, Hausbesuche oder nicht buchbare Reservierungen.
          </Text>

          <Pressable
            onPress={() => setShowAddModal(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: c.primary, borderStyle: 'dashed' }}
          >
            <Ionicons name="add" size={16} color={c.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Blockzeit hinzufügen</Text>
          </Pressable>

          {blockedTimes.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Ionicons name="calendar-outline" size={32} color={c.muted} />
              <Text style={{ fontSize: 14, color: c.muted, marginTop: 8 }}>Keine Blockzeiten vorhanden</Text>
            </View>
          ) : (
            blockedTimes.map((b) => (
              <View
                key={b.id}
                style={{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: 12, ...SHADOW.card }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{b.title}</Text>
                  <Text style={{ fontSize: 12, color: c.muted }}>{formatRange(b.startsAt, b.endsAt)}</Text>
                </View>
                <Pressable
                  onPress={() => handleDelete(b.id)}
                  disabled={deletingId === b.id}
                  style={{ padding: 6 }}
                  hitSlop={8}
                >
                  {deletingId === b.id
                    ? <ActivityIndicator size="small" color={c.error} />
                    : <Ionicons name="trash-outline" size={18} color={c.error} />}
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <AddBlockedTimeModal
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
