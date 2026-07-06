import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

function formatAbsenceRange(von, bis) {
  const start = new Date(von);
  const end = new Date(bis);
  const fmt = (d) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  if (start.toDateString() === end.toDateString()) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
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

function AddAbsenceModal({ c, visible, onClose, onSave, saving }) {
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [grund, setGrund] = useState('URLAUB');

  const handleSave = () => {
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
    // Tagesende für "bis"
    bisDate.setHours(23, 59, 59, 999);
    onSave({ von: vonDate.toISOString(), bis: bisDate.toISOString(), grund });
    setVon('');
    setBis('');
    setGrund('URLAUB');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, padding: 20, gap: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>Abwesenheit eintragen</Text>

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

export function AbsenceScreen({ c, authToken, onBack }) {
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const { toastMsg, toastAnim, showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/schedule/absences`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAbsences(data);
      }
    } catch {}
    finally { setLoading(false); }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async ({ von, bis, grund }) => {
    setSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/schedule/absences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ von, bis, grund }),
      });
      if (res.ok) {
        const { absence, conflicts } = await res.json();
        setAbsences((prev) => [...prev, absence].sort((a, b) => new Date(a.von) - new Date(b.von)));
        setShowAddModal(false);
        if (conflicts && conflicts.length > 0) {
          const names = conflicts.slice(0, 3).map((s) => `• ${s.patientName}`).join('\n');
          Alert.alert(
            'Abwesenheit gespeichert',
            `Es gibt ${conflicts.length} bestehende${conflicts.length === 1 ? 'n Termin' : ' Termine'} in diesem Zeitraum:\n\n${names}${conflicts.length > 3 ? `\n...und ${conflicts.length - 3} weitere` : ''}\n\nBitte informiere deine Patienten.`,
          );
        } else {
          showToast('Abwesenheit gespeichert');
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
      const res = await fetch(`${getBaseUrl()}/schedule/absences/${id}`, {
        method: 'DELETE',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setAbsences((prev) => prev.filter((a) => a.id !== id));
        showToast('Abwesenheit geloescht');
      }
    } catch {
      showToast('Loeschen fehlgeschlagen');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackButton onPress={onBack} c={c} label="Abwesenheiten" />

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
            Trage Urlaub, Fortbildungen oder Krankheitstage ein. Das System prueft auf Konflikte mit bestehenden Terminen und informiert dich.
          </Text>

          <Pressable
            onPress={() => setShowAddModal(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: c.primary, borderStyle: 'dashed' }}
          >
            <Ionicons name="add" size={16} color={c.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Abwesenheit eintragen</Text>
          </Pressable>

          {absences.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Ionicons name="airplane-outline" size={32} color={c.muted} />
              <Text style={{ fontSize: 14, color: c.muted, marginTop: 8 }}>Keine Abwesenheiten eingetragen</Text>
            </View>
          ) : (
            absences.map((absence) => {
              const isPast = new Date(absence.bis) < new Date();
              return (
                <View
                  key={absence.id}
                  style={{
                    backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1,
                    borderColor: c.border, padding: SPACE.md,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    opacity: isPast ? 0.55 : 1,
                    ...SHADOW.card,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${c.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={GRUND_ICONS[absence.grund] ?? 'calendar-outline'} size={18} color={c.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                      {GRUND_LABELS[absence.grund] ?? absence.grund}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.muted }}>{formatAbsenceRange(absence.von, absence.bis)}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(absence.id)}
                    disabled={deletingId === absence.id}
                    style={{ padding: 6 }}
                    hitSlop={8}
                  >
                    {deletingId === absence.id
                      ? <ActivityIndicator size="small" color={c.error} />
                      : <Ionicons name="trash-outline" size={18} color={c.error} />}
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <AddAbsenceModal
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
