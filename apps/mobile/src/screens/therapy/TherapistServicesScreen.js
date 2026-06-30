import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, RADIUS, TUNNEL_HEADERS } from '../../utils/app-utils';
import { useConfigOptions } from '../../hooks/use-config-options';
import { useToast } from '../../hooks/use-toast';
import { ToastOverlay } from '../../components/ToastOverlay';
import { BackButton } from '../../components/BackButton';

// Therapeut:in konfiguriert hier, welche Heilmittel angeboten werden und
// mit welcher Dauer (überschreibt den globalen Standardwert).
export function TherapistServicesScreen({ c, authToken, onBack }) {
  const insets = useSafeAreaInsets();
  const { heilmittelOptions } = useConfigOptions();
  const { toastMsg, toastAnim, showToast } = useToast();

  const [services, setServices] = useState({});      // { heilmittelKey: { durationMin, isActive } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);         // heilmittelKey | null

  useEffect(() => {
    let cancelled = false;
    // Fallback: after 5 s stop waiting for config options even if still empty,
    // so the screen never spins forever on a slow/failing /config/options call.
    const configTimeout = setTimeout(() => { if (!cancelled) setLoading(false); }, 5000);
    fetch(`${getBaseUrl()}/therapist/services`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : { services: [] }))
      .then((data) => {
        if (cancelled) return;
        const map = {};
        for (const svc of data.services ?? []) {
          map[svc.heilmittelKey] = { durationMin: svc.durationMin, isActive: svc.isActive };
        }
        setServices(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) { clearTimeout(configTimeout); setLoading(false); } });
    return () => { cancelled = true; clearTimeout(configTimeout); };
  }, [authToken]);

  const saveService = async (heilmittelKey, durationMin, isActive) => {
    if (saving) return;
    const parsed = parseInt(durationMin, 10);
    if (!Number.isFinite(parsed) || parsed < 5 || parsed > 180) {
      showToast('Dauer muss zwischen 5 und 180 Minuten liegen.');
      return;
    }
    setSaving(heilmittelKey);
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/services/${encodeURIComponent(heilmittelKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ durationMin: parsed, isActive }),
      });
      if (res.ok) {
        setServices((prev) => ({ ...prev, [heilmittelKey]: { durationMin: parsed, isActive } }));
        showToast('Gespeichert');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? 'Speichern fehlgeschlagen');
      }
    } catch {
      showToast('Verbindungsfehler');
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackButton onPress={onBack} c={c} label="Leistungen" />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : heilmittelOptions.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center' }}>
            Heilmittel konnten nicht geladen werden. Bitte versuche es erneut.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 13, color: c.muted, lineHeight: 18, marginBottom: 4 }}>
            Lege fest, wie lange eine Behandlung bei dir dauert. Patient:innen sehen nur die
            Zeitfenster, die zu ihrer gewählten Leistung und deiner Dauer passen.
          </Text>

          {(heilmittelOptions ?? []).map((opt) => {
            const current = services[opt.key];
            const isActive = current?.isActive ?? false;
            const durationMin = String(current?.durationMin ?? 20);

            return (
              <ServiceRow
                key={opt.key}
                c={c}
                label={opt.label}
                heilmittelKey={opt.key}
                isActive={isActive}
                durationMin={durationMin}
                saving={saving === opt.key}
                onSave={(dur, active) => saveService(opt.key, dur, active)}
              />
            );
          })}
        </ScrollView>
      )}

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}

function ServiceRow({ c, label, heilmittelKey, isActive, durationMin: initialDuration, saving, onSave }) {
  const [active, setActive] = useState(isActive);
  const [duration, setDuration] = useState(initialDuration);

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, flex: 1 }}>{label}</Text>
        <Pressable
          onPress={() => setActive((v) => !v)}
          style={{
            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
            backgroundColor: active ? c.primary : c.mutedBg,
            borderWidth: 1, borderColor: active ? c.primary : c.border,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : c.muted }}>
            {active ? 'Aktiv' : 'Inaktiv'}
          </Text>
        </Pressable>
      </View>

      {active && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 13, color: c.muted, flex: 1 }}>Dauer (Minuten)</Text>
          <TextInput
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            style={{
              borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm,
              backgroundColor: c.mutedBg, color: c.text, fontSize: 14,
              paddingHorizontal: 10, paddingVertical: 6, width: 70, textAlign: 'center',
            }}
          />
          <Pressable
            onPress={() => onSave(duration, active)}
            disabled={saving}
            style={{
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.sm,
              backgroundColor: saving ? c.border : c.primary,
            }}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="checkmark" size={16} color="#fff" />}
          </Pressable>
        </View>
      )}

      {!active && (
        <Pressable
          onPress={() => { setActive(true); onSave(duration, true); }}
          disabled={saving}
        >
          <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>
            Aktivieren und Dauer festlegen
          </Text>
        </Pressable>
      )}
    </View>
  );
}
