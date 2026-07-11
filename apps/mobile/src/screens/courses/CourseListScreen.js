import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/use-theme';
import { getBaseUrl, RADIUS, SPACE, TUNNEL_HEADERS, TYPE, courseCategoryChips } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';
import { CourseCard } from '../../components/CourseCard';
import { ROOT_ROUTES } from '../../navigation/route-names';

const CATEGORY_CHIPS = courseCategoryChips;

export function CourseListScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const [categoryKey, setCategoryKey] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchCourses = useCallback(async (key, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (key) params.set('categoryKey', key);
      const res = await fetch(`${getBaseUrl()}/courses?${params}`, { headers: { ...TUNNEL_HEADERS } });
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (_) {
      // ignore network errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses(categoryKey);
  }, [categoryKey, fetchCourses]);

  const handleCategorySelect = (key) => {
    setCategoryKey(key);
  };

  const openDetail = (course) => {
    navigation.navigate(ROOT_ROUTES.COURSE_DETAIL, { courseId: course.id, courseTitle: course.title });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: SPACE.lg, backgroundColor: c.background }}>
        <BackButton c={c} label="Zurück" onPress={() => navigation.goBack()} />
        <Text style={[TYPE.xl, { color: c.text, marginBottom: SPACE.md }]}>Gesundheitskurse</Text>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: SPACE.sm, paddingBottom: SPACE.md }}
        >
          {CATEGORY_CHIPS.map((chip) => {
            const active = categoryKey === chip.key;
            return (
              <Pressable
                key={String(chip.key)}
                onPress={() => handleCategorySelect(chip.key)}
                style={{
                  borderWidth: 1,
                  borderRadius: RADIUS.full,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderColor: active ? c.primary : c.border,
                  backgroundColor: active ? c.primary : c.card,
                }}
              >
                <Text style={[TYPE.meta, { color: active ? '#FFFFFF' : c.text }]}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md, paddingBottom: insets.bottom + SPACE.xl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCourses(categoryKey, true)}
              tintColor={c.primary}
            />
          }
          renderItem={({ item }) => (
            <CourseCard course={item} c={c} onPress={() => openDetail(item)} />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: SPACE.xxl * 2 }}>
              <Text style={[TYPE.heading, { color: c.textMuted, textAlign: 'center' }]}>
                Keine Kurse gefunden
              </Text>
              <Text style={[TYPE.body, { color: c.muted, textAlign: 'center', marginTop: SPACE.sm }]}>
                Versuche eine andere Kategorie
              </Text>
            </View>
          }
          ListHeaderComponent={
            total > 0 ? (
              <Text style={[TYPE.meta, { color: c.textMuted, marginBottom: SPACE.sm }]}>
                {total} {total === 1 ? 'Kurs' : 'Kurse'}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}
