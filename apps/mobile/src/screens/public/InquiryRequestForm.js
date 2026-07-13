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

function getThisWeekMonday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function addWeeks(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

function weekKey(monday) {
  return monday.toISOString().slice(0, 10);
}

function getWeekEnd(monday) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 7);
  return d;
}

function formatWeekRange(monday) {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${monday.toLocaleDateString('de-DE', opts)} – ${end.toLocaleDateString('de-DE', opts)}`;
}

function getWeekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const WEEK_DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function SlotPicker({ therapistId, heilmittel, selectedSlot, selectedTermine, multiSelect, maxSelect, onSelectSlot, onPicked, c }) {
  const todayMonday = useMemo(() => getThisWeekMonday(), []);
  const [weekStart, setWeekStart] = useState(() => getThisWeekMonday());
  const [slotsByWeek, setSlotsByWeek] = useState({});
  const [loadingWeek, setLoadingWeek] = useState(null);
  const [errorWeek, setErrorWeek] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);
  const [showAllFor, setShowAllFor] = useState(() => new Set());

  const currentKey = weekKey(weekStart);

  useEffect(() => {
    if (slotsByWeek[currentKey] !== undefined) return;
    setLoadingWeek(currentKey);
    setErrorWeek(null);
    fetch(
      `${getBaseUrl()}/therapists/${therapistId}/available-slots?heilmittel=${encodeURIComponent(heilmittel)}&from=${weekStart.toISOString()}&to=${getWeekEnd(weekStart).toISOString()}`,
      { headers: { ...TUNNEL_HEADERS } },
    )
      .then((r) => r.json())
      .then((data) => {
        const slotList = Array.isArray(data.slots) ? data.slots : [];
        setSlotsByWeek((prev) => ({ ...prev, [currentKey]: slotList }));
        setLoadingWeek(null);
        const firstSlot = slotList[0];
        setExpandedDate(firstSlot ? dateGroupKey(firstSlot.startsAt) : null);
      })
      .catch(() => { setErrorWeek(currentKey); setLoadingWeek(null); });
  }, [currentKey, therapistId, heilmittel]);

  useEffect(() => { setShowAllFor(new Set()); }, [currentKey]);

  const currentSlots = slotsByWeek[currentKey] ?? [];
  const isLoading = loadingWeek === currentKey;
  const hasError = errorWeek === currentKey;

  const byDate = useMemo(() => {
    const map = new Map();
    for (const slot of currentSlots) {
      const dk = dateGroupKey(slot.startsAt);
      if (!map.has(dk)) map.set(dk, { dateKey: dk, label: dateGroupLabel(slot.startsAt), slots: [] });
      map.get(dk).slots.push(slot);
    }
    return Array.from(map.values());
  }, [currentSlots]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = today.toISOString().slice(0, 10);
  const isFirstWeek = currentKey === weekKey(todayMonday);
  const weekDays = getWeekDays(weekStart);

  return (
    <View style={{ gap: 8 }}>
      {/* Wochen-Strip */}
      <View style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingVertical: 12, paddingHorizontal: 4 }}>
        {/* Header: ← Woche → */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 10 }}>
          <Pressable
            onPress={() => { if (!isFirstWeek) setWeekStart(addWeeks(weekStart, -1)); }}
            disabled={isFirstWeek}
            style={{ padding: 6, opacity: isFirstWeek ? 0.25 : 1 }}
          >
            <Ionicons name="chevron-back" size={18} color={c.text} />
          </Pressable>
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>{formatWeekRange(weekStart)}</Text>
          <Pressable onPress={() => setWeekStart(addWeeks(weekStart, 1))} style={{ padding: 6 }}>
            <Ionicons name="chevron-forward" size={18} color={c.text} />
          </Pressable>
        </View>
        {/* Tages-Zellen */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {weekDays.map((day, idx) => {
            const dk = day.toISOString().slice(0, 10);
            const isPast = day < today;
            const isToday = dk === todayKey;
            const hasSlotsForDay = byDate.some((g) => g.dateKey === dk);
            const hasSelection = multiSelect
              ? (selectedTermine ?? []).some((s) => s.startsAt?.slice(0, 10) === dk)
              : selectedSlot?.startsAt?.slice(0, 10) === dk;
            return (
              <Pressable
                key={dk}
                onPress={() => {
                  if (isPast || !hasSlotsForDay) return;
                  setExpandedDate(expandedDate === dk ? null : dk);
                }}
                style={{ alignItems: 'center', gap: 2, paddingVertical: 2, paddingHorizontal: 4, opacity: isPast ? 0.3 : 1 }}
              >
                <Text style={{ fontSize: 11, color: c.muted, fontWeight: '500' }}>{WEEK_DAY_LABELS[idx]}</Text>
                <Text style={{
                  fontSize: 14,
                  fontWeight: hasSelection || isToday ? '800' : '400',
                  color: hasSelection ? c.primary : isToday ? c.primary : hasSlotsForDay ? c.text : c.muted,
                }}>
                  {day.getDate()}
                </Text>
                <View style={{
                  width: 5, height: 5, borderRadius: 3,
                  backgroundColor: hasSelection ? c.primary : (isToday && hasSlotsForDay ? `${c.primary}60` : 'transparent'),
                }} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Slot-Liste */}
      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 20 }} />
      ) : hasError ? (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <Ionicons name="alert-circle-outline" size={24} color={c.error ?? '#EF4444'} style={{ marginBottom: 6 }} />
          <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center' }}>Termine konnten nicht geladen werden.</Text>
        </View>
      ) : byDate.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center' }}>Keine freien Termine in dieser Woche.</Text>
        </View>
      ) : (
        byDate.map((group) => {
          const isOpen = expandedDate === group.dateKey;
          const showAll = showAllFor.has(group.dateKey);
          const visibleSlots = showAll ? group.slots : group.slots.slice(0, 6);
          const hasMore = group.slots.length > 6 && !showAll;
          const groupHasSelected = multiSelect
            ? group.slots.some((slot) => (selectedTermine ?? []).some((s) => s.startsAt === slot.startsAt))
            : group.slots.some((slot) => selectedSlot?.startsAt === slot.startsAt);

          return (
            <View key={group.dateKey} style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
              <Pressable
                onPress={() => setExpandedDate(isOpen ? null : group.dateKey)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: c.card }}
              >
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: c.text }}>{group.label}</Text>
                {groupHasSelected && !isOpen && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginRight: 8 }} />
                )}
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
              </Pressable>

              {isOpen && (
                <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {visibleSlots.map((slot) => {
                      const active = multiSelect
                        ? (selectedTermine ?? []).some((s) => s.startsAt === slot.startsAt)
                        : selectedSlot?.startsAt === slot.startsAt;
                      const atMax = multiSelect && (selectedTermine ?? []).length >= (maxSelect ?? 10) && !active;
                      return (
                        <Pressable
                          key={slot.startsAt}
                          onPress={() => {
                            if (atMax) return;
                            onSelectSlot(slot);
                            if (!multiSelect) onPicked?.(slot);
                          }}
                          style={{
                            paddingVertical: 10, paddingHorizontal: 14,
                            borderRadius: RADIUS.sm, borderWidth: 1.5,
                            borderColor: active ? c.primary : c.border,
                            backgroundColor: active ? c.primaryBg : atMax ? c.mutedBg : c.card,
                            minWidth: 72, alignItems: 'center',
                            opacity: atMax ? 0.4 : 1,
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
                      <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary, letterSpacing: 0.4 }}>MEHR</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
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
  const [selectedSlot, setSelectedSlot] = useState(null);    // Einzeltermin: ein Slot
  const [selectedTermine, setSelectedTermine] = useState([]); // Serie: bis zu 10 Slots
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [autoConfirmed, setAutoConfirmed] = useState(false);

  const availableHeilmittel = (Array.isArray(therapist?.heilmittel) ? therapist.heilmittel : [])
    .map((item) => {
      const option = heilmittelOptions.find((opt) => opt.key === item || opt.label === item);
      return option ?? { key: item, label: item };
    })
    .filter((option, index, arr) =>
      option?.key && arr.findIndex((c) => c.key === option.key) === index,
    );

  const insuranceOptions = kassenartOptions.filter((opt) => opt.key != null);

  const MAX_TERMINE = 10;

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
    if (step === 1 && !knownKassenart && selectedKassenart && authToken) {
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
      <View style={{ flex: 1, padding: SPACE.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <Ionicons name="checkmark-circle" size={64} color={c.success ?? '#1A7A40'} />
        <Text style={{ ...TYPE.h2, color: c.text, marginTop: SPACE.md, textAlign: 'center' }}>
          {autoConfirmed ? 'Termin bestaetigt' : 'Anfrage gesendet'}
        </Text>
        {therapist?.fullName ? (
          <Text style={{ ...TYPE.body, color: c.text, marginTop: SPACE.sm, textAlign: 'center', fontWeight: '600' }}>
            {therapist.fullName}
          </Text>
        ) : null}
        <Text style={{ ...TYPE.body, color: c.muted, marginTop: SPACE.sm, textAlign: 'center' }}>
          {autoConfirmed
            ? 'Dein Termin wurde automatisch bestaetigt.'
            : isEinzel
              ? 'Der Therapeut prueft deine Anfrage und bestaetigt den Termin.'
              : 'Der Therapeut prueft deine Wunschzeiten und bestaetigt einen konkreten Termin.'}
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
