import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/use-theme';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';

const CATEGORIES = [
  { key: 'bewegung',    label: 'Bewegungsgesundheit' },
  { key: 'ernaehrung', label: 'Ernährung' },
  { key: 'stress',     label: 'Stressbewältigung' },
  { key: 'entspannung',label: 'Entspannung' },
  { key: 'sucht',      label: 'Suchtmittelkonsum' },
  { key: 'sonstiges',  label: 'Sonstiges' },
];

const LOCATION_TYPES = [
  { key: 'ONSITE',  label: 'Vor Ort' },
  { key: 'ONLINE',  label: 'Online' },
  { key: 'HYBRID',  label: 'Hybrid' },
];

// ── Hilfskomponenten ─────────────────────────────────────────────────────────

function Field({ label, required, children }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={[TYPE.meta, { color: '#6B838E' }]}>{label}{required ? ' *' : ''}</Text>
      {children}
    </View>
  );
}

function Input({ value, onChangeText, placeholder, c, multiline, keyboardType, style }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      keyboardType={keyboardType}
      multiline={multiline}
      style={[
        TYPE.body,
        {
          color: c.text,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: RADIUS.sm,
          paddingHorizontal: SPACE.md,
          paddingVertical: 11,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? 'top' : undefined,
        },
        style,
      ]}
    />
  );
}

function ChipSelect({ options, value, onChange, c }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={{
              borderWidth: 1,
              borderRadius: RADIUS.full,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderColor: active ? c.primary : c.border,
              backgroundColor: active ? c.primary : c.card,
            }}
          >
            <Text style={[TYPE.meta, { color: active ? '#FFFFFF' : c.text }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepHeader({ step, total, c }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: SPACE.lg }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i < step ? c.primary : i === step ? c.accent : c.border,
          }}
        />
      ))}
    </View>
  );
}

// ── Datums-/Zeitpicker (nativ) ────────────────────────────────────────────────

function formatDatePart(value) {
  return value ? value.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Datum wählen';
}

function formatTimePart(value) {
  return value ? value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'Uhrzeit wählen';
}

// iOS: kompakter, immer sichtbarer Picker (öffnet natives Popover beim Tippen).
// Android: Pressable-Feld, das per Tap den nativen Dialog öffnet (kein Inline-Widget möglich).
function PickerField({ label, value, onChange, mode, c, themeMode }) {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const handleChange = (event, selected) => {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) onChange(selected);
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={[TYPE.label, { color: c.textMuted, marginBottom: 3 }]}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode}
          display="compact"
          onChange={handleChange}
          locale="de-DE"
          themeVariant={themeMode === 'dark' ? 'dark' : 'light'}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : (
        <>
          <Pressable
            onPress={() => setShowAndroidPicker(true)}
            style={{
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: RADIUS.sm,
              paddingHorizontal: SPACE.md,
              paddingVertical: 11,
            }}
          >
            <Text style={[TYPE.body, { color: value ? c.text : c.muted }]}>
              {mode === 'date' ? formatDatePart(value) : formatTimePart(value)}
            </Text>
          </Pressable>
          {showAndroidPicker && (
            <DateTimePicker value={value ?? new Date()} mode={mode} display="default" onChange={handleChange} />
          )}
        </>
      )}
    </View>
  );
}

