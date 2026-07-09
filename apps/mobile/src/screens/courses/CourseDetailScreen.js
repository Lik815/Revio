import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/use-theme';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';

function formatDate(iso, opts) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', opts ?? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatPrice(amount, currency) {
  if (!amount || Number(amount) === 0) return 'Kostenlos';
  return Number(amount).toLocaleString('de-DE', {
    style: 'currency',
    currency: currency ?? 'EUR',
    maximumFractionDigits: 0,
  });
}

function SectionLabel({ text, c }) {
  return (
    <Text style={[TYPE.label, { color: c.textMuted, marginBottom: SPACE.sm }]}>{text}</Text>
  );
}

function RunCard({ run, c, onEnroll }) {
  const [expanded, setExpanded] = useState(false);
  const spotsLeft = run.maxParticipants - run.confirmedCount;
  const isFull = !run.available;
  const isPaused = run.status === 'PAUSED';
  const canEnroll = run.available || run.waitlistEnabled;
  const deadline = run.bookingDeadline ? new Date(run.bookingDeadline) : null;
  const deadlinePassed = deadline && deadline < new Date();

  return (
    <View style={[{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }, SHADOW.card]}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={{ padding: SPACE.lg, gap: SPACE.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 3 }}>
            {run.label ? (
              <Text style={[TYPE.heading, { color: c.text }]}>{run.label}</Text>
            ) : null}
            {run.city ? (
              <Text style={[TYPE.meta, { color: c.textMuted }]}>{run.city}</Text>
            ) : null}
            {run.sessions?.[0] ? (
              <Text style={[TYPE.meta, { color: c.textMuted }]}>
                Startet {formatDate(run.sessions[0].startsAt)}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[TYPE.heading, { color: c.primary }]}>
              {formatPrice(run.priceAmount, run.priceCurrency)}
            </Text>
            {isPaused ? (
              <View style={{ backgroundColor: c.warningBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={[TYPE.label, { color: c.warning }]}>Pausiert</Text>
              </View>
            ) : isFull && !run.waitlistEnabled ? (
              <View style={{ backgroundColor: c.mutedBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={[TYPE.label, { color: c.muted }]}>Ausgebucht</Text>
              </View>
            ) : isFull && run.waitlistEnabled ? (
              <View style={{ backgroundColor: c.warningBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={[TYPE.label, { color: c.warning }]}>Warteliste</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: c.successBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={[TYPE.label, { color: c.success }]}>
                  {spotsLeft <= 3 ? `Noch ${spotsLeft} Platz${spotsLeft === 1 ? '' : ''}` : 'Verfügbar'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[TYPE.meta, { color: c.primary }]}>
            {run.sessions?.length ?? 0} Termine  {expanded ? '▲' : '▼'}
          </Text>
        </View>
      </Pressable>

      {expanded && run.sessions?.length > 0 && (
        <View style={{ borderTopWidth: 1, borderColor: c.border, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, gap: SPACE.sm }}>
          {run.sessions.map((session, idx) => (
            <View key={session.id} style={{ flexDirection: 'row', gap: SPACE.md }}>
              <Text style={[TYPE.meta, { color: c.muted, width: 20 }]}>{idx + 1}.</Text>
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.meta, { color: c.text }]}>
                  {formatDate(session.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                <Text style={[TYPE.meta, { color: c.textMuted }]}>
                  {formatTime(session.startsAt)} – {formatTime(session.endsAt)} Uhr
                  {session.location ? `  ·  ${session.location}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!isPaused && !deadlinePassed && canEnroll && (
        <View style={{ borderTopWidth: 1, borderColor: c.border, padding: SPACE.lg }}>
          <Pressable
            onPress={() => onEnroll(run)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? c.accent : c.primary,
              borderRadius: RADIUS.md,
              paddingVertical: 14,
              alignItems: 'center',
            })}
          >
            <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>
              {isFull ? 'Auf Warteliste' : 'Jetzt anmelden'}
            </Text>
          </Pressable>
          {deadline && !deadlinePassed && (
            <Text style={[TYPE.meta, { color: c.muted, textAlign: 'center', marginTop: SPACE.sm }]}>
              Anmeldeschluss: {formatDate(deadline, { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          )}
        </View>
      )}
      {deadlinePassed && (
        <View style={{ borderTopWidth: 1, borderColor: c.border, padding: SPACE.md }}>
          <Text style={[TYPE.meta, { color: c.muted, textAlign: 'center' }]}>Anmeldeschluss überschritten</Text>
        </View>
      )}
    </View>
  );
}

function EnrollModal({ visible, run, courseTitle, c, onClose }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setName(''); setEmail(''); setPhone(''); setConsent(false);
    setSubmitting(false); setSuccess(false); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Name und E-Mail sind Pflichtfelder.');
      return;
    }
    if (!consent) {
      setError('Bitte stimme der Datenschutzerklärung zu.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/courses/runs/${run.id}/enroll`, {
        method: 'POST',
        headers: { ...TUNNEL_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: name.trim(),
          patientEmail: email.trim().toLowerCase(),
          patientPhone: phone.trim() || undefined,
          consentAccepted: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data?.error ?? 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
      }
    } catch (_) {
      setError('Netzwerkfehler. Bitte prüfe deine Verbindung.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: insets.top + SPACE.md, paddingBottom: SPACE.sm, borderBottomWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[TYPE.heading, { color: c.text, flex: 1 }]} numberOfLines={1}>Anmeldung</Text>
          <Pressable onPress={handleClose} hitSlop={10} style={{ padding: 4 }}>
            <Text style={[TYPE.heading, { color: c.primary }]}>Schliessen</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          {success ? (
            <View style={{ alignItems: 'center', paddingTop: SPACE.xxl, gap: SPACE.lg }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.successBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 28 }}>✓</Text>
              </View>
              <Text style={[TYPE.lg, { color: c.text, textAlign: 'center' }]}>Anmeldung eingegangen</Text>
              <Text style={[TYPE.body, { color: c.textMuted, textAlign: 'center' }]}>
                Wir haben dir eine Bestätigungsmail geschickt. Bitte bestätige deine Anmeldung über den Link in der E-Mail.
              </Text>
              <Pressable
                onPress={handleClose}
                style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: SPACE.xxl, marginTop: SPACE.md }}
              >
                <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>Fertig</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ gap: SPACE.xs }}>
                <Text style={[TYPE.meta, { color: c.textMuted }]}>Kurs</Text>
                <Text style={[TYPE.body, { color: c.text }]}>{courseTitle}</Text>
                {run?.label ? <Text style={[TYPE.meta, { color: c.textMuted }]}>{run.label}</Text> : null}
              </View>

              <View style={{ gap: SPACE.md }}>
                <View style={{ gap: SPACE.xs }}>
                  <Text style={[TYPE.meta, { color: c.textMuted }]}>Name *</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Vor- und Nachname"
                    placeholderTextColor={c.muted}
                    autoCapitalize="words"
                    style={[TYPE.body, { color: c.text, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 12 }]}
                  />
                </View>

                <View style={{ gap: SPACE.xs }}>
                  <Text style={[TYPE.meta, { color: c.textMuted }]}>E-Mail *</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="deine@email.de"
                    placeholderTextColor={c.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[TYPE.body, { color: c.text, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 12 }]}
                  />
                </View>

                <View style={{ gap: SPACE.xs }}>
                  <Text style={[TYPE.meta, { color: c.textMuted }]}>Telefon (optional)</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+49 ..."
                    placeholderTextColor={c.muted}
                    keyboardType="phone-pad"
                    style={[TYPE.body, { color: c.text, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 12 }]}
                  />
                </View>
              </View>

              <Pressable
                onPress={() => setConsent((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: consent ? c.primary : c.border, backgroundColor: consent ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  {consent ? <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>✓</Text> : null}
                </View>
                <Text style={[TYPE.body, { color: c.textMuted, flex: 1 }]}>
                  Ich stimme der Verarbeitung meiner Daten zur Kursanmeldung zu. Die Anmeldung ist erst nach Bestätigung per E-Mail verbindlich.
                </Text>
              </Pressable>

              {error ? (
                <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.sm, padding: SPACE.md }}>
                  <Text style={[TYPE.meta, { color: c.error }]}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
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
                  <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>Jetzt anmelden</Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CourseDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { courseId, courseTitle: initialTitle } = route.params ?? {};
  const { c } = useTheme();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrollRun, setEnrollRun] = useState(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    fetch(`${getBaseUrl()}/courses/${courseId}`, { headers: { ...TUNNEL_HEADERS } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setCourse(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  const publishedRuns = course?.runs?.filter((r) => r.status === 'PUBLISHED') ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <BackButton c={c} label="Zurück" onPress={() => navigation.goBack()} />
          <ActivityIndicator color={c.primary} style={{ marginTop: SPACE.xxl }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Header */}
          <View style={{ paddingHorizontal: SPACE.lg, backgroundColor: c.background }}>
            <BackButton c={c} label="Kurse" onPress={() => navigation.goBack()} />
          </View>

          <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.md }}>
            {/* Category + flags */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
              {course?.category && (
                <View style={{ backgroundColor: c.primaryBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={[TYPE.label, { color: c.primary }]}>{course.category.label}</Text>
                </View>
              )}
              {course?.healthInsuranceEligible && (
                <View style={{ backgroundColor: c.accentBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={[TYPE.label, { color: c.accent }]}>Krankenkasse</Text>
                </View>
              )}
              {course?.zppVerified && (
                <View style={{ backgroundColor: c.successBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={[TYPE.label, { color: c.success }]}>ZPP-zertifiziert</Text>
                </View>
              )}
            </View>

            <Text style={[TYPE.xl, { color: c.text }]}>{course?.title ?? initialTitle}</Text>

            {/* Provider */}
            {course?.provider && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                <Text style={[TYPE.body, { color: c.textMuted }]}>
                  {course.provider.name}
                  {course.provider.city ? `  ·  ${course.provider.city}` : ''}
                </Text>
              </View>
            )}

            {/* Instructor */}
            {course?.instructorName && course.instructorName !== course.provider?.name && (
              <Text style={[TYPE.meta, { color: c.textMuted }]}>Kursleitung: {course.instructorName}</Text>
            )}
          </View>

          {/* Description */}
          {course?.description ? (
            <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.lg, gap: SPACE.sm }}>
              <SectionLabel text="Kursbeschreibung" c={c} />
              <Text style={[TYPE.body, { color: c.text, lineHeight: 24 }]}>{course.description}</Text>
            </View>
          ) : null}

          {/* Target audience */}
          {course?.targetAudience ? (
            <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.lg, gap: SPACE.sm }}>
              <SectionLabel text="Zielgruppe" c={c} />
              <Text style={[TYPE.body, { color: c.text }]}>{course.targetAudience}</Text>
            </View>
          ) : null}

          {/* Prerequisites */}
          {course?.prerequisites ? (
            <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.lg, gap: SPACE.sm }}>
              <SectionLabel text="Voraussetzungen" c={c} />
              <Text style={[TYPE.body, { color: c.text }]}>{course.prerequisites}</Text>
            </View>
          ) : null}

          {/* Runs */}
          <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.xl, gap: SPACE.md }}>
            <SectionLabel text={`Termine & Anmeldung (${publishedRuns.length})`} c={c} />
            {publishedRuns.length === 0 ? (
              <Text style={[TYPE.body, { color: c.muted }]}>Derzeit keine buchbaren Termine</Text>
            ) : (
              publishedRuns.map((run) => (
                <RunCard key={run.id} run={run} c={c} onEnroll={(r) => setEnrollRun(r)} />
              ))
            )}
          </View>

          {/* Cancellation policy */}
          {course?.cancellationPolicy ? (
            <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.xl, gap: SPACE.sm }}>
              <SectionLabel text="Stornierungsbedingungen" c={c} />
              <Text style={[TYPE.body, { color: c.textMuted }]}>{course.cancellationPolicy}</Text>
            </View>
          ) : null}

          {/* Contact */}
          {course?.contactInfo ? (
            <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.lg, gap: SPACE.sm }}>
              <SectionLabel text="Kontakt" c={c} />
              <Text style={[TYPE.body, { color: c.textMuted }]}>{course.contactInfo}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <EnrollModal
        visible={!!enrollRun}
        run={enrollRun}
        courseTitle={course?.title ?? initialTitle}
        c={c}
        onClose={() => setEnrollRun(null)}
      />
    </View>
  );
}
