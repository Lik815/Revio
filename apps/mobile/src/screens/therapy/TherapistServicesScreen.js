import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, Switch, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, RADIUS, TUNNEL_HEADERS } from '../../utils/app-utils';
import { useConfigOptions } from '../../hooks/use-config-options';
import { useToast } from '../../hooks/use-toast';
import { ToastOverlay } from '../../components/ToastOverlay';
import { BackButton } from '../../components/BackButton';

const COLOR_PALETTE = [
  { hex: '#2AAE6E', label: 'Gruen' },
  { hex: '#2563EB', label: 'Blau' },
  { hex: '#7C3AED', label: 'Lila' },
  { hex: '#EA580C', label: 'Orange' },
  { hex: '#DC2626', label: 'Rot' },
  { hex: '#DB2777', label: 'Pink' },
  { hex: '#0891B2', label: 'Himmelblau' },
  { hex: '#CA8A04', label: 'Ocker' },
];

function colorLabel(hex) {
  return COLOR_PALETTE.find((c) => c.hex === hex)?.label ?? null;
}

export function TherapistServicesScreen({ c, authToken, onBack }) {
  const { heilmittelOptions } = useConfigOptions();
  const { toastMsg, toastAnim, showToast } = useToast();

  // server state: { [key]: { durationMin, isActive, colorHex } }
  const [services, setServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // local edits not yet saved: { [key]: { durationMin, isActive, colorHex } }
  const [pending, setPending] = useState({});

  // accordion: which key is expanded
  const [expanded, setExpanded] = useState(null);

  // filter: 'active' | 'inactive'
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => { if (!cancelled) setLoading(false); }, 5000);
    fetch(`${getBaseUrl()}/therapist/services`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    })
      .then((r) => (r.ok ? r.json() : { services: [] }))
      .then((data) => {
        if (cancelled) return;
        const map = {};
        for (const svc of data.services ?? []) {
          map[svc.heilmittelKey] = {
            durationMin: svc.durationMin ?? 20,
            isActive: svc.isActive,
            colorHex: svc.colorHex ?? null,
          };
        }
        setServices(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) { clearTimeout(t); setLoading(false); } });
    return () => { cancelled = true; clearTimeout(t); };
  }, [authToken]);

  // Merge server state with local edits for a given key
  const resolved = (key) => {
    const base = services[key] ?? { durationMin: 20, isActive: false, colorHex: null };
    return { ...base, ...(pending[key] ?? {}) };
  };

  const patch = (key, changes) => {
    setPending((prev) => {
      const base = services[key] ?? { durationMin: 20, isActive: false, colorHex: null };
      const current = { ...base, ...(prev[key] ?? {}), ...changes };
      // drop from pending if identical to server state
      const srv = services[key];
      if (
        srv &&
        srv.durationMin === current.durationMin &&
        srv.isActive === current.isActive &&
        srv.colorHex === current.colorHex
      ) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: current };
    });
  };

  const pendingKeys = Object.keys(pending);
  const changeCount = pendingKeys.length;

  const saveAll = async () => {
    if (saving || changeCount === 0) return;
    setSaving(true);
    try {
      const results = await Promise.all(
        pendingKeys.map(async (key) => {
          const { durationMin, isActive, colorHex } = pending[key];
          const dur = parseInt(durationMin, 10);
          if (!Number.isFinite(dur) || dur < 5 || dur > 180) return { key, ok: false };
          const res = await fetch(
            `${getBaseUrl()}/therapist/services/${encodeURIComponent(key)}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
              body: JSON.stringify({ durationMin: dur, isActive, colorHex: colorHex ?? null }),
            },
          );
          return { key, ok: res.ok, value: { durationMin: dur, isActive, colorHex: colorHex ?? null } };
        }),
      );

      const saved = {};
      const failed = [];
      for (const r of results) {
        if (r.ok) saved[r.key] = r.value;
        else failed.push(r.key);
      }

      if (Object.keys(saved).length > 0) {
        setServices((prev) => ({ ...prev, ...saved }));
        setPending((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(saved)) delete next[k];
          return next;
        });
      }

      if (failed.length > 0) {
        showToast(`${failed.length} Leistung(en) konnten nicht gespeichert werden`);
      } else {
        showToast('Gespeichert');
      }
    } catch {
      showToast('Verbindungsfehler');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = heilmittelOptions.filter((o) => resolved(o.key).isActive).length;
  const inactiveCount = heilmittelOptions.length - activeCount;

  const visibleOptions = heilmittelOptions.filter((o) =>
    filter === 'active' ? resolved(o.key).isActive : !resolved(o.key).isActive,
  );

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
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: changeCount > 0 ? 100 : 40, gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontSize: 13, color: c.muted, lineHeight: 18, marginBottom: 4 }}>
              Dauer, Farbe und Sichtbarkeit fur den Kalender festlegen.
            </Text>

            {/* Filter tabs */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              <FilterPill
                c={c}
                label={`${activeCount} aktiv`}
                active={filter === 'active'}
                dotColor={c.primary}
                onPress={() => setFilter('active')}
              />
              <FilterPill
                c={c}
                label={`${inactiveCount} inaktiv`}
                active={filter === 'inactive'}
                dotColor={c.muted}
                onPress={() => setFilter('inactive')}
              />
            </View>

            {visibleOptions.length === 0 && (
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', marginTop: 32 }}>
                {filter === 'active' ? 'Keine aktiven Leistungen.' : 'Keine inaktiven Leistungen.'}
              </Text>
            )}

            {visibleOptions.map((opt) => {
              const { durationMin, isActive, colorHex } = resolved(opt.key);
              const hasPending = !!pending[opt.key];
              const isExpanded = expanded === opt.key;

              return (
                <ServiceCard
                  key={opt.key}
                  c={c}
                  label={opt.label}
                  isActive={isActive}
                  durationMin={durationMin}
                  colorHex={colorHex}
                  hasPending={hasPending}
                  isExpanded={isExpanded}
                  onToggleExpand={() => setExpanded(isExpanded ? null : opt.key)}
                  onToggleActive={(val) => {
                    patch(opt.key, { isActive: val });
                    if (!val && expanded === opt.key) setExpanded(null);
                  }}
                  onDurationChange={(val) => patch(opt.key, { durationMin: val })}
                  onColorChange={(hex) => patch(opt.key, { colorHex: hex })}
                />
              );
            })}
          </ScrollView>

          {/* Sticky save button */}
          {changeCount > 0 && (
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8,
              backgroundColor: c.background,
            }}>
              <Pressable
                onPress={saveAll}
                disabled={saving}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 16, paddingHorizontal: 20,
                  borderRadius: RADIUS.lg,
                  backgroundColor: saving ? c.border : '#1C2B33',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="save-outline" size={20} color="#fff" />}
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                    {changeCount === 1 ? '1 Anderung speichern' : `${changeCount} Anderungen speichern`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </Pressable>
            </View>
          )}
        </>
      )}

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}

function FilterPill({ c, label, active, dotColor, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 10, borderRadius: RADIUS.lg,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: active ? c.primary : c.border,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
      <Text style={{ fontSize: 13, fontWeight: active ? '700' : '400', color: active ? c.text : c.muted }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ServiceCard({
  c, label, isActive, durationMin, colorHex, hasPending,
  isExpanded, onToggleExpand, onToggleActive, onDurationChange, onColorChange,
}) {
  const summaryParts = [];
  if (isActive) {
    if (durationMin) summaryParts.push(`${durationMin} min`);
    const cname = colorLabel(colorHex);
    if (cname) summaryParts.push(cname);
    summaryParts.push('Aktiv');
  } else {
    summaryParts.push('Inaktiv');
    if (!durationMin) summaryParts.push('keine Dauer festgelegt');
  }

  return (
    <View style={{
      backgroundColor: c.card, borderRadius: RADIUS.lg,
      borderWidth: 1, borderColor: hasPending ? c.primary : c.border,
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <Pressable
        onPress={isActive ? onToggleExpand : undefined}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}
      >
        <View style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: colorHex ?? (isActive ? c.primary : c.muted),
        }} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: c.text }}>{label}</Text>
        <Switch
          value={isActive}
          onValueChange={onToggleActive}
          trackColor={{ false: c.border, true: c.primary }}
          thumbColor="#fff"
          ios_backgroundColor={c.border}
        />
        {isActive && (
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={c.muted}
          />
        )}
      </Pressable>

      {/* Summary line (collapsed) */}
      {!isExpanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <Text style={{ fontSize: 12, color: c.muted }}>
            {summaryParts.join(' · ')}
          </Text>
        </View>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 14, borderTopWidth: 1, borderTopColor: c.border }}>
          {/* Dauer stepper */}
          <View>
            <Text style={{ fontSize: 13, color: c.muted, marginBottom: 8, marginTop: 12 }}>Dauer</Text>
            <DurationStepper c={c} value={durationMin} onChange={onDurationChange} />
          </View>

          {/* Farbpalette */}
          <View>
            <Text style={{ fontSize: 13, color: c.muted, marginBottom: 8 }}>Farbe im Kalender</Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Pressable
                onPress={() => onColorChange(null)}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: c.mutedBg ?? '#F3F4F6',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: colorHex === null ? 2 : 1,
                  borderColor: colorHex === null ? c.primary : c.border,
                }}
              >
                <Ionicons name="close" size={16} color={c.muted} />
              </Pressable>
              {COLOR_PALETTE.map(({ hex }) => (
                <ColorSwatch key={hex} color={hex} selected={colorHex === hex} onPress={() => onColorChange(hex)} />
              ))}
            </View>
            <Text style={{ fontSize: 11, color: c.muted, marginTop: 8 }}>
              Diese Farbe wird fur Termine im Kalender verwendet. X = keine Farbe.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function DurationStepper({ c, value, onChange }) {
  const num = parseInt(value, 10) || 20;

  const step = (delta) => {
    const next = Math.min(180, Math.max(5, num + delta));
    onChange(String(next));
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}>
      <Pressable
        onPress={() => step(-5)}
        style={{
          width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm,
          backgroundColor: c.card,
        }}
      >
        <Ionicons name="remove" size={18} color={c.text} />
      </Pressable>
      <View style={{
        width: 90, height: 44, alignItems: 'center', justifyContent: 'center',
        borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border,
      }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{num} min</Text>
      </View>
      <Pressable
        onPress={() => step(5)}
        style={{
          width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm,
          backgroundColor: c.card,
        }}
      >
        <Ionicons name="add" size={18} color={c.text} />
      </Pressable>
    </View>
  );
}

function ColorSwatch({ color, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: color,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: selected ? 2.5 : 0,
        borderColor: '#fff',
        shadowColor: selected ? color : 'transparent',
        shadowOpacity: selected ? 0.5 : 0,
        shadowRadius: selected ? 5 : 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: selected ? 4 : 0,
      }}
    >
      {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
    </Pressable>
  );
}
