import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS } from '../utils/app-utils';

const WOCHENTAG_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const STATUS_CONFIG = {
  SENT:               { label: 'Neu',           color: '#F59E0B', bg: '#FEF3C7' },
  SEEN:               { label: 'Gesehen',        color: '#3B82F6', bg: '#DBEAFE' },
  COUNTER_PROPOSED:   { label: 'Gegenvorschlag', color: '#8B5CF6', bg: '#EDE9FE' },
  CONFIRMED:          { label: 'Bestätigt',      color: '#10B981', bg: '#D1FAE5' },
  CANCELLED:          { label: 'Abgesagt',       color: '#EF4444', bg: '#FEE2E2' },
  DECLINED:           { label: 'Abgelehnt',      color: '#6B7280', bg: '#F3F4F6' },
  DECLINED_BY_PATIENT:{ label: 'Abgelehnt',      color: '#6B7280', bg: '#F3F4F6' },
  WITHDRAWN:          { label: 'Zurückgezogen',  color: '#6B7280', bg: '#F3F4F6' },
  AUTO_CLOSED:        { label: 'Anderweitig',    color: '#6B7280', bg: '#F3F4F6' },
  EXPIRED:            { label: 'Abgelaufen',     color: '#9CA3AF', bg: '#F9FAFB' },
};

const SLOT_STATUS_CONFIG = {
  PENDING:   { label: 'Offen',      color: '#F59E0B', bg: '#FEF3C7' },
  CONFIRMED: { label: 'Bestätigt',  color: '#10B981', bg: '#D1FAE5' },
  DECLINED:  { label: 'Abgelehnt',  color: '#EF4444', bg: '#FEE2E2' },
};

const CANCEL_REASONS = [
  { key: 'PRAXIS_KRANKHEIT', label: 'Krankheit' },
  { key: 'PRAXIS_ABSAGE',    label: 'Praxis-Absage' },
  { key: 'PATIENT_WUNSCH',   label: 'Patientenwunsch' },
  { key: 'SONSTIGES',        label: 'Sonstiges' },
];

function formatMinutes(min) {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDatum(datum) {
  // datum: YYYY-MM-DD
  const d = new Date(datum + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function ConfirmModal({ visible, onClose, onConfirm, saving, initialDatum = '', initialUhrzeitVon = '', initialUhrzeitBis = '', c }) {
  const [datum, setDatum] = useState(initialDatum);
  const [uhrzeitVon, setUhrzeitVon] = useState(initialUhrzeitVon);
  const [uhrzeitBis, setUhrzeitBis] = useState(initialUhrzeitBis);

  const handleConfirm = () => {
    const d = new Date(datum);
    if (isNaN(d.getTime())) { Alert.alert('Ungültiges Datum', 'Format: 2026-08-15'); return; }
    const parseTime = (t) => {
      const [h, m] = t.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    };
    const von = parseTime(uhrzeitVon);
    const bis = parseTime(uhrzeitBis);
    if (von === null || bis === null) { Alert.alert('Ungültige Uhrzeit', 'Format: 09:00'); return; }
    if (bis <= von) { Alert.alert('Ungültig', 'Endzeit muss nach Startzeit liegen'); return; }
    onConfirm({ datum: d.toISOString(), uhrzeitVon: von, uhrzeitBis: bis });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, padding: 20, gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>Termin bestätigen</Text>

          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 13, color: c.muted }}>Datum (z.B. 2026-08-15)</Text>
            <TextInput
              value={datum} onChangeText={setDatum} placeholder="2026-08-15"
              placeholderTextColor={c.muted}
              style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 13, color: c.muted }}>Von (z.B. 09:00)</Text>
              <TextInput
                value={uhrzeitVon} onChangeText={setUhrzeitVon} placeholder="09:00"
                placeholderTextColor={c.muted}
                style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 13, color: c.muted }}>Bis (z.B. 09:20)</Text>
              <TextInput
                value={uhrzeitBis} onChangeText={setUhrzeitBis} placeholder="09:20"
                placeholderTextColor={c.muted}
                style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10 }}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable onPress={onClose} style={{ flex: 1, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted }}>Abbrechen</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} disabled={saving} style={{ flex: 1, borderRadius: RADIUS.sm, backgroundColor: saving ? c.border : c.primary, paddingVertical: 12, alignItems: 'center' }}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Bestätigen</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CancelModal({ visible, onClose, onCancel, saving, c }) {
  const [reason, setReason] = useState('PRAXIS_ABSAGE');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, padding: 20, gap: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>Termin absagen</Text>
          <View style={{ gap: 8 }}>
            {CANCEL_REASONS.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: reason === r.key ? (c.error ?? '#EF4444') : c.border, backgroundColor: reason === r.key ? '#FEE2E2' : c.card }}
              >
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: reason === r.key ? (c.error ?? '#EF4444') : c.border, backgroundColor: reason === r.key ? (c.error ?? '#EF4444') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {reason === r.key && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                </View>
                <Text style={{ fontSize: 14, color: c.text }}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onClose} style={{ flex: 1, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.muted }}>Abbrechen</Text>
            </Pressable>
            <Pressable onPress={() => onCancel(reason)} disabled={saving} style={{ flex: 1, borderRadius: RADIUS.sm, backgroundColor: saving ? c.border : (c.error ?? '#EF4444'), paddingVertical: 12, alignItems: 'center' }}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Absagen</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Slot-Liste für Serien-Inquiries (Therapeuten-Ansicht)
