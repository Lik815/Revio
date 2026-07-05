import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, RADIUS, TUNNEL_HEADERS } from '../../utils/app-utils';
import { useConfigOptions } from '../../hooks/use-config-options';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useToast } from '../../hooks/use-toast';
import { ToastOverlay } from '../../components/ToastOverlay';
import { BackButton } from '../../components/BackButton';

// Vorgegebene Farbpalette fuer Heilmittel-Kategorien
const COLOR_PALETTE = [
  '#2AAE6E', // Gruen
  '#2563EB', // Blau
  '#7C3AED', // Lila
  '#EA580C', // Orange
  '#DC2626', // Rot
  '#DB2777', // Pink
  '#0891B2', // Himmelblau
  '#CA8A04', // Gelb-Ocker
];

export function TherapistServicesScreen({ c, authToken, onBack }) {
  const insets = useSafeAreaInsets();
  const { heilmittelOptions } = useConfigOptions();
  const loggedInTherapist = useAppStore(appStoreSelectors.loggedInTherapist);
  const { toastMsg, toastAnim, showToast } = useToast();

  const ownHeilmittel = (loggedInTherapist?.heilmittel ?? []);
  const ownSet = new Set(Array.isArray(ownHeilmittel) ? ownHeilmittel : String(ownHeilmittel).split(',').map(s => s.trim()).filter(Boolean));
  const filteredHeilmittelOptions = heilmittelOptions.filter(
    (opt) => ownSet.has(opt.key) || ownSet.has(opt.label),
  );

  // { heilmittelKey: { durationMin, isActive, colorHex } }
  const [services, setServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // heilmittelKey | null

  useEffect(() => {
    let cancelled = false;
    const configTimeout = setTimeout(() => { if (!cancelled) setLoading(false); }, 5000);
    fetch(`${getBaseUrl()}/therapist/services`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : { services: [] }))
      .then((data) => {
        if (cancelled) return;
        const map = {};
        for (const svc of data.services ?? []) {
          map[svc.heilmittelKey] = {
            durationMin: svc.durationMin,
            isActive: svc.isActive,
            colorHex: svc.colorHex ?? null,
          };
        }
        setServices(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) { clearTimeout(configTimeout); setLoading(false); } });
    return () => { cancelled = true; clearTimeout(configTimeout); };
  }, [authToken]);

  const saveService = async (heilmittelKey, durationMin, isActive, colorHex) => {
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
        body: JSON.stringify({ durationMin: parsed, isActive, colorHex: colorHex ?? null }),
      });
      if (res.ok) {
        setServices((prev) => ({ ...prev, [heilmittelKey]: { durationMin: parsed, isActive, colorHex: colorHex ?? null } }));
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
            Lege fest, wie lange eine Behandlung bei dir dauert und wähle eine Farbe für die Kalenderansicht.
          </Text>

          {filteredHeilmittelOptions.map((opt) => {
            const current = services[opt.key];
            const isActive = current?.isActive ?? false;
            const durationMin = String(current?.durationMin ?? 20);
            const colorHex = current?.colorHex ?? null;

            return (
              <ServiceRow
                key={opt.key}
                c={c}
                label={opt.label}
                heilmittelKey={opt.key}
                isActive={isActive}
                durationMin={durationMin}
                colorHex={colorHex}
                saving={saving === opt.key}
                onSave={(dur, active, color) => saveService(opt.key, dur, active, color)}
              />
            );
          })}
        </ScrollView>
      )}

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}

function ColorSwatch({ color, selected, onPress, c }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: color,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: selected ? 2 : 0,
        borderColor: '#fff',
        // Outer ring when selected
        shadowColor: selected ? color : 'transparent',
        shadowOpacity: selected ? 0.6 : 0,
        shadowRadius: selected ? 4 : 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: selected ? 4 : 0,
      }}
    >
      {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
    </Pressable>
  );
}

function ServiceRow({ c, label, heilmittelKey, isActive, durationMin: initialDuration, colorHex: initialColor, saving, onSave }) {
  const [active, setActive] = useState(isActive);
  const [duration, setDuration] = useState(initialDuration);
  const [color, setColor] = useState(initialColor);

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 14, gap: 10 }}>
      {/* Kopfzeile: Label + Farbpunkt + Toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          {color && (
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
          )}
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{label}</Text>
        </View>
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
        <>
          {/* Dauer */}
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
          </View>

          {/* Farbpalette */}
          <View>
            <Text style={{ fontSize: 13, color: c.muted, marginBottom: 8 }}>Farbe im Kalender</Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {/* Keine Farbe */}
              <Pressable
                onPress={() => setColor(null)}
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: c.mutedBg ?? '#F3F4F6',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: color === null ? c.primary : c.border,
                }}
              >
                <Ionicons name="close" size={14} color={c.muted} />
              </Pressable>
              {COLOR_PALETTE.map((hex) => (
                <ColorSwatch
                  key={hex}
                  color={hex}
                  selected={color === hex}
                  onPress={() => setColor(hex)}
                  c={c}
                />
              ))}
            </View>
          </View>

          {/* Speichern-Button */}
          <Pressable
            onPress={() => onSave(duration, active, color)}
            disabled={saving}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              paddingVertical: 9, borderRadius: RADIUS.sm,
              backgroundColor: saving ? c.border : c.primary,
            }}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Speichern</Text>
                </>
            }
          </Pressable>
        </>
      )}

      {!active && (
        <Pressable
          onPress={() => { setActive(true); onSave(duration, true, color); }}
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
