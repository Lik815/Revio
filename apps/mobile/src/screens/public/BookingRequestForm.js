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
import { useAppStore, appStoreSelectors } from '../../store/useStore';

const TOTAL_STEPS = 4;

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

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getDateRange() {
  const from = new Date();
  const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function groupSlotsByDate(slots) {
  const map = new Map();
  for (const slot of slots) {
    const key = slot.startsAt.slice(0, 10);
    if (!map.has(key)) {
      const d = new Date(slot.startsAt);
      const label = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      map.set(key, { dateKey: key, label, slots: [] });
    }
    map.get(key).slots.push(slot);
  }
  return Array.from(map.values());
}

function ProgressBar({ step, c }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginBottom: SPACE.lg }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1, height: 3, borderRadius: 2,
            backgroundColor: i < step ? c.primary : c.border,
          }}
        />
      ))}
    </View>
  );
}

function ChipRow({ options, selected, onSelect, c }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = selected === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
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
  );
}

// Buchungsformular im dynamischen Buchungssystem — 4-Schritte-Stepper.
export function BookingRequestForm({ c, t, therapist, authToken, onSuccess, onClose }) {
  const insets = useSafeAreaInsets();
  const { heilmittelOptions } = useConfigOptions();
  const loggedInPatient = useAppStore(appStoreSelectors.loggedInPatient);

  // Schritt 1 überspringen wenn Kassenart bereits im Profil bekannt
  const knownKassenart = loggedInPatient?.kassenart ?? null;
  const firstStep = knownKassenart ? 2 : 1;

  const [step, setStep] = useState(firstStep);
  const [selectedKassenart, setSelectedKassenart] = useState(knownKassenart);
  const [selectedHeilmittel, setSelectedHeilmittel] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedStartsAt, setSelectedStartsAt] = useState(null);
  const [selectedEndsAt, setSelectedEndsAt] = useState(null);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [bookedStartsAt, setBookedStartsAt] = useState(null);
  const [bookedEndsAt, setBookedEndsAt] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);
  const [showAllFor, setShowAllFor] = useState(new Set());

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
        setShowAllFor(new Set());
        if (slotList.length > 0) {
          setSelectedStartsAt(slotList[0].startsAt);
          setSelectedEndsAt(slotList[0].endsAt);
          setExpandedDate(slotList[0].startsAt.slice(0, 10));
        }
      }
    } catch {}
    finally { setSlotsLoading(false); }
  }, [therapist?.id]);

  // Slots im Hintergrund laden sobald Heilmittel gewählt — bereit wenn Schritt 3 erscheint
  useEffect(() => {
    if (selectedHeilmittel) loadSlots(selectedHeilmittel);
  }, [selectedHeilmittel, loadSlots]);

  function handleBack() {
    setError('');
    if (step <= firstStep) { onClose(); return; }
    setStep((s) => s - 1);
  }

  function handleNext() {
    setError('');
    if (step === 1 && !selectedKassenart) {
      setError('Bitte wähle deine Versicherungsart aus.');
      return;
    }
    if (step === 2 && !selectedHeilmittel) {
      setError('Bitte wähle ein Heilmittel aus.');
      return;
    }
    if (step === 3 && !selectedStartsAt) {
      setError('Bitte wähle einen Termin aus.');
      return;
    }
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    if (!consent) { setError('Bitte stimme der Datenschutzerklärung zu.'); return; }
    setError('');
    setLoading(true);
    try {
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
          setError('Dieser Termin wurde soeben vergeben. Bitte wähle einen anderen.');
          loadSlots(selectedHeilmittel);
          setStep(3);
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

  const stepTitles = { 1: 'Versicherung', 2: 'Terminart', 3: 'Termin', 4: 'Nachricht' };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        padding: SPACE.lg, paddingBottom: SPACE.sm,
        backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border,
      }}>
        <Pressable onPress={handleBack} style={{ marginRight: 12, padding: 4 }} hitSlop={12}>
          <Ionicons name={step <= firstStep ? 'close' : 'arrow-back'} size={24} color={c.muted} />
        </Pressable>
        <Text style={{ ...TYPE.h2, color: c.text, flex: 1 }}>Termin buchen</Text>
        <Text style={{ fontSize: 13, color: c.muted }}>{stepTitles[step]}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.md }}>
          {therapist.fullName} · {therapist.professionalTitle}
        </Text>

        <ProgressBar step={step} c={c} />

        {/* Schritt 1: Versicherung */}
        {step === 1 && (
          <View>
            <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Wie bist du versichert?</Text>
            <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.md }}>
              Diese Information wird an den Therapeuten weitergegeben.
            </Text>
            <ChipRow
              options={insuranceOptions}
              selected={selectedKassenart}
              onSelect={setSelectedKassenart}
              c={c}
            />
          </View>
        )}

        {/* Schritt 2: Heilmittel */}
        {step === 2 && (
          <View>
            <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Terminart wählen</Text>
            <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.md }}>
              Welche Leistung benötigst du?
            </Text>
            {availableHeilmittel.length === 0 ? (
              <Text style={{ ...TYPE.small, color: c.muted }}>Keine Leistungen verfügbar.</Text>
            ) : (
              <ChipRow
                options={availableHeilmittel}
                selected={selectedHeilmittel}
                onSelect={setSelectedHeilmittel}
                c={c}
              />
            )}
          </View>
        )}

        {/* Schritt 3: Termin */}
        {step === 3 && (
          <View>
            <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Termin wählen</Text>
            <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.md }}>
              Nächste freie Termine der kommenden 14 Tage.
            </Text>
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
                {groupSlotsByDate(slots).map((group) => {
                  const isOpen = expandedDate === group.dateKey;
                  const showAll = showAllFor.has(group.dateKey);
                  const visibleSlots = showAll ? group.slots : group.slots.slice(0, 6);
                  const hasMore = group.slots.length > 6 && !showAll;
                  const groupHasSelected = group.slots.some((s) => s.startsAt === selectedStartsAt);

                  return (
                    <View
                      key={group.dateKey}
                      style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}
                    >
                      {/* Datumszeile */}
                      <Pressable
                        onPress={() => setExpandedDate(isOpen ? null : group.dateKey)}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          padding: 14,
                          backgroundColor: c.card,
                        }}
                      >
                        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: c.text }}>
                          {group.label}
                        </Text>
                        {groupHasSelected && !isOpen && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginRight: 8 }} />
                        )}
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
                      </Pressable>

                      {/* Uhrzeiten-Chips */}
                      {isOpen && (
                        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }}>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {visibleSlots.map((slot) => {
                              const active = selectedStartsAt === slot.startsAt;
                              return (
                                <Pressable
                                  key={slot.startsAt}
                                  onPress={() => { setSelectedStartsAt(slot.startsAt); setSelectedEndsAt(slot.endsAt); }}
                                  style={{
                                    paddingVertical: 10, paddingHorizontal: 14,
                                    borderRadius: RADIUS.sm, borderWidth: 1.5,
                                    borderColor: active ? c.primary : c.border,
                                    backgroundColor: active ? c.primaryBg : c.card,
                                    minWidth: 72, alignItems: 'center',
                                  }}
                                >
                                  <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? c.primary : c.text }}>
                                    {formatTime(slot.startsAt)}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          {hasMore && (
                            <Pressable
                              onPress={() => setShowAllFor((prev) => new Set([...prev, group.dateKey]))}
                              style={{ marginTop: 10, alignItems: 'center', paddingVertical: 8 }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary, letterSpacing: 0.4 }}>
                                MEHR
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Schritt 4: Nachricht + Einwilligung */}
        {step === 4 && (
          <View>
            <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Nachricht</Text>
            <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.md }}>
              Optional — teile dem Therapeuten etwas mit.
            </Text>

            {/* Zusammenfassung */}
            <View style={{ backgroundColor: c.mutedBg, borderRadius: RADIUS.sm, padding: SPACE.sm, marginBottom: SPACE.md, gap: 4 }}>
              {selectedKassenart && (
                <Text style={{ fontSize: 13, color: c.muted }}>
                  Versicherung: <Text style={{ color: c.text, fontWeight: '600' }}>
                    {insuranceOptions.find((o) => o.key === selectedKassenart)?.label ?? selectedKassenart}
                  </Text>
                </Text>
              )}
              {selectedHeilmittel && (
                <Text style={{ fontSize: 13, color: c.muted }}>
                  Terminart: <Text style={{ color: c.text, fontWeight: '600' }}>
                    {availableHeilmittel.find((o) => o.key === selectedHeilmittel)?.label ?? selectedHeilmittel}
                  </Text>
                </Text>
              )}
              {selectedStartsAt && (
                <Text style={{ fontSize: 13, color: c.muted }}>
                  Termin: <Text style={{ color: c.primary, fontWeight: '600' }}>{formatSlot(selectedStartsAt, selectedEndsAt)}</Text>
                </Text>
              )}
            </View>

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
          </View>
        )}

        {/* Fehler */}
        {!!error && (
          <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.sm, padding: 12, marginVertical: SPACE.sm, flexDirection: 'row', gap: 8 }}>
            <Ionicons name="alert-circle-outline" size={16} color={c.error} />
            <Text style={{ ...TYPE.small, color: c.error, flex: 1 }}>{error}</Text>
          </View>
        )}

        {/* Action */}
        <View style={{ marginTop: SPACE.sm }}>
          {step < 4 ? (
            <Pressable
              onPress={handleNext}
              style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center' }}
            >
              <Text style={{ ...TYPE.label, color: '#fff', fontSize: 16 }}>Weiter</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSubmit}
              disabled={loading || !consent}
              style={{
                backgroundColor: loading || !consent ? c.border : c.primary,
                borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center',
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ ...TYPE.label, color: '#fff', fontSize: 16 }}>Anfrage senden</Text>
              }
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
