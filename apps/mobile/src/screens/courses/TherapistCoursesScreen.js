import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/use-theme';
import { useToast } from '../../hooks/use-toast';
import { ToastOverlay } from '../../components/ToastOverlay';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';
import { TherapistCourseCreateScreen } from './TherapistCourseCreateScreen';

const STATUS_META = {
  DRAFT:            { label: 'Entwurf',       bg: 'mutedBg',   fg: 'muted'   },
  PENDING_REVIEW:   { label: 'In Prüfung',    bg: 'warningBg', fg: 'warning' },
  APPROVED:         { label: 'Genehmigt',     bg: 'successBg', fg: 'success' },
  REJECTED:         { label: 'Abgelehnt',     bg: 'errorBg',   fg: 'error'   },
  CHANGES_REQUESTED:{ label: 'Änderungen nötig', bg: 'warningBg', fg: 'warning' },
  SUSPENDED:        { label: 'Gesperrt',      bg: 'errorBg',   fg: 'error'   },
};

function StatusBadge({ status, c }) {
  const meta = STATUS_META[status] ?? { label: status, bg: 'mutedBg', fg: 'muted' };
  return (
    <View style={{ backgroundColor: c[meta.bg], borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={[TYPE.label, { color: c[meta.fg] }]}>{meta.label}</Text>
    </View>
  );
}

function CourseRow({ course, c, onPress }) {
  const runCount = course.runs?.length ?? 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, gap: SPACE.sm, opacity: pressed ? 0.85 : 1 },
        SHADOW.card,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.sm }}>
        <Text style={[TYPE.heading, { color: c.text, flex: 1 }]} numberOfLines={2}>{course.title}</Text>
        <StatusBadge status={course.reviewStatus} c={c} />
      </View>
      <Text style={[TYPE.meta, { color: c.textMuted }]}>
        {course.category?.label ?? course.categoryKey}
        {runCount > 0 ? `  ·  ${runCount} ${runCount === 1 ? 'Durchlauf' : 'Durchläufe'}` : '  ·  Noch kein Durchlauf'}
      </Text>
      {course.reviewStatus === 'DRAFT' && (
        <Text style={[TYPE.meta, { color: c.primary }]}>Noch nicht eingereicht – tippe zum Bearbeiten</Text>
      )}
      {course.reviewStatus === 'CHANGES_REQUESTED' && (
        <Text style={[TYPE.meta, { color: c.warning }]}>Admin hat Änderungen angefragt</Text>
      )}
    </Pressable>
  );
}

export function TherapistCoursesScreen({ authToken, c: cProp, onBack }) {
  const { c: themeC } = useTheme();
  const c = cProp ?? themeC;

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const { toastMsg, toastAnim, showToast } = useToast();

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/courses/my`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses ?? []);
      }
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  if (showCreate || editCourse) {
    return (
      <TherapistCourseCreateScreen
        authToken={authToken}
        c={c}
        existingCourse={editCourse}
        onBack={() => { setShowCreate(false); setEditCourse(null); }}
        onSaved={(message) => { setShowCreate(false); setEditCourse(null); load(); if (message) showToast(message); }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: SPACE.lg, backgroundColor: c.background }}>
        <BackButton c={c} label="Optionen" onPress={onBack} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md }}>
          <Text style={[TYPE.xl, { color: c.text }]}>Meine Kurse</Text>
          <Pressable
            onPress={() => setShowCreate(true)}
            style={{ backgroundColor: c.primary, borderRadius: RADIUS.full, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c.primary} />}
          renderItem={({ item }) => (
            <CourseRow course={item} c={c} onPress={() => setEditCourse(item)} />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: SPACE.lg }}>
              <Ionicons name="school-outline" size={48} color={c.border} />
              <Text style={[TYPE.heading, { color: c.textMuted, textAlign: 'center' }]}>Noch keine Kurse</Text>
              <Pressable
                onPress={() => setShowCreate(true)}
                style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: SPACE.xl }}
              >
                <Text style={[TYPE.heading, { color: '#FFFFFF' }]}>Ersten Kurs anlegen</Text>
              </Pressable>
            </View>
          }
        />
      )}

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}
