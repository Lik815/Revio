import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, kassenartOptions, RADIUS, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { useConfigOptions } from '../../hooks/use-config-options';
import { useAppStore, appStoreSelectors } from '../../store/useStore';

const TOTAL_STEPS = 4;

const BUCHUNGSTYP_OPTIONS = [
  { key: 'SERIE',        label: 'Behandlungsserie', subtitle: 'Rezept, mehrere Einheiten' },
  { key: 'EINZELTERMIN', label: 'Einzeltermin',      subtitle: 'Einmalig, Erstgespräch' },
];

const WOCHENTAGE = [
  { key: 1, label: 'Mo' },
  { key: 2, label: 'Di' },
  { key: 3, label: 'Mi' },
  { key: 4, label: 'Do' },
  { key: 5, label: 'Fr' },
];

const ZEITFENSTER = [
  { key: 'MORNING',   label: 'Morgens',    subtitle: '08–12 Uhr', vonMinute: 480,  bisMinute: 720  },
  { key: 'MIDDAY',    label: 'Mittags',    subtitle: '12–15 Uhr', vonMinute: 720,  bisMinute: 900  },
  { key: 'AFTERNOON', label: 'Nachmittag', subtitle: '15–18 Uhr', vonMinute: 900,  bisMinute: 1080 },
  { key: 'EVENING',   label: 'Abends',     subtitle: '18–20 Uhr', vonMinute: 1080, bisMinute: 1200 },
];

const FREQUENZ_OPTIONS = [
  { key: 'X1', label: '1× pro Woche' },
  { key: 'X2', label: '2× pro Woche' },
  { key: 'X3', label: '3× pro Woche' },
];

function ProgressBar({ step, c }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginBottom: SPACE.lg }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < step ? c.primary : c.border }} />
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

