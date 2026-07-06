import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, RADIUS, SHADOW, TUNNEL_HEADERS } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';
import { useToast } from '../../hooks/use-toast';
import { ToastOverlay } from '../../components/ToastOverlay';

function StepperRow({ label, subtitle, value, min, max, onChange, c }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: c.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{label}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          hitSlop={12}
          style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card }}
        >
          <Ionicons name="remove" size={18} color={c.text} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, minWidth: 24, textAlign: 'center' }}>{value}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          hitSlop={12}
          style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card }}
        >
          <Ionicons name="add" size={18} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({ label, subtitle, value, onChange, c, noBorder }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: noBorder ? 0 : 1, borderColor: c.border }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{label}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      <View style={{
        width: 44, height: 26, borderRadius: 13,
        backgroundColor: value ? c.primary : c.border,
        justifyContent: 'center',
        paddingHorizontal: 2,
      }}>
        <View style={{
          width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
          transform: [{ translateX: value ? 18 : 0 }],
        }} />
      </View>
    </Pressable>
  );
}

export function CapacityRuleScreen({ c, authToken, onBack }) {
  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null);
  const { toastMsg, toastAnim, showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/schedule/capacity-rule`, {
        headers: { Authorization: `Bearer ${authToken}`, ...TUNNEL_HEADERS },
      });
      if (res.ok) {
        const data = await res.json();
        setRule(data);
        setDraft({
          maxNeueSerienProWoche: data.maxNeueSerienProWoche,
          maxAnfragenOffen: data.maxAnfragenOffen,
          autoPauseBeiFullCapacity: data.autoPauseBeiFullCapacity,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/schedule/capacity-rule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}`, ...TUNNEL_HEADERS },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        showToast('Kapazitaet gespeichert', 'success');
        await load();
      } else {
        showToast('Fehler beim Speichern', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const isDirty = draft && rule && (
    draft.maxNeueSerienProWoche !== rule.maxNeueSerienProWoche ||
    draft.maxAnfragenOffen !== rule.maxAnfragenOffen ||
    draft.autoPauseBeiFullCapacity !== rule.autoPauseBeiFullCapacity
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <BackButton onPress={onBack} label="Einstellungen" c={c} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Info-Card */}
        <View style={{ backgroundColor: `${c.primary}12`, borderRadius: RADIUS.lg, padding: 16, marginBottom: 20, flexDirection: 'row', gap: 10 }}>
          <Ionicons name="information-circle-outline" size={18} color={c.primary} style={{ marginTop: 1 }} />
          <Text style={{ fontSize: 13, color: c.primary, flex: 1, lineHeight: 19 }}>
            Die Kapazitaetsregel schuetzt vor Ueberbuchung. Das System zaehlt nur bestaetigte neue Serien — nicht eingehende Anfragen.
          </Text>
        </View>

        {loading || !draft ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Status-Karte */}
            <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, marginBottom: 16, ...SHADOW.card }}>
              <View style={{ padding: 16, borderBottomWidth: 1, borderColor: c.border }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>Diese Woche</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, backgroundColor: c.background, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: rule.laufendeNeuaufnahmenDieseWoche >= rule.maxNeueSerienProWoche ? (c.error ?? '#DC2626') : c.primary }}>
                      {rule.laufendeNeuaufnahmenDieseWoche}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.muted, marginTop: 2, textAlign: 'center' }}>von {rule.maxNeueSerienProWoche} genutzt</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: c.background, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: c.text }}>{rule.abgeschlosseneInquiriesCount}</Text>
                    <Text style={{ fontSize: 12, color: c.muted, marginTop: 2, textAlign: 'center' }}>Serien gesamt</Text>
                  </View>
                </View>
              </View>

              {/* Belegungsfaktor-Anzeige */}
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>Belegungsfaktor</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary }}>{Math.round(rule.belegungsfaktor * 100)} %</Text>
                </View>
                <View style={{ height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ width: `${rule.belegungsfaktor * 100}%`, height: '100%', backgroundColor: c.primary, borderRadius: 3 }} />
                </View>
                <Text style={{ fontSize: 11, color: c.muted, marginTop: 6 }}>
                  {rule.abgeschlosseneInquiriesCount < 5
                    ? 'Cold Start — wird nach 5 Serien automatisch kalibriert'
                    : 'Wird automatisch anhand deiner Bestaetigunsquote kalibriert'}
                </Text>
              </View>
            </View>

            {/* Einstellungen */}
            <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, marginBottom: 16, overflow: 'hidden', ...SHADOW.card }}>
              <StepperRow
                label="Neue Serien pro Woche"
                subtitle="Maximale Neuaufnahmen (Reset jeden Montag)"
                value={draft.maxNeueSerienProWoche}
                min={1}
                max={10}
                onChange={(v) => setDraft((d) => ({ ...d, maxNeueSerienProWoche: v }))}
                c={c}
              />
              <StepperRow
                label="Max. offene Anfragen"
                subtitle="Bei Ueberschreitung wirst du aus neuen Suchergebnissen entfernt"
                value={draft.maxAnfragenOffen}
                min={1}
                max={20}
                onChange={(v) => setDraft((d) => ({ ...d, maxAnfragenOffen: v }))}
                c={c}
              />
              <ToggleRow
                label="Auto-Pause bei Vollauslastung"
                subtitle="Automatisch pausieren wenn Wochenlimit erreicht"
                value={draft.autoPauseBeiFullCapacity}
                onChange={(v) => setDraft((d) => ({ ...d, autoPauseBeiFullCapacity: v }))}
                noBorder
                c={c}
              />
            </View>

            {isDirty && (
              <Pressable
                onPress={save}
                disabled={saving}
                style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', opacity: saving ? 0.7 : 1 }}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Aenderungen speichern</Text>}
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}
