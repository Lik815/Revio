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
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS, TYPE } from '../../utils/app-utils';
import { BackButton } from '../../components/BackButton';
import { ROOT_ROUTES } from '../../navigation/route-names';

const CATEGORY_CHIPS = [
  { key: null, label: 'Alle' },
  { key: 'bewegung', label: 'Bewegung' },
  { key: 'ernaehrung', label: 'Ernährung' },
  { key: 'stress', label: 'Stressbewältigung' },
  { key: 'entspannung', label: 'Entspannung' },
  { key: 'sucht', label: 'Suchtmittelkonsum' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

function formatNextDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPrice(amount, currency) {
  if (!amount || Number(amount) === 0) return 'Kostenlos';
  return Number(amount).toLocaleString('de-DE', {
    style: 'currency',
    currency: currency ?? 'EUR',
    maximumFractionDigits: 0,
  });
}

function CourseCard({ course, c, onPress }) {
  const cheapestRun = course.runs?.reduce((min, r) => {
    if (!min) return r;
    return Number(r.priceAmount ?? 0) < Number(min.priceAmount ?? 0) ? r : min;
  }, null);
  const nextDate = course.runs?.map((r) => r.nextSessionAt).filter(Boolean).sort()[0];
  const anyAvailable = course.runs?.some((r) => r.available);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: c.card,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: c.border,
          padding: SPACE.lg,
          gap: SPACE.sm,
          opacity: pressed ? 0.85 : 1,
        },
        SHADOW.card,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, flexWrap: 'wrap' }}>
        <View style={{ backgroundColor: c.primaryBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={[TYPE.label, { color: c.primary }]}>{course.category?.label ?? course.category?.key}</Text>
        </View>
        {course.healthInsuranceEligible && (
          <View style={{ backgroundColor: c.accentBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={[TYPE.label, { color: c.accent }]}>Krankenkasse</Text>
          </View>
        )}
      </View>

      <Text style={[TYPE.heading, { color: c.text }]} numberOfLines={2}>{course.title}</Text>

      {course.description ? (
        <Text style={[TYPE.body, { color: c.textMuted }]} numberOfLines={2}>{course.description}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.xs }}>
        <View style={{ gap: 2 }}>
          {course.provider?.name ? (
            <Text style={[TYPE.meta, { color: c.textMuted }]}>{course.provider.name}</Text>
          ) : null}
          {nextDate ? (
            <Text style={[TYPE.meta, { color: c.textMuted }]}>Ab {formatNextDate(nextDate)}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {cheapestRun ? (
            <Text style={[TYPE.heading, { color: c.primary }]}>
              {formatPrice(cheapestRun.priceAmount, cheapestRun.priceCurrency)}
            </Text>
          ) : null}
          <View style={{
            backgroundColor: anyAvailable ? c.successBg : c.mutedBg,
            borderRadius: RADIUS.full,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
            <Text style={[TYPE.label, { color: anyAvailable ? c.success : c.muted }]}>
              {anyAvailable ? 'Verfügbar' : 'Ausgebucht'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

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
