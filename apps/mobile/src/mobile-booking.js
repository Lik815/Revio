import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TYPE } from './mobile-utils';

function formatSlot(startsAt, durationMin) {
  if (!startsAt) return '—';
  const d = new Date(startsAt);
  const date = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time} Uhr (${durationMin ?? 20} Min)`;
}

// ─── BookingRequestForm ────────────────────────────────────────────────────────

export function BookingRequestForm({ c, t, therapist, authToken, availableSlots, onSuccess, onClose }) {
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const slots = Array.isArray(availableSlots) ? availableSlots : [];

  async function handleSubmit() {
    if (!selectedSlotId) { setError('Bitte wähle einen Termin aus.'); return; }
    if (!consent) { setError('Bitte stimme der Datenschutzerklärung zu.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          therapistId: therapist.id,
          slotId: selectedSlotId,
          message: message.trim() || undefined,
          consentAccepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Buchung fehlgeschlagen. Bitte erneut versuchen.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <View style={{ flex: 1, padding: SPACE.lg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="checkmark-circle" size={64} color={c.success ?? '#1A7A40'} />
        <Text style={{ ...TYPE.h2, color: c.text, marginTop: SPACE.md, textAlign: 'center' }}>Anfrage gesendet</Text>
        <Text style={{ ...TYPE.body, color: c.muted, marginTop: SPACE.sm, textAlign: 'center' }}>
          Der Therapeut hat Zeit zum Antworten. Du siehst den Status unter Favoriten.
        </Text>
        <Pressable
          onPress={onSuccess}
          style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: 32, marginTop: SPACE.lg }}
        >
          <Text style={{ ...TYPE.label, color: '#fff' }}>Zu meinen Terminen</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.lg }}>
        <Pressable onPress={onClose} style={{ marginRight: 12 }}>
          <Ionicons name="close" size={24} color={c.muted} />
        </Pressable>
        <Text style={{ ...TYPE.h2, color: c.text, flex: 1 }}>Termin buchen</Text>
      </View>

      <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.md }}>
        {therapist.fullName} · {therapist.professionalTitle}
      </Text>

      {/* Slot list */}
      <Text style={{ ...TYPE.label, color: c.text, marginBottom: SPACE.sm }}>Freie Termine</Text>

      {slots.length === 0 ? (
        <View style={{ backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, padding: SPACE.md, marginBottom: SPACE.md }}>
          <Text style={{ ...TYPE.small, color: c.muted, textAlign: 'center' }}>
            Aktuell keine freien Termine verfügbar.
          </Text>
        </View>
      ) : (
        <View style={{ marginBottom: SPACE.md, gap: 8 }}>
          {slots.map((slot) => {
            const active = selectedSlotId === slot.id;
            return (
              <Pressable
                key={slot.id}
                onPress={() => setSelectedSlotId(slot.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  padding: SPACE.sm,
                  borderRadius: RADIUS.sm,
                  borderWidth: 1.5,
                  borderColor: active ? c.primary : c.border,
                  backgroundColor: active ? c.primaryBg : c.card,
                }}
              >
                <Ionicons name="calendar-outline" size={18} color={active ? c.primary : c.muted} style={{ marginRight: 10 }} />
                <Text style={{ ...TYPE.body, color: active ? c.primary : c.text, flex: 1, fontWeight: active ? '600' : '400' }}>
                  {formatSlot(slot.startsAt, slot.durationMin)}
                </Text>
                {active && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Message */}
      <Text style={{ ...TYPE.label, color: c.text, marginBottom: SPACE.xs }}>Nachricht (optional)</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Was möchtest du dem Therapeuten mitteilen?"
        placeholderTextColor={c.muted}
        multiline
        numberOfLines={3}
        style={{
          borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm,
          backgroundColor: c.mutedBg, color: c.text, fontSize: 15,
          padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: SPACE.md,
        }}
      />

      {/* Consent */}
      <Pressable
        onPress={() => setConsent(v => !v)}
        style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACE.md, gap: 10 }}
      >
        <View style={{
          width: 22, height: 22, borderRadius: 4,
          borderWidth: 1.5, borderColor: consent ? c.primary : c.border,
          backgroundColor: consent ? c.primary : 'transparent',
          alignItems: 'center', justifyContent: 'center', marginTop: 1,
        }}>
          {consent && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Text style={{ ...TYPE.small, color: c.muted, flex: 1, lineHeight: 20 }}>
          Ich stimme zu, dass meine Kontaktdaten zur Terminvermittlung verwendet werden.
        </Text>
      </Pressable>

      {/* Error */}
      {!!error && (
        <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.sm, padding: 12, marginBottom: SPACE.sm, flexDirection: 'row', gap: 8 }}>
          <Ionicons name="alert-circle-outline" size={16} color={c.error} />
          <Text style={{ ...TYPE.small, color: c.error, flex: 1 }}>{error}</Text>
        </View>
      )}

      {/* Submit */}
      {slots.length > 0 && (
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={{ backgroundColor: loading ? c.border : c.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center' }}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ ...TYPE.label, color: '#fff', fontSize: 16 }}>Jetzt buchen</Text>
          }
        </Pressable>
      )}
    </ScrollView>
  );
}

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  PENDING:   { bg: '#FFF9E6', text: '#B78700', label: 'Ausstehend' },
  CONFIRMED: { bg: '#E6F9EE', text: '#1A7A40', label: 'Bestätigt' },
  DECLINED:  { bg: '#FEF2F2', text: '#B91C1C', label: 'Abgelehnt' },
  CANCELLED: { bg: '#F3F4F6', text: '#6B7280', label: 'Storniert' },
  EXPIRED:   { bg: '#F3F4F6', text: '#6B7280', label: 'Abgelaufen' },
};

// ─── PatientAppointmentCard ────────────────────────────────────────────────────

export function PatientAppointmentCard({ c, t, appointment, onCancel, onViewTherapist }) {
  const { status, therapist, slot, confirmedSlotAt } = appointment;
  const badge = STATUS_COLORS[status] ?? STATUS_COLORS.EXPIRED;

  // Prefer slot.startsAt, fall back to confirmedSlotAt for legacy bookings
  const slotDate = slot?.startsAt ?? confirmedSlotAt ?? null;
  const durationMin = slot?.durationMin ?? 20;

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.sm, ...SHADOW.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.primary }}>{(therapist?.fullName ?? '?')[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...TYPE.label, color: c.text, fontSize: 15 }}>{therapist?.fullName ?? '—'}</Text>
          <Text style={{ ...TYPE.caption, color: c.muted, marginTop: 2 }}>{therapist?.professionalTitle ?? ''}</Text>
        </View>
        <View style={{ backgroundColor: badge.bg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: badge.text }}>{badge.label}</Text>
        </View>
      </View>

      {slotDate && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SPACE.sm, gap: 6 }}>
          <Ionicons name="calendar-outline" size={14} color={status === 'CONFIRMED' ? c.primary : c.muted} />
          <Text style={{ ...TYPE.small, color: status === 'CONFIRMED' ? c.primary : c.muted, fontWeight: '600' }}>
            {formatSlot(slotDate, durationMin)}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: SPACE.sm }}>
        {status === 'PENDING' && (
          <Pressable
            onPress={() => Alert.alert('Termin stornieren', 'Möchtest du diese Anfrage wirklich stornieren?', [
              { text: 'Nein', style: 'cancel' },
              { text: 'Stornieren', style: 'destructive', onPress: onCancel },
            ])}
            style={{ flex: 1, borderWidth: 1, borderColor: c.error, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
          >
            <Text style={{ ...TYPE.label, color: c.error, fontSize: 14 }}>Stornieren</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onViewTherapist}
          style={{ flex: 1, backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
        >
          <Text style={{ ...TYPE.label, color: c.text, fontSize: 14 }}>Details</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── TherapistBookingCard ──────────────────────────────────────────────────────

export function TherapistBookingCard({ c, t, request, onRespond }) {
  const [loading, setLoading] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declinedReason, setDeclinedReason] = useState('');
  const [error, setError] = useState('');

  const isPending = request.status === 'PENDING';
  const slot = request.slot ?? null;
  // Legacy: fall back to confirmedSlotAt if no slot
  const slotDate = slot?.startsAt ?? request.confirmedSlotAt ?? null;

  async function handleRespond(action) {
    setError('');
    setLoading(true);
    try {
      const body = action === 'CONFIRM'
        ? { action: 'CONFIRM' }
        : { action: 'DECLINE', declinedReason: declinedReason.trim() || undefined };
      await onRespond(request.id, body);
    } catch {
      setError('Fehler beim Speichern.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.sm, ...SHADOW.card }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACE.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...TYPE.label, color: c.text, fontSize: 15 }}>{request.patientName}</Text>
          {request.patientEmail && (
            <Text style={{ ...TYPE.caption, color: c.muted, marginTop: 2 }}>{request.patientEmail}</Text>
          )}
        </View>
        {isPending && (
          <View style={{ backgroundColor: '#FFF9E6', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#B78700' }}>ANFRAGE</Text>
          </View>
        )}
        {!isPending && (
          <View style={{ backgroundColor: STATUS_COLORS[request.status]?.bg ?? '#F3F4F6', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: STATUS_COLORS[request.status]?.text ?? '#6B7280' }}>
              {STATUS_COLORS[request.status]?.label ?? request.status}
            </Text>
          </View>
        )}
      </View>

      {/* Slot */}
      {slotDate && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACE.xs }}>
          <Ionicons name="calendar-outline" size={14} color={c.primary} />
          <Text style={{ ...TYPE.small, color: c.primary, fontWeight: '600' }}>
            {formatSlot(slotDate, slot?.durationMin ?? 20)}
          </Text>
        </View>
      )}

      {/* Message */}
      {!!request.message && (
        <Text style={{ ...TYPE.small, color: c.text, fontStyle: 'italic', marginBottom: SPACE.xs }}>
          „{request.message}"
        </Text>
      )}

      {/* Decline reason input */}
      {isPending && showDecline && (
        <TextInput
          value={declinedReason}
          onChangeText={setDeclinedReason}
          placeholder="Grund (optional)"
          placeholderTextColor={c.muted}
          style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10, marginTop: SPACE.sm }}
        />
      )}

      {/* Error */}
      {!!error && <Text style={{ ...TYPE.small, color: c.error, marginTop: 6 }}>{error}</Text>}

      {/* Actions */}
      {isPending && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: SPACE.sm }}>
          {!showDecline ? (
            <Pressable
              onPress={() => setShowDecline(true)}
              style={{ flex: 1, borderWidth: 1, borderColor: c.error, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ ...TYPE.label, color: c.error, fontSize: 14 }}>Ablehnen</Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={loading}
              onPress={() => handleRespond('DECLINE')}
              style={{ flex: 1, borderWidth: 1, borderColor: c.error, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
            >
              {loading
                ? <ActivityIndicator size="small" color={c.error} />
                : <Text style={{ ...TYPE.label, color: c.error, fontSize: 14 }}>Ablehnung senden</Text>
              }
            </Pressable>
          )}

          {!showDecline && (
            <Pressable
              disabled={loading}
              onPress={() => handleRespond('CONFIRM')}
              style={{ flex: 1, backgroundColor: c.primary, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ ...TYPE.label, color: '#fff', fontSize: 14 }}>Bestätigen</Text>
              }
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