function DateTimeRow({ session, index, onChange, onRemove, c, themeMode }) {
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, padding: SPACE.md, gap: SPACE.sm }, SHADOW.card]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[TYPE.meta, { color: c.textMuted }]}>Termin {index + 1}</Text>
        {index > 0 && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={c.muted} />
          </Pressable>
        )}
      </View>
      <View style={{ gap: SPACE.sm }}>
        <PickerField
          label="Datum"
          value={session.date}
          onChange={(v) => onChange({ ...session, date: v })}
          mode="date"
          c={c}
          themeMode={themeMode}
        />
        <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
          <PickerField
            label="Von"
            value={session.startTime}
            onChange={(v) => onChange({ ...session, startTime: v })}
            mode="time"
            c={c}
            themeMode={themeMode}
          />
          <PickerField
            label="Bis"
            value={session.endTime}
            onChange={(v) => onChange({ ...session, endTime: v })}
            mode="time"
            c={c}
            themeMode={themeMode}
          />
        </View>
        <View>
          <Text style={[TYPE.label, { color: c.textMuted, marginBottom: 3 }]}>Ort (optional)</Text>
          <Input
            value={session.location}
            onChangeText={(v) => onChange({ ...session, location: v })}
            placeholder="Raum 3, Musterstr. 1"
            c={c}
          />
        </View>
      </View>
    </View>
  );
}

// ── Datum + Uhrzeit zusammenführen ────────────────────────────────────────────

function combineDateAndTime(date, time) {
  if (!date || !time) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes());
}

// ── Haupt-Screen ─────────────────────────────────────────────────────────────

