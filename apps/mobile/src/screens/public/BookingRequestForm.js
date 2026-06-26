import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, kassenartOptions, RADIUS, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { useConfigOptions } from '../../hooks/use-config-options';
import { useAuth } from '../../context/AuthContext';

function formatSlot(startsAt, durationMin) {
  if (!startsAt) return '—';
  const d = new Date(startsAt);
  const date = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time} Uhr (${durationMin ?? 20} Min)`;
}

export function BookingRequestForm({ c, t, therapist, authToken, availableSlots, slotsLoading, onSuccess, onClose, onReloadSlots }) {
  const insets = useSafeAreaInsets();
  const { heilmittelOptions } = useConfigOptions();
  const { loggedInPatient, setLoggedInPatient } = useAuth();
  const [selectedSlotId, setSelectedSlotId] = useState(therapist?.selectedSlotId ?? null);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [phone, setPhone] = useState(loggedInPatient?.phone ?? '');
  const [phoneConfirm, setPhoneConfirm] = useState(loggedInPatient?.phone ?? '');
  const [selectedHeilmittel, setSelectedHeilmittel] = useState(null);
  const [selectedKassenart, setSelectedKassenart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [rejectedSlotId, setRejectedSlotId] = useState(null);
  const [rejectedSlotLabel, setRejectedSlotLabel] = useState('');

  const availableHeilmittel = heilmittelOptions.filter(
    (opt) => Array.isArray(therapist?.heilmittel) && therapist.heilmittel.includes(opt.key),
  );
  const insuranceOptions = kassenartOptions.filter((opt) => opt.key != null);

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
    if (availableHeilmittel.length > 0 && !selectedHeilmittel) { setError('Bitte wähle ein Heilmittel aus.'); return; }
    if (!selectedKassenart) { setError('Bitte gib an, wie du versichert bist.'); return; }
    if (!phone.trim()) { setError('Bitte gib deine Telefonnummer ein.'); return; }
    if (phone.trim() !== phoneConfirm.trim()) { setError('Die Telefonnummern stimmen nicht überein.'); return; }
    if (!consent) { setError('Bitte stimme der Datenschutzerklärung zu.'); return; }
    setError('');
    setLoading(true);
    try {
      // The booking endpoint reads patientPhone straight from the stored
      // profile, not from the request body — so a new/changed number has to
      // land on the profile first, or the booking would silently carry the
      // old (or no) number.
      if (phone.trim() !== (loggedInPatient?.phone ?? '')) {
        const phoneRes = await fetch(`${getBaseUrl()}/auth/me`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ phone: phone.trim() }),
        });
        const phoneData = await phoneRes.json().catch(() => ({}));
        if (!phoneRes.ok) {
          setError(phoneData.message ?? 'Telefonnummer konnte nicht gespeichert werden.');
          setLoading(false);
          return;
        }
        setLoggedInPatient((prev) => ({ ...prev, phone: phoneData.phone ?? phone.trim() }));
      }

      const res = await fetch(`${getBaseUrl()}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          therapistId: therapist.id,
          slotId: selectedSlotId,
          message: message.trim() || undefined,
          consentAccepted: true,
          heilmittel: selectedHeilmittel ?? undefined,
          kassenart: selectedKassenart ?? undefined,
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
      <View style={{ flex: 1, padding: SPACE.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header — fixed outside ScrollView so close button is always reachable */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: SPACE.lg, paddingBottom: SPACE.sm, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable onPress={onClose} style={{ marginRight: 12, padding: 4 }} hitSlop={12}>
          <Ionicons name="close" size={24} color={c.muted} />
        </Pressable>
        <Text style={{ ...TYPE.h2, color: c.text, flex: 1 }}>Termin buchen</Text>
      </View>
    <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">

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

      {/* Heilmittel */}
      {availableHeilmittel.length > 0 && (
        <View style={{ marginBottom: SPACE.md }}>
          <Text style={{ ...TYPE.label, color: c.text, marginBottom: SPACE.sm }}>Heilmittel</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {availableHeilmittel.map((opt) => {
              const active = selectedHeilmittel === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setSelectedHeilmittel(opt.key)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingVertical: 8, paddingHorizontal: 14,
                    borderRadius: RADIUS.lg, borderWidth: 1.5,
                    borderColor: active ? c.primary : c.border,
                    backgroundColor: active ? c.primaryBg : c.mutedBg,
                  }}
                >
                  {active && <Ionicons name="checkmark" size={14} color={c.primary} />}
                  <Text style={{ fontSize: 13, color: active ? c.primary : c.muted, fontWeight: active ? '600' : '400' }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Kassenart */}
      <View style={{ marginBottom: SPACE.md }}>
        <Text style={{ ...TYPE.label, color: c.text, marginBottom: SPACE.sm }}>Wie bist du versichert?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {insuranceOptions.map((opt) => {
            const active = selectedKassenart === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setSelectedKassenart(opt.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingVertical: 8, paddingHorizontal: 14,
                  borderRadius: RADIUS.lg, borderWidth: 1.5,
                  borderColor: active ? c.primary : c.border,
                  backgroundColor: active ? c.primaryBg : c.mutedBg,
                }}
              >
                {active && <Ionicons name="checkmark" size={14} color={c.primary} />}
                <Text style={{ fontSize: 13, color: active ? c.primary : c.muted, fontWeight: active ? '600' : '400' }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Telefonnummer */}
      <View style={{ marginBottom: SPACE.md }}>
        <Text style={{ ...TYPE.label, color: c.text, marginBottom: SPACE.xs }}>Telefonnummer</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder={t('phonePlaceholder') ?? '+49 …'}
          placeholderTextColor={c.muted}
          keyboardType="phone-pad"
          style={{
            borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm,
            backgroundColor: c.mutedBg, color: c.text, fontSize: 15,
            padding: 12, marginBottom: SPACE.sm,
          }}
        />
        <Text style={{ ...TYPE.label, color: c.text, marginBottom: SPACE.xs }}>Telefonnummer bestätigen</Text>
        <TextInput
          value={phoneConfirm}
          onChangeText={setPhoneConfirm}
          placeholder={t('phonePlaceholder') ?? '+49 …'}
          placeholderTextColor={c.muted}
          keyboardType="phone-pad"
          style={{
            borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm,
            backgroundColor: c.mutedBg, color: c.text, fontSize: 15,
            padding: 12,
          }}
        />
      </View>

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
    </KeyboardAvoidingView>
  );
}
