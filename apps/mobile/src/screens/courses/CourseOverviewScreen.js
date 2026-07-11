import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, RADIUS, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';
import { StatusBadge } from './TherapistCoursesScreen';

const LOCATION_TYPE_LABEL = {
  ONSITE: 'Vor Ort',
  ONLINE: 'Online',
  HYBRID: 'Hybrid',
};

const RUN_STATUS_LABEL = {
  DRAFT: 'Entwurf',
  PUBLISHED: 'Veröffentlicht',
  PAUSED: 'Pausiert',
  CANCELLED: 'Abgesagt',
};

function InfoRow({ label, value, c }) {
  if (!value) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={[TYPE.label, { color: c.textMuted }]}>{label}</Text>
      <Text style={[TYPE.body, { color: c.text }]}>{value}</Text>
    </View>
  );
}

function Section({ title, c, children }) {
  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, gap: SPACE.md }}>
      <Text style={[TYPE.heading, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CourseOverviewScreen({ authToken, c, courseId, onBack, onEdit }) {
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${getBaseUrl()}/courses/my/${courseId}`, {
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setCourse(data);
        }
      } catch (_) {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [courseId, authToken]);

  if (loading || !course) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: insets.top }}>
          <BackButton c={c} label="Meine Kurse" onPress={onBack} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      </View>
    );
  }

  const isDraftOrChanges = course.reviewStatus === 'DRAFT' || course.reviewStatus === 'CHANGES_REQUESTED';
  const isApproved = course.reviewStatus === 'APPROVED';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: SPACE.lg }}>
        <BackButton c={c} label="Meine Kurse" onPress={onBack} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingTop: 0, gap: SPACE.lg, paddingBottom: 120 }}>
        <View style={{ gap: SPACE.sm }}>
          <Text style={[TYPE.xl, { color: c.text }]}>{course.title}</Text>
          <StatusBadge status={course.reviewStatus} c={c} />
          {course.reviewStatus === 'PENDING_REVIEW' && (
            <Text style={[TYPE.meta, { color: c.warning, fontWeight: '600' }]}>Das Revio-Team prüft diesen Kurs gerade. Änderungen sind erst danach möglich.</Text>
          )}
          {course.reviewStatus === 'CHANGES_REQUESTED' && (
            <Text style={[TYPE.meta, { color: c.warning, fontWeight: '600' }]}>Admin hat Änderungen angefragt{course.adminNote ? `: ${course.adminNote}` : '.'}</Text>
          )}
          {course.reviewStatus === 'REJECTED' && (
            <Text style={[TYPE.meta, { color: c.error, fontWeight: '600' }]}>Abgelehnt{course.adminNote ? `: ${course.adminNote}` : '.'}</Text>
          )}
        </View>

        <Section title="Kursdetails" c={c}>
          <InfoRow label="Kategorie" value={course.category?.label ?? course.categoryKey} c={c} />
          <InfoRow label="Format" value={LOCATION_TYPE_LABEL[course.locationType] ?? course.locationType} c={c} />
          <InfoRow label="Kursleitung" value={course.instructorName} c={c} />
          <InfoRow label="Zielgruppe" value={course.targetAudience} c={c} />
          <InfoRow label="Beschreibung" value={course.description} c={c} />
        </Section>

        <Section title={`Durchläufe (${course.runs?.length ?? 0})`} c={c}>
          {(!course.runs || course.runs.length === 0) ? (
            <Text style={[TYPE.meta, { color: c.textMuted }]}>Noch kein Durchlauf angelegt.</Text>
          ) : (
            course.runs.map((run) => (
              <View
                key={run.id}
                style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: SPACE.md, gap: 6 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[TYPE.body, { color: c.text, fontWeight: '700' }]}>{run.label || 'Ohne Bezeichnung'}</Text>
                  <View style={{ backgroundColor: run.status === 'PUBLISHED' ? c.successBg : c.mutedBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={[TYPE.label, { color: run.status === 'PUBLISHED' ? c.success : c.muted }]}>
                      {RUN_STATUS_LABEL[run.status] ?? run.status}
                    </Text>
                  </View>
                </View>
                <Text style={[TYPE.meta, { color: c.textMuted }]}>
                  {run.city ? `${run.city} · ` : ''}Max. {run.maxParticipants} Teilnehmer
                  {run._count ? ` · ${run._count.enrollments} angemeldet` : ''}
                </Text>
                {run.sessions && run.sessions.length > 0 ? (
                  <View style={{ gap: 3, marginTop: 2 }}>
                    {run.sessions.map((s) => (
                      <Text key={s.id} style={[TYPE.meta, { color: c.textMuted }]}>
                        • {formatDateTime(s.startsAt)}{s.location ? ` · ${s.location}` : ''}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={[TYPE.meta, { color: c.textMuted }]}>Noch keine Termine.</Text>
                )}
              </View>
            ))
          )}
        </Section>
      </ScrollView>

      {(isDraftOrChanges || isApproved) && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACE.lg, paddingBottom: insets.bottom + SPACE.md, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
          <Pressable
            onPress={() => onEdit(course)}
            style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <Ionicons name={isApproved ? 'add-circle-outline' : 'create-outline'} size={18} color="#FFFFFF" />
            <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>
              {isApproved ? 'Durchlauf hinzufügen' : 'Bearbeiten'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
