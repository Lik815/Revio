import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, RADIUS, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { useConfigOptions } from '../../hooks/use-config-options';
import { useAppStore, appStoreSelectors } from '../../store/useStore';
import {
  dateGroupLabel, deriveAvailableHeilmittel, formatTime, getInsuranceOptions,
  minutesFromIso, persistKassenartFirstTime,
} from './booking/booking-form-utils';
import {
  ChipRow, ConsentCheckbox, ErrorBanner, FormHeader, PrimaryButton,
  ProgressBar, SuccessScreen,
} from './booking/BookingFormShared';
import { SlotPicker } from './booking/SlotPicker';

const TOTAL_STEPS = 4;
const MAX_TERMINE = 10;

const BUCHUNGSTYP_OPTIONS = [
  { key: 'SERIE',        label: 'Behandlungsserie', subtitle: 'Rezept, mehrere Einheiten' },
  { key: 'EINZELTERMIN', label: 'Einzeltermin',      subtitle: 'Einmalig, Erstgespräch' },
];

export function InquiryRequestForm({ c, t, therapist, authToken, onSuccess, onClose }) {
  const insets = useSafeAreaInsets();
  const { heilmittelOptions } = useConfigOptions();
  const loggedInPatient = useAppStore(appStoreSelectors.loggedInPatient);
  const updatePatientProfile = useAppStore((s) => s.updatePatientProfile);

  const knownKassenart = loggedInPatient?.kassenart ?? null;

  const [step, setStep] = useState(1);
  // Einzeltermin (Erstgespräch, ohne Rezept) als Standard, da das für die meisten
  // neuen Patient:innen der naheliegendere Einstieg ist. Behandlungsserie bleibt
  // als bewusst wählbare zweite Option sichtbar.
  const [suchtyp, setSuchtyp] = useState('EINZELTERMIN');
  const [selectedKassenart, setSelectedKassenart] = useState(knownKassenart);
  const [selectedHeilmittel, setSelectedHeilmittel] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);    // Einzeltermin: ein Slot
  const [selectedTermine, setSelectedTermine] = useState([]); // Serie: bis zu 10 Slots
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [autoConfirmed, setAutoConfirmed] = useState(false);

  const availableHeilmittel = deriveAvailableHeilmittel(therapist, heilmittelOptions);
  const insuranceOptions = getInsuranceOptions();

  const toggleTermin = (slot) => {
    setSelectedTermine((prev) => {
      const exists = prev.some((s) => s.startsAt === slot.startsAt);
      if (exists) return prev.filter((s) => s.startsAt !== slot.startsAt);
      if (prev.length >= MAX_TERMINE) return prev;
      return [...prev, slot];
    });
  };

  function handleBack() {
    setError('');
    if (step <= 1) { onClose(); return; }
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
    if (step === 3 && suchtyp === 'EINZELTERMIN' && !selectedSlot) {
      setError('Bitte wähle einen Termin aus.');
      return;
    }
    if (step === 3 && suchtyp === 'SERIE' && selectedTermine.length === 0) {
      setError('Bitte wähle mindestens einen Wunschtermin aus.');
      return;
    }
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    if (!consent) { setError('Bitte stimme der Datenschutzerklärung zu.'); return; }
    setError('');
    setLoading(true);
    try {
      const isEinzel = suchtyp === 'EINZELTERMIN';
      const body = {
        heilmittel: selectedHeilmittel,
        kassenart: selectedKassenart,
        suchtyp,
        frequenz: 'X1',
        anzahlTermine: isEinzel ? 1 : selectedTermine.length,
        message: message.trim() || undefined,
        therapistIds: [therapist.id],
        wunschTermine: isEinzel ? [] : selectedTermine.map((slot) => ({
          datum: slot.startsAt.slice(0, 10),
          uhrzeitVon: minutesFromIso(slot.startsAt),
          uhrzeitBis: minutesFromIso(slot.endsAt),
        })),
        ...(isEinzel && selectedSlot ? {
          wunschDatum: selectedSlot.startsAt,
          wunschUhrzeitVon: minutesFromIso(selectedSlot.startsAt),
          wunschUhrzeitBis: minutesFromIso(selectedSlot.endsAt),
        } : {}),
      };
      const res = await fetch(`${getBaseUrl()}/inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fallback = res.status === 404
          ? 'Anfrage konnte nicht gesendet werden. Bitte prüfe, ob die App mit dem aktuellen API-Server verbunden ist.'
          : 'Anfrage fehlgeschlagen.';
        setError(data.error ?? fallback);
      } else {
        const confirmed = Array.isArray(data?.inquiries) && data.inquiries.some((i) => i.status === 'CONFIRMED');
        setAutoConfirmed(confirmed);
        setSuccess(true);
      }
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    const isEinzel = suchtyp === 'EINZELTERMIN';
    return (
      <SuccessScreen
        title={autoConfirmed ? 'Termin bestaetigt' : 'Anfrage gesendet'}
        therapistName={therapist?.fullName}
        body={autoConfirmed
          ? 'Dein Termin wurde automatisch bestaetigt.'
          : isEinzel
            ? 'Der Therapeut prueft deine Anfrage und bestaetigt den Termin.'
            : 'Der Therapeut prueft deine Wunschzeiten und bestaetigt einen konkreten Termin.'}
        buttonLabel="Zu meinen Anfragen"
        onDone={onSuccess}
        c={c}
      />
    );
  }

  const stepTitles = {
    1: 'Terminart',
    2: 'Heilmittel',
    3: suchtyp === 'EINZELTERMIN' ? 'Termin wählen' : 'Wunschzeiten',
    4: 'Nachricht',
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FormHeader
        title="Termin anfragen"
        stepLabel={stepTitles[step]}
        step={step}
        minStep={1}
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

        {/* Schritt 1: Terminart + Versicherung */}
        {step === 1 && (
          <View style={{ gap: 24 }}>
            <View>
              <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Was möchtest du anfragen?</Text>
              <View style={{ gap: 10, marginTop: SPACE.sm }}>
                {BUCHUNGSTYP_OPTIONS.map((opt) => {
                  const active = suchtyp === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setSuchtyp(opt.key)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 14,
                        padding: 14, borderRadius: RADIUS.md, borderWidth: 1.5,
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.primaryBg : c.card,
                      }}
                    >
                      <View style={{
                        width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.primary : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: active ? c.primary : c.text }}>{opt.label}</Text>
                        <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{opt.subtitle}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: SPACE.sm }}>Wie bist du versichert?</Text>
              <ChipRow options={insuranceOptions} selected={selectedKassenart} onSelect={setSelectedKassenart} c={c} />
            </View>
          </View>
        )}

        {/* Schritt 2: Heilmittel */}
        {step === 2 && (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Welches Heilmittel?</Text>
              {availableHeilmittel.length === 0
                ? <Text style={{ ...TYPE.small, color: c.muted }}>Keine Leistungen verfügbar.</Text>
                : <ChipRow options={availableHeilmittel} selected={selectedHeilmittel} onSelect={setSelectedHeilmittel} c={c} />}
            </View>
          </View>
        )}

        {/* Schritt 3: Slot-Picker (Einzeltermin) oder Multi-Slot-Picker (Serie) */}
        {step === 3 && suchtyp === 'EINZELTERMIN' && (
          <View>
            <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Wann möchtest du kommen?</Text>
            <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.md }}>
              Wähle einen freien Termin aus. Der Therapeut bestätigt oder schlägt eine Alternative vor.
            </Text>
            <SlotPicker
              therapistId={therapist.id}
              heilmittel={selectedHeilmittel}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              onPicked={() => setStep(4)}
              c={c}
            />
          </View>
        )}

        {step === 3 && suchtyp === 'SERIE' && (
          <View>
            <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Wunschtermine wählen</Text>
            <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.sm }}>
              Wähle bis zu {MAX_TERMINE} freie Termine aus, die dir passen.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.md }}>
              <Text style={{ fontSize: 13, color: selectedTermine.length > 0 ? c.primary : c.muted, fontWeight: '600' }}>
                {selectedTermine.length} von {MAX_TERMINE} ausgewählt
              </Text>
              {selectedTermine.length > 0 && (
                <Pressable onPress={() => setSelectedTermine([])}>
                  <Text style={{ fontSize: 12, color: c.muted }}>Auswahl zurücksetzen</Text>
                </Pressable>
              )}
            </View>
            <SlotPicker
              therapistId={therapist.id}
              heilmittel={selectedHeilmittel}
              selectedSlot={null}
              selectedTermine={selectedTermine}
              multiSelect
              maxSelect={MAX_TERMINE}
              onSelectSlot={toggleTermin}
              c={c}
            />
          </View>
        )}

        {/* Schritt 4: Nachricht + Consent */}
        {step === 4 && (
          <View>
            <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Kurze Nachricht</Text>
            <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.md }}>
              Optional — gibt dem Therapeuten relevante Informationen vorab.
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
                  Heilmittel: <Text style={{ color: c.text, fontWeight: '600' }}>
                    {availableHeilmittel.find((o) => o.key === selectedHeilmittel)?.label ?? selectedHeilmittel}
                  </Text>
                </Text>
              )}
              <Text style={{ fontSize: 13, color: c.muted }}>
                Art: <Text style={{ color: c.text, fontWeight: '600' }}>
                  {suchtyp === 'EINZELTERMIN' ? 'Einzeltermin' : `Behandlungsserie · ${selectedTermine.length} Termine`}
                </Text>
              </Text>
              {suchtyp === 'EINZELTERMIN' && selectedSlot && (
                <Text style={{ fontSize: 13, color: c.muted }}>
                  Termin: <Text style={{ color: c.text, fontWeight: '600' }}>
                    {dateGroupLabel(selectedSlot.startsAt)} · {formatTime(selectedSlot.startsAt)}–{formatTime(selectedSlot.endsAt)}
                  </Text>
                </Text>
              )}
              {suchtyp === 'SERIE' && selectedTermine.map((slot, i) => (
                <Text key={i} style={{ fontSize: 13, color: c.muted }}>
                  {i === 0 ? 'Termine: ' : ''}
                  <Text style={{ color: c.text, fontWeight: '600' }}>
                    {dateGroupLabel(slot.startsAt)} · {formatTime(slot.startsAt)}
                  </Text>
                </Text>
              ))}
            </View>

            <View style={{ marginBottom: SPACE.md }}>
              <TextInput
                value={message}
                onChangeText={(text) => setMessage(text.slice(0, 500))}
                placeholder="z.B. Diagnose, Vorerkrankungen, besondere Wünsche"
                placeholderTextColor={c.muted}
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1, borderColor: message.length >= 480 ? c.error ?? '#EF4444' : c.border,
                  borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 15,
                  padding: 12, minHeight: 80, textAlignVertical: 'top',
                }}
              />
              {message.length > 0 && (
                <Text style={{ fontSize: 11, color: message.length >= 480 ? c.error ?? '#EF4444' : c.muted, textAlign: 'right', marginTop: 4 }}>
                  {message.length}/500
                </Text>
              )}
            </View>

            <ConsentCheckbox consent={consent} onToggle={() => setConsent((v) => !v)} c={c} />
          </View>
        )}

        <ErrorBanner error={error} c={c} />

        {!(step === 3 && suchtyp === 'EINZELTERMIN') && (
          <View style={{ marginTop: SPACE.sm }}>
            {step < TOTAL_STEPS ? (
              <PrimaryButton label="Weiter" onPress={handleNext} c={c} />
            ) : (
              <PrimaryButton
                label="Anfrage senden"
                onPress={handleSubmit}
                disabled={!consent}
                loading={loading}
                c={c}
              />
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