function SerieSlotList({ inquiry, authToken, onUpdate, saving, setSaving, c }) {
  const slots = inquiry.inquirySlots ?? [];
  const pendingCount = slots.filter((s) => s.status === 'PENDING').length;
  const canAct = ['SENT', 'SEEN', 'COUNTER_PROPOSED', 'CONFIRMED'].includes(inquiry.status);

  async function doSlotAction(slotId, action) {
    setSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/inquiry/${inquiry.id}/slots/${slotId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate?.(updated);
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Fehler', data.error ?? 'Aktion fehlgeschlagen');
      }
    } catch {
      Alert.alert('Verbindungsfehler');
    } finally {
      setSaving(false);
    }
  }

  async function doConfirmAll() {
    setSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/inquiry/${inquiry.id}/confirm-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate?.(updated);
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Fehler', data.error ?? 'Bestätigung fehlgeschlagen');
      }
    } catch {
      Alert.alert('Verbindungsfehler');
    } finally {
      setSaving(false);
    }
  }

  if (slots.length === 0) {
    return (
      <View style={{ padding: 12, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm }}>
        <Text style={{ fontSize: 13, color: c.muted }}>Keine Wunschtermine vorhanden.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {canAct && pendingCount > 0 && (
        <Pressable
          onPress={() => {
            Alert.alert(
              'Alle bestätigen',
              `Alle ${pendingCount} offenen Termine bestätigen?`,
              [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Alle bestätigen', onPress: doConfirmAll },
              ],
            );
          }}
          disabled={saving}
          style={{
            backgroundColor: c.primary, borderRadius: RADIUS.sm,
            paddingVertical: 11, alignItems: 'center',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
            Alle {pendingCount} Termine bestätigen
          </Text>
        </Pressable>
      )}

      {slots.map((slot) => {
        const cfg = SLOT_STATUS_CONFIG[slot.status] ?? SLOT_STATUS_CONFIG.PENDING;
        return (
          <View
            key={slot.id}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              padding: 10, borderRadius: RADIUS.sm, borderWidth: 1,
              borderColor: c.border, backgroundColor: c.card,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>
                {formatDatum(slot.datum)}
              </Text>
              <Text style={{ fontSize: 12, color: c.muted }}>
                {formatMinutes(slot.uhrzeitVon)} – {formatMinutes(slot.uhrzeitBis)} Uhr
              </Text>
            </View>
            <View style={{ backgroundColor: cfg.bg, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
            </View>
            {canAct && slot.status === 'PENDING' && !saving && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  onPress={() => doSlotAction(slot.id, 'confirm')}
                  style={{ backgroundColor: c.primary, borderRadius: RADIUS.sm, paddingVertical: 6, paddingHorizontal: 10 }}
                >
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => doSlotAction(slot.id, 'decline')}
                  style={{ borderWidth: 1, borderColor: c.error ?? '#EF4444', borderRadius: RADIUS.sm, paddingVertical: 6, paddingHorizontal: 10 }}
                >
                  <Ionicons name="close" size={14} color={c.error ?? '#EF4444'} />
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function InquiryCard({ inquiry, authToken, c, onUpdate }) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isSerie = (inquiry.suchtyp ?? inquiry.patientRequest?.suchtyp) === 'SERIE';
  const statusCfg = STATUS_CONFIG[inquiry.status] ?? STATUS_CONFIG.SENT;
  const timeWindows = inquiry.patientRequest?.timeWindows ?? [];
  const isActive = ['SENT', 'SEEN', 'COUNTER_PROPOSED', 'CONFIRMED'].includes(inquiry.status);

  async function doAction(path, body = {}) {
    setActionLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/inquiry/${inquiry.id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate?.(updated);
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert('Fehler', data.error ?? 'Aktion fehlgeschlagen');
      }
    } catch {
      Alert.alert('Verbindungsfehler');
    } finally {
      setActionLoading(false);
    }
  }

  const handleSeen = () => {
    if (inquiry.status === 'SENT') doAction('seen');
  };

  const handleConfirm = ({ datum, uhrzeitVon, uhrzeitBis }) => {
    setShowConfirmModal(false);
    doAction('confirm', { datum, uhrzeitVon, uhrzeitBis });
  };

  const handleDecline = () => {
    Alert.alert('Anfrage ablehnen', 'Möchtest du diese Anfrage wirklich ablehnen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Ablehnen', style: 'destructive', onPress: () => doAction('decline') },
    ]);
  };

  const handleCancel = (reason) => {
    setShowCancelModal(false);
    doAction('cancel', { cancelReason: reason });
  };

  // Kopfzeilen-Vorschau für Serie: Anzahl Slots
  const slotCount = inquiry.inquirySlots?.length ?? 0;
  const pendingCount = (inquiry.inquirySlots ?? []).filter((s) => s.status === 'PENDING').length;

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden', ...SHADOW.card }}>
      {/* Header */}
      <Pressable onPress={() => { setExpanded((v) => !v); if (inquiry.status === 'SENT') handleSeen(); }} style={{ padding: SPACE.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Avatar */}
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${c.primary}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>
              {(inquiry.patientName ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{inquiry.patientName}</Text>
            <Text style={{ fontSize: 12, color: c.muted }}>
              {inquiry.heilmittel}
              {' · '}
              {isSerie
                ? `Serie · ${slotCount} Termine`
                : 'Einzeltermin'}
              {inquiry.kassenart ? ` · ${inquiry.kassenart}` : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: statusCfg.bg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: statusCfg.color }}>{statusCfg.label}</Text>
            </View>
            {isSerie && pendingCount > 0 && (
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 7 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>{pendingCount} offen</Text>
              </View>
            )}
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.muted} />
          </View>
        </View>

        {/* Einzeltermin: Wunschtermin-Vorschau */}
        {!isSerie && inquiry.wunschDatum && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Ionicons name="calendar-outline" size={13} color={c.primary} />
            <Text style={{ fontSize: 12, color: c.primary, fontWeight: '600' }}>
              {new Date(inquiry.wunschDatum).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}
              {inquiry.wunschUhrzeitVon != null ? ` · ${formatMinutes(inquiry.wunschUhrzeitVon)}–${formatMinutes(inquiry.wunschUhrzeitBis)} Uhr` : ''}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Expanded-Details */}
      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: c.border, padding: SPACE.md, gap: 10 }}>
          {inquiry.parallelAnfragenAnzahl > 0 && (
            <View style={{ backgroundColor: '#FEF3C7', borderRadius: RADIUS.sm, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Ionicons name="information-circle-outline" size={16} color="#92400E" />
              <Text style={{ fontSize: 12, color: '#92400E', flex: 1 }}>
                Patient hat {inquiry.parallelAnfragenAnzahl} weitere {inquiry.parallelAnfragenAnzahl === 1 ? 'Praxis' : 'Praxen'} gleichzeitig angefragt.
              </Text>
            </View>
          )}

          {inquiry.patientFreitext ? (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nachricht</Text>
              <Text style={{ fontSize: 14, color: c.text, lineHeight: 20 }}>{inquiry.patientFreitext}</Text>
            </View>
          ) : null}

          {/* SERIE: Slot-Liste */}
          {isSerie && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Wunschtermine</Text>
              <SerieSlotList
                inquiry={inquiry}
                authToken={authToken}
                onUpdate={onUpdate}
                saving={actionLoading}
                setSaving={setActionLoading}
                c={c}
              />
            </View>
          )}

          {/* EINZELTERMIN: bestätigter Termin */}
          {!isSerie && inquiry.status === 'CONFIRMED' && inquiry.confirmedDatum && (
            <View style={{ backgroundColor: '#D1FAE5', borderRadius: RADIUS.sm, padding: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#065F46' }}>
                Bestätigter Termin: {new Date(inquiry.confirmedDatum).toLocaleDateString('de-DE')}
                {inquiry.confirmedUhrzeitVon != null ? ` · ${formatMinutes(inquiry.confirmedUhrzeitVon)}–${formatMinutes(inquiry.confirmedUhrzeitBis)}` : ''}
              </Text>
            </View>
          )}

          {/* Aktionen */}
          {isActive && !actionLoading && (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {/* EINZELTERMIN: Bestätigen-Button */}
              {!isSerie && ['SENT', 'SEEN', 'COUNTER_PROPOSED'].includes(inquiry.status) && (
                <Pressable
                  onPress={() => setShowConfirmModal(true)}
                  style={{ flex: 1, minWidth: 100, backgroundColor: c.primary, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Bestätigen</Text>
                </Pressable>
              )}
              {/* Ablehnen (beide Typen) */}
              {['SENT', 'SEEN'].includes(inquiry.status) && (
                <Pressable
                  onPress={handleDecline}
                  style={{ flex: 1, minWidth: 100, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted }}>Ablehnen</Text>
                </Pressable>
              )}
              {/* Absagen (CONFIRMED) */}
              {inquiry.status === 'CONFIRMED' && (
                <Pressable
                  onPress={() => setShowCancelModal(true)}
                  style={{ flex: 1, borderWidth: 1, borderColor: c.error ?? '#EF4444', borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: c.error ?? '#EF4444' }}>Absagen</Text>
                </Pressable>
              )}
            </View>
          )}
          {actionLoading && <ActivityIndicator color={c.primary} style={{ marginVertical: 8 }} />}
        </View>
      )}

      {/* Modals */}
      <ConfirmModal
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        saving={actionLoading}
        initialDatum={inquiry.wunschDatum ? new Date(inquiry.wunschDatum).toISOString().slice(0, 10) : ''}
        initialUhrzeitVon={inquiry.wunschUhrzeitVon != null ? formatMinutes(inquiry.wunschUhrzeitVon) : ''}
        initialUhrzeitBis={inquiry.wunschUhrzeitBis != null ? formatMinutes(inquiry.wunschUhrzeitBis) : ''}
        c={c}
      />
      <CancelModal visible={showCancelModal} onClose={() => setShowCancelModal(false)} onCancel={handleCancel} saving={actionLoading} c={c} />
    </View>
  );
}
