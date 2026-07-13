import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, RADIUS, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { useConfigOptions } from '../../hooks/use-config-options';
import { useAppStore, appStoreSelectors } from '../../store/useStore';
import {
  deriveAvailableHeilmittel, formatSlot, getDateRange, getInsuranceOptions,
  groupSlotsByDate, persistKassenartFirstTime,
} from './booking/booking-form-utils';
import {
  ChipRow, ConsentCheckbox, ErrorBanner, FormHeader, PrimaryButton,
  ProgressBar, SlotDayGroup, SuccessScreen,
} from './booking/BookingFormShared';

// Buchungsformular im dynamischen Buchungssystem — 4-Schritte-Stepper.
export function BookingRequestForm({ c, t, therapist, authToken, onSuccess, onClose }) {
  const insets = useSafeAreaInsets();
  const { heilmittelOptions } = useConfigOptions();
  const loggedInPatient = useAppStore(appStoreSelectors.loggedInPatient);
  const updatePatientProfile = useAppStore((s) => s.updatePatientProfile);

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

  const availableHeilmittel = deriveAvailableHeilmittel(therapist, heilmittelOptions);
  const insuranceOptions = getInsuranceOptions();

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
    if (step === 1) {
      persistKassenartFirstTime({ authToken, knownKassenart, selectedKassenart, updatePatientProfile });
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
          setError((data.error ?? 'Buchung fehlgeschlagen.') + (data._debug ? `\n[${data._debug}]` : ''));
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
      <SuccessScreen
        title="Anfrage gesendet"
        therapistName={therapist?.fullName}
        highlight={bookedStartsAt ? formatSlot(bookedStartsAt, bookedEndsAt) : null}
        body="Der Therapeut wird deine Anfrage bestätigen. Du siehst den Status unter deinen Terminen."
        buttonLabel="Zu meinen Terminen"
        onDone={onSuccess}
        c={c}
      />
    );
  }

  const stepTitles = { 1: 'Versicherung', 2: 'Terminart', 3: 'Termin', 4: 'Nachricht' };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FormHeader
        title="Termin buchen"
        stepLabel={stepTitles[step]}
        step={step}
        minStep={firstStep}
        onBack={handleBack}
        c={c}
      />

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
                {groupSlotsByDate(slots).map((group) => (
                  <SlotDayGroup
                    key={group.dateKey}
                    group={group}
                    isOpen={expandedDate === group.dateKey}
                    onToggleOpen={() => setExpandedDate(expandedDate === group.dateKey ? null : group.dateKey)}
                    showAll={showAllFor.has(group.dateKey)}
                    onShowAll={() => setShowAllFor((prev) => new Set([...prev, group.dateKey]))}
                    isSlotActive={(slot) => selectedStartsAt === slot.startsAt}
                    onPressSlot={(slot) => { setSelectedStartsAt(slot.startsAt); setSelectedEndsAt(slot.endsAt); setStep(4); }}
                    c={c}
                  />
                ))}
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

            <ConsentCheckbox consent={consent} onToggle={() => setConsent((v) => !v)} c={c} />
          </View>
        )}

        <ErrorBanner error={error} c={c} />

        {/* Action */}
        <View style={{ marginTop: SPACE.sm }}>
          {step < 4 && step !== 3 ? (
            <PrimaryButton label="Weiter" onPress={handleNext} c={c} />
          ) : step === 4 ? (
            <PrimaryButton
              label="Anfrage senden"
              onPress={handleSubmit}
              disabled={!consent}
              loading={loading}
              c={c}
            />
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