function TimeWindowPicker({ selectedDays, selectedSlots, onToggleDay, onToggleSlot, c }) {
  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted, marginBottom: 8 }}>Wochentage</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {WOCHENTAGE.map((d) => {
            const active = selectedDays.includes(d.key);
            return (
              <Pressable
                key={d.key}
                onPress={() => onToggleDay(d.key)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, borderWidth: 1.5,
                  borderColor: active ? c.primary : c.border,
                  backgroundColor: active ? c.primaryBg : c.card,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? c.primary : c.text }}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted, marginBottom: 8 }}>Tageszeiten</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ZEITFENSTER.map((z) => {
            const active = selectedSlots.includes(z.key);
            return (
              <Pressable
                key={z.key}
                onPress={() => onToggleSlot(z.key)}
                style={{
                  paddingVertical: 10, paddingHorizontal: 14,
                  borderRadius: RADIUS.sm, borderWidth: 1.5,
                  borderColor: active ? c.primary : c.border,
                  backgroundColor: active ? c.primaryBg : c.card,
                  minWidth: '45%',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? c.primary : c.text }}>
                  {z.label}
                </Text>
                <Text style={{ fontSize: 11, color: active ? c.primary : c.muted, marginTop: 2 }}>{z.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function dateGroupKey(isoString) {
  return isoString.slice(0, 10);
}

function dateGroupLabel(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function minutesFromIso(isoString) {
  const d = new Date(isoString);
  return d.getHours() * 60 + d.getMinutes();
}

function SlotPicker({ therapistId, heilmittel, selectedSlot, onSelectSlot, onPicked, c }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDate, setExpandedDate] = useState(null);
  const [showAllFor, setShowAllFor] = useState(() => new Set());

  useEffect(() => {
    setLoading(true);
    setError('');
    const now = new Date();
    const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    fetch(
      `${getBaseUrl()}/therapists/${therapistId}/available-slots?heilmittel=${encodeURIComponent(heilmittel)}&from=${now.toISOString()}&to=${to.toISOString()}`,
      { headers: { ...TUNNEL_HEADERS } },
    )
      .then((r) => r.json())
      .then((data) => {
        const slotList = Array.isArray(data.slots) ? data.slots : [];
        setSlots(slotList);
        setExpandedDate(slotList[0]?.startsAt ? dateGroupKey(slotList[0].startsAt) : null);
        setShowAllFor(new Set());
        setLoading(false);
      })
      .catch(() => { setError('Termine konnten nicht geladen werden.'); setLoading(false); });
  }, [therapistId, heilmittel]);

  const byDate = useMemo(() => {
    const map = new Map();
    for (const slot of slots) {
      const key = dateGroupKey(slot.startsAt);
      if (!map.has(key)) map.set(key, { dateKey: key, label: dateGroupLabel(slot.startsAt), slots: [] });
      map.get(key).slots.push(slot);
    }
    return Array.from(map.values());
  }, [slots]);

  if (loading) {
    return <ActivityIndicator color={c.primary} style={{ marginTop: 32 }} />;
  }

  if (error) {
    return (
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <Ionicons name="alert-circle-outline" size={28} color={c.error ?? '#EF4444'} style={{ marginBottom: 8 }} />
        <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (byDate.length === 0) {
    return (
      <View style={{ alignItems: 'center', marginTop: 32 }}>
        <Ionicons name="calendar-outline" size={36} color={c.muted} style={{ marginBottom: 12 }} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'center' }}>Keine freien Termine</Text>
        <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
          In den nächsten 14 Tagen sind keine freien Termine verfügbar.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {byDate.map((group) => {
        const isOpen = expandedDate === group.dateKey;
        const showAll = showAllFor.has(group.dateKey);
        const visibleSlots = showAll ? group.slots : group.slots.slice(0, 6);
        const hasMore = group.slots.length > 6 && !showAll;
        const groupHasSelected = group.slots.some((slot) => selectedSlot?.startsAt === slot.startsAt);

        return (
          <View
            key={group.dateKey}
            style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}
          >
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

            {isOpen && (
              <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {visibleSlots.map((slot) => {
                    const active = selectedSlot?.startsAt === slot.startsAt;
                    return (
                      <Pressable
                        key={slot.startsAt}
                        onPress={() => {
                          onSelectSlot(slot);
                          onPicked?.(slot);
                        }}
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
  );
}

export function InquiryRequestForm({ c, t, therapist, authToken, onSuccess, onClose }) {
  const insets = useSafeAreaInsets();
  const { heilmittelOptions } = useConfigOptions();
  const loggedInPatient = useAppStore(appStoreSelectors.loggedInPatient);
  const updatePatientProfile = useAppStore((s) => s.updatePatientProfile);

  const knownKassenart = loggedInPatient?.kassenart ?? null;

  const [step, setStep] = useState(1);
  const [suchtyp, setSuchtyp] = useState('SERIE');
  const [selectedKassenart, setSelectedKassenart] = useState(knownKassenart);
  const [selectedHeilmittel, setSelectedHeilmittel] = useState(null);
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null); // für Einzeltermin
  const [frequenz, setFrequenz] = useState('X1');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saveKassenart, setSaveKassenart] = useState(false);

  const availableHeilmittel = (Array.isArray(therapist?.heilmittel) ? therapist.heilmittel : [])
    .map((item) => {
      const option = heilmittelOptions.find((opt) => opt.key === item || opt.label === item);
      return option ?? { key: item, label: item };
    })
    .filter((option, index, arr) =>
      option?.key && arr.findIndex((c) => c.key === option.key) === index,
    );

  const insuranceOptions = kassenartOptions.filter((opt) => opt.key != null);

  const toggleDay = (key) => setSelectedDays((prev) =>
    prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key],
  );
  const toggleSlot = (key) => setSelectedSlots((prev) =>
    prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
  );

  function buildTimeWindows() {
    const windows = [];
    for (const day of selectedDays) {
      for (const slotKey of selectedSlots) {
        const z = ZEITFENSTER.find((zf) => zf.key === slotKey);
        if (z) windows.push({ weekday: day, vonMinute: z.vonMinute, bisMinute: z.bisMinute });
      }
    }
    return windows;
  }

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
    if (step === 1 && saveKassenart && selectedKassenart && authToken) {
      fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ kassenart: selectedKassenart }),
      }).then((res) => { if (res.ok) updatePatientProfile({ kassenart: selectedKassenart }); }).catch(() => {});
    }
    if (step === 2 && !selectedHeilmittel) {
      setError('Bitte wähle ein Heilmittel aus.');
      return;
    }
    if (step === 3 && suchtyp === 'EINZELTERMIN' && !selectedSlot) {
      setError('Bitte wähle einen Termin aus.');
      return;
    }
    if (step === 3 && suchtyp === 'SERIE') {
      if (selectedDays.length === 0) { setError('Bitte wähle mindestens einen Wochentag aus.'); return; }
      if (selectedSlots.length === 0) { setError('Bitte wähle mindestens eine Tageszeit aus.'); return; }
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
        frequenz: isEinzel ? 'X1' : frequenz,
        anzahlTermine: isEinzel ? 1 : 6,
        message: message.trim() || undefined,
        therapistIds: [therapist.id],
        timeWindows: isEinzel ? [] : buildTimeWindows(),
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
      <View style={{ flex: 1, padding: SPACE.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <Ionicons name="checkmark-circle" size={64} color={c.success ?? '#1A7A40'} />
        <Text style={{ ...TYPE.h2, color: c.text, marginTop: SPACE.md, textAlign: 'center' }}>Anfrage gesendet</Text>
        {therapist?.fullName ? (
          <Text style={{ ...TYPE.body, color: c.text, marginTop: SPACE.sm, textAlign: 'center', fontWeight: '600' }}>
            {therapist.fullName}
          </Text>
        ) : null}
        <Text style={{ ...TYPE.body, color: c.muted, marginTop: SPACE.sm, textAlign: 'center' }}>
          {isEinzel
            ? 'Der Therapeut prüft deine Anfrage und bestätigt den Termin.'
            : 'Der Therapeut prüft deine Wunschzeiten und bestätigt einen konkreten Termin.'}
        </Text>
        <Pressable
          onPress={onSuccess}
          style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: 32, marginTop: SPACE.lg }}
        >
          <Text style={{ ...TYPE.label, color: '#fff' }}>Zu meinen Anfragen</Text>
        </Pressable>
      </View>
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
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        padding: SPACE.lg, paddingBottom: SPACE.sm,
        backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border,
      }}>
        <Pressable onPress={handleBack} style={{ marginRight: 12, padding: 4 }} hitSlop={12}>
          <Ionicons name={step <= 1 ? 'close' : 'arrow-back'} size={24} color={c.muted} />
        </Pressable>
        <Text style={{ ...TYPE.h2, color: c.text, flex: 1 }}>Termin anfragen</Text>
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
              {loggedInPatient && !loggedInPatient.kassenart && selectedKassenart && (
                <Pressable
                  onPress={() => setSaveKassenart((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SPACE.md, paddingVertical: 4 }}
                >
                  <View style={{
                    width: 20, height: 20, borderRadius: 5, borderWidth: 2,
                    borderColor: saveKassenart ? c.primary : c.border,
                    backgroundColor: saveKassenart ? c.primary : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {saveKassenart && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text style={{ fontSize: 13, color: c.muted }}>In meinem Profil speichern</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Schritt 2: Heilmittel + (bei Serie) Frequenz */}
        {step === 2 && (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Welches Heilmittel?</Text>
              {availableHeilmittel.length === 0
                ? <Text style={{ ...TYPE.small, color: c.muted }}>Keine Leistungen verfügbar.</Text>
                : <ChipRow options={availableHeilmittel} selected={selectedHeilmittel} onSelect={setSelectedHeilmittel} c={c} />}
            </View>
            {suchtyp === 'SERIE' && (
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 8 }}>Häufigkeit pro Woche</Text>
                <ChipRow options={FREQUENZ_OPTIONS} selected={frequenz} onSelect={setFrequenz} c={c} />
              </View>
            )}
          </View>
        )}

        {/* Schritt 3: Slot-Picker (Einzeltermin) oder Zeitfenster (Serie) */}
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
            <Text style={{ ...TYPE.h2, color: c.text, marginBottom: SPACE.xs }}>Wann hast du Zeit?</Text>
            <Text style={{ ...TYPE.caption, color: c.muted, marginBottom: SPACE.md }}>
              Wähle Wochentage und Tageszeiten, die dir am besten passen. Der Therapeut schlägt dann einen konkreten Termin vor.
            </Text>
            <TimeWindowPicker
              selectedDays={selectedDays}
              selectedSlots={selectedSlots}
              onToggleDay={toggleDay}
              onToggleSlot={toggleSlot}
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
                  {suchtyp === 'EINZELTERMIN' ? 'Einzeltermin' : `Serie · ${FREQUENZ_OPTIONS.find((f) => f.key === frequenz)?.label}`}
                </Text>
              </Text>
              {suchtyp === 'EINZELTERMIN' && selectedSlot && (
                <Text style={{ fontSize: 13, color: c.muted }}>
                  Termin: <Text style={{ color: c.text, fontWeight: '600' }}>
                    {dateGroupLabel(selectedSlot.startsAt)} · {formatTime(selectedSlot.startsAt)}–{formatTime(selectedSlot.endsAt)}
                  </Text>
                </Text>
              )}
              {suchtyp === 'SERIE' && selectedDays.length > 0 && (
                <Text style={{ fontSize: 13, color: c.muted }}>
                  Tage: <Text style={{ color: c.text, fontWeight: '600' }}>
                    {selectedDays.map((d) => WOCHENTAGE.find((w) => w.key === d)?.label).join(', ')}
                  </Text>
                </Text>
              )}
              {suchtyp === 'SERIE' && selectedSlots.length > 0 && (
                <Text style={{ fontSize: 13, color: c.muted }}>
                  Uhrzeiten: <Text style={{ color: c.text, fontWeight: '600' }}>
                    {selectedSlots.map((s) => ZEITFENSTER.find((z) => z.key === s)?.label).join(', ')}
                  </Text>
                </Text>
              )}
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

        {!!error && (
          <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.sm, padding: 12, marginVertical: SPACE.sm, flexDirection: 'row', gap: 8 }}>
            <Ionicons name="alert-circle-outline" size={16} color={c.error} />
            <Text style={{ ...TYPE.small, color: c.error, flex: 1 }}>{error}</Text>
          </View>
        )}

        {!(step === 3 && suchtyp === 'EINZELTERMIN') && (
        <View style={{ marginTop: SPACE.sm }}>
          {step < TOTAL_STEPS ? (
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
                : <Text style={{ ...TYPE.label, color: '#fff', fontSize: 16 }}>Anfrage senden</Text>}
            </Pressable>
          )}
        </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