export function TherapistCourseCreateScreen({ authToken, c: cProp, existingCourse, onBack, onSaved }) {
  const { c: themeC, themeMode } = useTheme();
  const c = cProp ?? themeC;
  const insets = useSafeAreaInsets();

  const isEdit = !!existingCourse;
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Step 0 – Kursdetails
  const [title, setTitle] = useState(existingCourse?.title ?? '');
  const [categoryKey, setCategoryKey] = useState(existingCourse?.categoryKey ?? '');
  const [locationType, setLocationType] = useState(existingCourse?.locationType ?? 'ONSITE');
  const [description, setDescription] = useState(existingCourse?.description ?? '');
  const [targetAudience, setTargetAudience] = useState(existingCourse?.targetAudience ?? '');
  const [instructorName, setInstructorName] = useState(existingCourse?.instructorName ?? '');

  // Step 1 – Durchlauf
  const [runLabel, setRunLabel] = useState('');
  const [city, setCity] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('10');
  const [priceAmount, setPriceAmount] = useState('0');
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);

  // Step 2 – Termine
  const [sessions, setSessions] = useState([
    { date: null, startTime: null, endTime: null, location: '' },
  ]);

  const updateSession = (idx, val) => setSessions((prev) => prev.map((s, i) => i === idx ? val : s));
  const addSession = () => setSessions((prev) => [...prev, { date: null, startTime: null, endTime: null, location: '' }]);
  const removeSession = (idx) => setSessions((prev) => prev.filter((_, i) => i !== idx));

  const validateStep0 = () => {
    if (!title.trim()) return 'Titel ist Pflichtfeld.';
    if (!categoryKey) return 'Bitte eine Kategorie wählen.';
    if (!description.trim() || description.trim().length < 10) return 'Beschreibung muss mindestens 10 Zeichen haben.';
    if (!instructorName.trim()) return 'Kursleitung ist Pflichtfeld.';
    return null;
  };

  const validateStep1 = () => {
    if (!maxParticipants || parseInt(maxParticipants, 10) < 1) return 'Mindestens 1 Teilnehmer.';
    return null;
  };

  const validateStep2 = () => {
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (!s.date || !s.startTime || !s.endTime) return `Termin ${i + 1}: Datum und Uhrzeiten ausfüllen.`;
      const start = combineDateAndTime(s.date, s.startTime);
      const end = combineDateAndTime(s.date, s.endTime);
      if (end <= start) return `Termin ${i + 1}: Endzeit muss nach Startzeit liegen.`;
    }
    return null;
  };

  const handleNext = () => {
    setError(null);
    const err = step === 0 ? validateStep0() : step === 1 ? validateStep1() : null;
    if (err) { setError(err); return; }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setError(null);
    const err = validateStep2();
    if (err) { setError(err); return; }

    setSubmitting(true);
    try {
      // 1. Kurs anlegen oder vorhandenen verwenden
      let courseId = existingCourse?.id;
      if (!courseId || existingCourse?.reviewStatus === 'DRAFT' || existingCourse?.reviewStatus === 'CHANGES_REQUESTED') {
        const coursePayload = {
          categoryKey,
          title: title.trim(),
          description: description.trim(),
          targetAudience: targetAudience.trim() || undefined,
          instructorName: instructorName.trim(),
          locationType,
        };
        const courseRes = await fetch(
          courseId ? `${getBaseUrl()}/courses/my/${courseId}` : `${getBaseUrl()}/courses/my`,
          {
            method: courseId ? 'PUT' : 'POST',
            headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(coursePayload),
          },
        );
        if (!courseRes.ok) {
          const d = await courseRes.json().catch(() => ({}));
          throw new Error(d?.error ?? 'Kurs konnte nicht gespeichert werden.');
        }
        const courseData = await courseRes.json();
        courseId = courseData.id ?? courseId;
      }

      // 2. Durchlauf anlegen
      const runPayload = {
        label: runLabel.trim() || undefined,
        city: city.trim() || undefined,
        maxParticipants: parseInt(maxParticipants, 10),
        priceAmount: parseInt(priceAmount, 10) || 0,
        priceCurrency: 'EUR',
        waitlistEnabled,
      };
      const runRes = await fetch(`${getBaseUrl()}/courses/my/${courseId}/runs`, {
        method: 'POST',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(runPayload),
      });
      if (!runRes.ok) {
        const d = await runRes.json().catch(() => ({}));
        throw new Error(d?.error ?? 'Durchlauf konnte nicht angelegt werden.');
      }
      const runData = await runRes.json();
      const runId = runData.id;

      // 3. Sessions anlegen
      const sessionPayloads = sessions.map((s) => ({
        startsAt: combineDateAndTime(s.date, s.startTime).toISOString(),
        endsAt: combineDateAndTime(s.date, s.endTime).toISOString(),
        location: s.location.trim() || undefined,
      }));
      const sessRes = await fetch(`${getBaseUrl()}/courses/my/${courseId}/runs/${runId}/sessions`, {
        method: 'POST',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionPayloads),
      });
      if (!sessRes.ok) {
        const d = await sessRes.json().catch(() => ({}));
        throw new Error(d?.error ?? 'Termine konnten nicht gespeichert werden.');
      }

      // 4. Zur Prüfung einreichen (nur wenn DRAFT oder CHANGES_REQUESTED)
      if (!existingCourse || existingCourse.reviewStatus === 'DRAFT' || existingCourse.reviewStatus === 'CHANGES_REQUESTED') {
        await fetch(`${getBaseUrl()}/courses/my/${courseId}/submit`, {
          method: 'POST',
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        });
      }

      onSaved();
    } catch (e) {
      setError(e.message ?? 'Unbekannter Fehler.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ['Kursdetails', 'Durchlauf', 'Termine'];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ paddingHorizontal: SPACE.lg }}>
        <BackButton c={c} label={step === 0 ? 'Meine Kurse' : stepLabels[step - 1]} onPress={step === 0 ? onBack : () => setStep((s) => s - 1)} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: insets.bottom + 40, gap: SPACE.lg }} keyboardShouldPersistTaps="handled">
        <StepHeader step={step} total={3} c={c} />

        <View style={{ gap: 2 }}>
          <Text style={[TYPE.xl, { color: c.text }]}>{isEdit ? 'Kurs bearbeiten' : 'Neuer Kurs'}</Text>
          <Text style={[TYPE.meta, { color: c.textMuted }]}>Schritt {step + 1} von 3 – {stepLabels[step]}</Text>
        </View>

        {/* ── Schritt 0: Kursdetails ── */}
        {step === 0 && (
          <>
            <Field label="Kurstitel" required>
              <Input value={title} onChangeText={setTitle} placeholder="z. B. Rückenfit für den Alltag" c={c} />
            </Field>

            <Field label="Kategorie" required>
              <ChipSelect options={CATEGORIES} value={categoryKey} onChange={setCategoryKey} c={c} />
            </Field>

            <Field label="Format" required>
              <ChipSelect options={LOCATION_TYPES} value={locationType} onChange={setLocationType} c={c} />
            </Field>

            <Field label="Beschreibung" required>
              <Input value={description} onChangeText={setDescription} placeholder="Worum geht es in diesem Kurs?" c={c} multiline />
            </Field>

            <Field label="Zielgruppe">
              <Input value={targetAudience} onChangeText={setTargetAudience} placeholder="z. B. Berufstätige mit Rückenproblemen" c={c} multiline />
            </Field>

            <Field label="Kursleitung" required>
              <Input value={instructorName} onChangeText={setInstructorName} placeholder="Vor- und Nachname" c={c} />
            </Field>
          </>
        )}

        {/* ── Schritt 1: Durchlauf ── */}
        {step === 1 && (
          <>
            <Field label="Bezeichnung des Durchlaufs">
              <Input value={runLabel} onChangeText={setRunLabel} placeholder="z. B. Herbst 2026" c={c} />
            </Field>

            <Field label="Stadt / Ort">
              <Input value={city} onChangeText={setCity} placeholder="z. B. München" c={c} />
            </Field>

            <Field label="Max. Teilnehmerzahl" required>
              <Input value={maxParticipants} onChangeText={setMaxParticipants} placeholder="10" c={c} keyboardType="number-pad" />
            </Field>

            <Field label="Preis (EUR, 0 = kostenlos)">
              <Input value={priceAmount} onChangeText={setPriceAmount} placeholder="0" c={c} keyboardType="number-pad" />
            </Field>

            <Pressable onPress={() => setWaitlistEnabled((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
              <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                borderColor: waitlistEnabled ? c.primary : c.border,
                backgroundColor: waitlistEnabled ? c.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {waitlistEnabled ? <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>✓</Text> : null}
              </View>
              <View>
                <Text style={[TYPE.body, { color: c.text }]}>Warteliste aktivieren</Text>
                <Text style={[TYPE.meta, { color: c.textMuted }]}>Bei Ausbuchtung können sich weitere Interessierte eintragen</Text>
              </View>
            </Pressable>
          </>
        )}

        {/* ── Schritt 2: Termine ── */}
        {step === 2 && (
          <>
            <Text style={[TYPE.body, { color: c.textMuted }]}>
              Trage alle Einzeltermine des Durchlaufs ein. Jeder Termin erscheint danach in deinem Kalender.
            </Text>
            {sessions.map((session, idx) => (
              <DateTimeRow
                key={idx}
                session={session}
                index={idx}
                onChange={(val) => updateSession(idx, val)}
                onRemove={() => removeSession(idx)}
                c={c}
                themeMode={themeMode}
              />
            ))}
            <Pressable
              onPress={addSession}
              style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.sm }}
            >
              <Ionicons name="add-circle-outline" size={20} color={c.primary} />
              <Text style={[TYPE.body, { color: c.primary }]}>Weiteren Termin hinzufügen</Text>
            </Pressable>
          </>
        )}

        {error ? (
          <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.sm, padding: SPACE.md }}>
            <Text style={[TYPE.meta, { color: c.error }]}>{error}</Text>
          </View>
        ) : null}

        {/* ── Navigations-Button ── */}
        <Pressable
          onPress={step < 2 ? handleNext : handleSubmit}
          disabled={submitting}
          style={({ pressed }) => ({
            backgroundColor: submitting ? c.muted : pressed ? c.accent : c.primary,
            borderRadius: RADIUS.md,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: SPACE.sm,
          })}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>
              {step < 2 ? 'Weiter' : 'Kurs einreichen'}
            </Text>
          )}
        </Pressable>

        {step === 2 && (
          <Text style={[TYPE.meta, { color: c.textMuted, textAlign: 'center' }]}>
            Nach dem Einreichen prüft das Revio-Team deinen Kurs und schaltet ihn frei.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
