import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TYPE, resolveMediaUrl } from './mobile-utils';

function TherapistAvatar({ therapist, size = 40, c }) {
  const [imgError, setImgError] = useState(false);
  const photo = resolveMediaUrl(therapist?.photo);
  const fallback = `https://i.pravatar.cc/${size * 2}?u=${therapist?.id ?? 'default'}`;
  const uri = (!imgError && photo) ? photo : fallback;
  const initials = (therapist?.fullName ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primaryBg }}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: c.primary }}>{initials}</Text>
    </View>
  );
}

function formatSlot(startsAt, durationMin) {
  if (!startsAt) return '—';
  const d = new Date(startsAt);
  const date = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time} Uhr (${durationMin ?? 20} Min)`;
}

// ─── BookingRequestForm ────────────────────────────────────────────────────────

export function BookingRequestForm({ c, t, therapist, authToken, availableSlots, slotsLoading, onSuccess, onClose, onReloadSlots }) {
  const [selectedSlotId, setSelectedSlotId] = useState(therapist?.selectedSlotId ?? null);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [rejectedSlotId, setRejectedSlotId] = useState(null);
  const [rejectedSlotLabel, setRejectedSlotLabel] = useState('');

  const slots = (Array.isArray(availableSlots) ? availableSlots : []).filter(s => s?.id !== rejectedSlotId).reduce((acc, slot) => {
    const slotKey = `${slot?.startsAt ?? 'unknown'}-${slot?.durationMin ?? 20}`;
    const existingIndex = acc.findIndex((candidate) => `${candidate?.startsAt ?? 'unknown'}-${candidate?.durationMin ?? 20}` === slotKey);

    if (existingIndex === -1) {
      acc.push(slot);
      return acc;
    }

    if (slot?.id === therapist?.selectedSlotId) {
      acc[existingIndex] = slot;
    }

    return acc;
  }, []);

  useEffect(() => {
    if (slots.length === 0) {
      setSelectedSlotId(null);
      return;
    }

    if (therapist?.selectedSlotId && slots.some((slot) => slot.id === therapist.selectedSlotId)) {
      setSelectedSlotId((current) => (current === therapist.selectedSlotId ? current : therapist.selectedSlotId));
      return;
    }

    if (!selectedSlotId || !slots.some((slot) => slot.id === selectedSlotId)) {
      setSelectedSlotId(slots[0].id);
    }
  }, [selectedSlotId, slots, therapist?.selectedSlotId]);

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
        if (res.status === 409) {
          const rejected = slots.find((s) => s.id === selectedSlotId);
          setRejectedSlotLabel(rejected ? formatSlot(rejected.startsAt, rejected.durationMin) : '');
          setRejectedSlotId(selectedSlotId);
          setSelectedSlotId(null);
          setError('');
          if (onReloadSlots) onReloadSlots();
        } else {
          setError(data.error ?? 'Buchung fehlgeschlagen. Bitte erneut versuchen.');
        }
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
    const bookedSlot = slots.find((s) => s.id === selectedSlotId);
    return (
      <View style={{ flex: 1, padding: SPACE.lg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="checkmark-circle" size={64} color={c.success ?? '#1A7A40'} />
        <Text style={{ ...TYPE.h2, color: c.text, marginTop: SPACE.md, textAlign: 'center' }}>Anfrage gesendet</Text>
        {therapist?.fullName ? (
          <Text style={{ ...TYPE.body, color: c.text, marginTop: SPACE.sm, textAlign: 'center', fontWeight: '600' }}>
            {therapist.fullName}
          </Text>
        ) : null}
        {bookedSlot ? (
          <Text style={{ ...TYPE.body, color: c.primary, marginTop: 4, textAlign: 'center' }}>
            {formatSlot(bookedSlot.startsAt, bookedSlot.durationMin)}
          </Text>
        ) : null}
        <Text style={{ ...TYPE.body, color: c.muted, marginTop: SPACE.sm, textAlign: 'center' }}>
          Der Therapeut wird deine Anfrage bestätigen. Du siehst den Status unter deinen Terminen.
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
    <View style={{ flex: 1 }}>
      {/* Header — fixed outside ScrollView so close button is always reachable */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: SPACE.lg, paddingBottom: SPACE.sm, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable onPress={onClose} style={{ marginRight: 12, padding: 4 }} hitSlop={12}>
          <Ionicons name="close" size={24} color={c.muted} />
        </Pressable>
        <Text style={{ ...TYPE.h2, color: c.text, flex: 1 }}>Termin buchen</Text>
      </View>
    <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

      <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.md }}>
        {therapist.fullName} · {therapist.professionalTitle}
      </Text>

      {/* Slot — pre-selected (from bottom sheet) or full picker */}
      <Text style={{ ...TYPE.label, color: c.text, marginBottom: SPACE.sm }}>Gewählter Termin</Text>

      {slotsLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: SPACE.lg }}>
          <ActivityIndicator color={c.primary} />
          <Text style={{ ...TYPE.caption, color: c.muted, marginTop: 8 }}>Termine werden geladen…</Text>
        </View>
      ) : therapist?.selectedSlotId ? (
        (() => {
          const preSelected = slots.find((s) => s.id === therapist.selectedSlotId);
          const wasRejected = rejectedSlotId === therapist.selectedSlotId;
          if (wasRejected) {
            return (
              <View style={{ borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.error ?? '#ef4444', backgroundColor: c.errorBg ?? '#fef2f2', padding: SPACE.md, marginBottom: SPACE.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="close-circle-outline" size={18} color={c.error ?? '#ef4444'} />
                  <Text style={{ fontSize: 14, color: c.error ?? '#ef4444', fontWeight: '600', flex: 1 }}>
                    {rejectedSlotLabel ? `${rejectedSlotLabel} – nicht mehr verfügbar` : 'Dieser Termin ist nicht mehr verfügbar.'}
                  </Text>
                </View>
                <Pressable onPress={onClose}>
                  <Text style={{ fontSize: 14, color: c.primary, fontWeight: '600' }}>← Anderen Termin wählen</Text>
                </Pressable>
              </View>
            );
          }
          if (!preSelected) return null;
          return (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                padding: SPACE.sm,
                borderRadius: RADIUS.sm,
                borderWidth: 1.5,
                borderColor: c.primary,
                backgroundColor: c.primaryBg,
                marginBottom: SPACE.md,
              }}
            >
              <Ionicons name="calendar-outline" size={18} color={c.primary} style={{ marginRight: 10 }} />
              <Text style={{ ...TYPE.body, color: c.primary, flex: 1, fontWeight: '600' }}>
                {formatSlot(preSelected.startsAt, preSelected.durationMin)}
              </Text>
              <Ionicons name="checkmark-circle" size={18} color={c.primary} />
            </View>
          );
        })()
      ) : slots.length === 0 ? (
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
      {(therapist?.selectedSlotId || slots.length > 0) && (
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
    </View>
  );
}

// ─── Status helpers ────────────────────────────────────────────────────────────

export const STATUS_COLORS = {
  PENDING:   { bg: '#FFF9E6', text: '#B78700', label: 'Ausstehend' },
  CONFIRMED: { bg: '#E6F9EE', text: '#1A7A40', label: 'Bestätigt' },
  DECLINED:  { bg: '#FEF2F2', text: '#B91C1C', label: 'Abgelehnt' },
  CANCELLED: { bg: '#F3F4F6', text: '#6B7280', label: 'Storniert' },
  EXPIRED:   { bg: '#F3F4F6', text: '#6B7280', label: 'Abgelaufen' },
};

// ─── NextAppointmentHero ──────────────────────────────────────────────────────

export function NextAppointmentHero({ c, appointment, onOpenDetail, onViewTherapist }) {
  const { status, therapist, slot, confirmedSlotAt } = appointment;
  const badge = STATUS_COLORS[status] ?? STATUS_COLORS.EXPIRED;
  const slotDate = slot?.startsAt ?? confirmedSlotAt ?? null;
  const durationMin = slot?.durationMin ?? 20;
  const photo = resolveMediaUrl(therapist?.photo);
  const initials = (therapist?.fullName ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (!slotDate) return null;

  const d = new Date(slotDate);
  const dayNum = d.toLocaleDateString('de-DE', { day: 'numeric' });
  const monthStr = d.toLocaleDateString('de-DE', { month: 'long' });
  const weekday = d.toLocaleDateString('de-DE', { weekday: 'long' });
  const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACE.md, ...SHADOW.card, borderWidth: 1, borderColor: c.border }}>
      {/* Farbiger Akzentstreifen */}
      <View style={{ height: 4, backgroundColor: c.primary }} />

      <View style={{ padding: SPACE.lg }}>
        {/* Header: Status + Foto */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: badge.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: badge.text }}>{badge.label}</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: c.text, lineHeight: 32 }}>{dayNum}. {monthStr}</Text>
            <Text style={{ fontSize: 14, color: c.muted, marginTop: 3 }}>{weekday} · {timeStr} Uhr · {durationMin} Min</Text>
          </View>
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: 60, height: 60, borderRadius: 30, marginLeft: 12 }} />
          ) : (
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: c.primary }}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Therapeut:in */}
        <View style={{ height: 1, backgroundColor: c.border, marginBottom: 12 }} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>{therapist?.fullName ?? '—'}</Text>
        {therapist?.professionalTitle ? (
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{therapist.professionalTitle}</Text>
        ) : null}

        {/* CTAs */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable
            onPress={onOpenDetail}
            style={{ flex: 1, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Termin öffnen</Text>
          </Pressable>
          <Pressable
            onPress={onViewTherapist}
            style={{ paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>Profil</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── PatientAppointmentCard ────────────────────────────────────────────────────

export function PatientAppointmentCard({ c, appointment, onOpenDetail, onViewTherapist }) {
  const { status, therapist, slot, confirmedSlotAt } = appointment;
  const badge = STATUS_COLORS[status] ?? STATUS_COLORS.EXPIRED;
  const slotDate = slot?.startsAt ?? confirmedSlotAt ?? null;
  const durationMin = slot?.durationMin ?? 20;
  const isActive = status === 'CONFIRMED' || status === 'PENDING';
  const isInactive = !isActive;

  return (
    <Pressable
      onPress={onOpenDetail}
      style={{ backgroundColor: c.card, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: isInactive ? 0.65 : 1, ...SHADOW.card }}
    >
      {/* Datum-Block */}
      {slotDate ? (
        <View style={{ width: 44, alignItems: 'center', gap: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: isInactive ? c.muted : c.text, lineHeight: 20 }}>
            {new Date(slotDate).toLocaleDateString('de-DE', { day: 'numeric' })}
          </Text>
          <Text style={{ fontSize: 10, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {new Date(slotDate).toLocaleDateString('de-DE', { month: 'short' })}
          </Text>
        </View>
      ) : (
        <View style={{ width: 44 }} />
      )}

      {/* Vertikale Linie */}
      <View style={{ width: 1, height: 36, backgroundColor: c.border }} />

      {/* Info */}
      <View style={{ flex: 1 }}>
        {slotDate && (
          <Text style={{ fontSize: 14, fontWeight: '600', color: isInactive ? c.muted : c.text }}>
            {new Date(slotDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · {durationMin} Min
          </Text>
        )}
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{therapist?.fullName ?? '—'}</Text>
      </View>

      {/* Status + Chevron */}
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={{ backgroundColor: badge.bg, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: badge.text }}>{badge.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={c.muted} />
      </View>
    </Pressable>
  );
}

// ─── TherapistBookingCard ──────────────────────────────────────────────────────

export function TherapistBookingCard({ c, t, request, onRespond, onCancel }) {
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
    } catch (e) {
      setError(e?.message && e.message !== 'failed' ? e.message : 'Fehler beim Speichern.');
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
          {request.patientPhone && (
            <Text style={{ ...TYPE.caption, color: c.muted, marginTop: 1 }}>{request.patientPhone}</Text>
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

      {/* Therapeut storniert bestätigten Termin */}
      {request.status === 'CONFIRMED' && onCancel && (
        <Pressable
          onPress={() => Alert.alert(
            'Termin absagen',
            'Möchtest du diesen bestätigten Termin wirklich absagen? Der Patient wird benachrichtigt.',
            [
              { text: 'Nein', style: 'cancel' },
              { text: 'Absagen', style: 'destructive', onPress: onCancel },
            ],
          )}
          style={{ marginTop: SPACE.sm, paddingVertical: 8, alignItems: 'center' }}
        >
          <Text style={{ ...TYPE.label, color: c.error, fontSize: 13 }}>Termin absagen</Text>
        </Pressable>
      )}

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
