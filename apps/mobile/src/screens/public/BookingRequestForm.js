import React, { useCallback, useEffect, useState } from 'react';
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

function formatSlot(startsAt, endsAt) {
  if (!startsAt) return '—';
  const start = new Date(startsAt);
  const date = start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  const startTime = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (endsAt) {
    const endTime = new Date(endsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${startTime}–${endTime} Uhr`;
  }
  return `${date} · ${startTime} Uhr`;
}

function getDateRange() {
  const from = new Date();
  const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

// Buchungsformular im dynamischen Buchungssystem:
// Patient wählt zuerst das Heilmittel; Zeitfenster werden dann live berechnet.
// Props availableSlots/slotsLoading/onReloadSlots werden nicht mehr genutzt
// (Slots werden intern per GET /therapists/:id/available-slots geladen).
export function BookingRequestForm({ c, t, therapist, authToken, onSuccess, onClose }) {
  const insets = useSafeAreaInsets();
  const { heilmittelOptions } = useConfigOptions();
  const { loggedInPatient, setLoggedInPatient } = useAuth();

  const [selectedHeilmittel, setSelectedHeilmittel] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedStartsAt, setSelectedStartsAt] = useState(null);
  const [selectedEndsAt, setSelectedEndsAt] = useState(null);
  const [selectedKassenart, setSelectedKassenart] = useState(null);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [phone, setPhone] = useState(loggedInPatient?.phone ?? '');
  const [phoneConfirm, setPhoneConfirm] = useState(loggedInPatient?.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [bookedStartsAt, setBookedStartsAt] = useState(null);
  const [bookedEndsAt, setBookedEndsAt] = useState(null);

  const storedPhone = (loggedInPatient?.phone ?? '').trim();
  const phoneConfirmNeeded = !storedPhone || phone.trim() !== storedPhone;

  const availableHeilmittel = (Array.isArray(therapist?.heilmittel) ? therapist.heilmittel : [])
    .map((item) => {
      const option = heilmittelOptions.find((opt) => opt.key === item || opt.label === item);
      return option ?? { key: item, label: item };
    })
    .filter((option, index, arr) =>
      option?.key && arr.findIndex((candidate) => candidate.key === option.key) === index,
    );

  const insuranceOptions = kassenartOptions.filter((opt) => opt.key != null);

  const loadSlots = useCallback(async (heilmittelKey) => {
    if (!therapist?.id || !heilmittelKey) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedStartsAt(null);
    setSelectedEndsAt(null);
    try {
      const { from, to } = getDateRange();
      const res = await fetch(
        `${getBaseUrl()}/therapists/${therapist.id}/available-slots?heilmittel=${encodeURIComponent(heilmittelKey)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: { ...TUNNEL_HEADERS } },
      );
      if (res.ok) {
        const data = await res.json();
        const slotList = Array.isArray(data.slots) ? data.slots : [];
        setSlots(slotList);
        if (slotList.length > 0) {
          setSelectedStartsAt(slotList[0].startsAt);
          setSelectedEndsAt(slotList[0].endsAt);
        }
      }
    } catch {}
    finally { setSlotsLoading(false); }
  }, [therapist?.id]);

  useEffect(() => {
    if (selectedHeilmittel) loadSlots(selectedHeilmittel);
  }, [selectedHeilmittel, loadSlots]);

  async function handleSubmit() {
    if (!selectedHeilmittel) { setError('Bitte wähle zuerst ein Heilmittel aus.'); return; }
    if (!selectedStartsAt) { setError('Bitte wähle einen Termin aus.'); return; }
    if (!selectedKassenart) { setError('Bitte gib an, wie du versichert bist.'); return; }
    if (!phone.trim()) { setError('Bitte gib deine Telefonnummer ein.'); return; }
    if (phoneConfirmNeeded && phone.trim() !== phoneConfirm.trim()) {
      setError('Die Telefonnummern stimmen nicht überein.');
      return;
    }
    if (!consent) { setError('Bitte stimme der Datenschutzerklärung zu.'); return; }
    setError('');
    setLoading(true);
    try {
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
          startsAt: selectedStartsAt,
          heilmittel: selectedHeilmittel,
          kassenart: selectedKassenart,
          message: message.trim() || undefined,
          consentAccepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // Zeitfenster wurde in der Zwischenzeit vergeben — neu laden
          setError('');
          loadSlots(selectedHeilmittel);
        } else {
          setError(data.error ?? 'Buchung fehlgeschlagen. Bitte erneut versuchen.');
        }
      } else {
        setBookedStartsAt(data.startsAt ?? selectedStartsAt);
        setBookedEndsAt(data.endsAt ?? selectedEndsAt);
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
      <View style={{ flex: 1, padding: SPACE.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <Ionicons name="checkmark-circle" size={64} color={c.success ?? '#1A7A40'} />
        <Text style={{ ...TYPE.h2, color: c.text, marginTop: SPACE.md, textAlign: 'center' }}>Anfrage gesendet</Text>
        {therapist?.fullName ? (
          <Text style={{ ...TYPE.body, color: c.text, marginTop: SPACE.sm, textAlign: 'center', fontWeight: '600' }}>
            {therapist.fullName}
          </Text>
        ) : null}
        {bookedStartsAt ? (
          <Text style={{ ...TYPE.body, color: c.primary, marginTop: 4, textAlign: 'center' }}>
            {formatSlot(bookedStartsAt, bookedEndsAt)}
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

        {/* Schritt 1: Heilmittel wählen */}
        {availableHeilmittel.length > 0 && (
          <View style={{ marginBottom: SPACE.md }}>
            <Text style={{ ...TYPE.label, color: c.text, marginBottom: SPACE.sm }}>Heilmittel wählen</Text>
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

        {/* Schritt 2: Zeitfenster wählen (nur wenn Heilmittel gewählt) */}
        {selectedHeilmittel && (
          <View style={{ marginBottom: SPACE.md }}>
            <Text style={{ ...TYPE.label, color: c.text, marginBottom: SPACE.sm }}>Termin wählen</Text>
            {slotsLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: SPACE.lg }}>
                <ActivityIndicator color={c.primary} />
                <Text style={{ ...TYPE.caption, color: c.muted, marginTop: 8 }}>Freie Termine werden berechnet…</Text>
              </View>
            ) : slots.length === 0 ? (
              <View style={{ backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, padding: SPACE.md }}>
                <Text style={{ ...TYPE.small, color: c.muted, textAlign: 'center' }}>
                  Aktuell keine freien Termine verfügbar.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {slots.map((slot) => {
                  const active = selectedStartsAt === slot.startsAt;
                  return (
                    <Pressable
                      key={slot.startsAt}
                      onPress={() => { setSelectedStartsAt(slot.startsAt); setSelectedEndsAt(slot.endsAt); }}
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
                        {formatSlot(slot.startsAt, slot.endsAt)}
                      </Text>
                      {active && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Schritt 3: Kassenart */}
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
              padding: 12, marginBottom: phoneConfirmNeeded ? SPACE.sm : 0,
            }}
          />
          {phoneConfirmNeeded ? (
            <>
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
            </>
          ) : null}
        </View>

        {/* Nachricht */}
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

        {/* Einwilligung */}
        <Pressable
          onPress={() => setConsent((v) => !v)}
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

        {/* Fehler */}
        {!!error && (
          <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.sm, padding: 12, marginBottom: SPACE.sm, flexDirection: 'row', gap: 8 }}>
            <Ionicons name="alert-circle-outline" size={16} color={c.error} />
            <Text style={{ ...TYPE.small, color: c.error, flex: 1 }}>{error}</Text>
          </View>
        )}

        {/* Buchen */}
        {selectedStartsAt && (
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
