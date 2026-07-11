import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { RADIUS, SHADOW, SPACE, TYPE } from '../utils/app-utils';

export function formatNextDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatPrice(amount, currency) {
  if (!amount || Number(amount) === 0) return 'Kostenlos';
  return Number(amount).toLocaleString('de-DE', {
    style: 'currency',
    currency: currency ?? 'EUR',
    maximumFractionDigits: 0,
  });
}

export function CourseCard({ course, c, onPress }) {
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
      {/* Kurs-Kennzeichnung: klar von Therapeuten-Karte abgegrenzt */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
        <View style={{ backgroundColor: c.accent, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={[TYPE.label, { color: '#FFFFFF', letterSpacing: 0.5 }]}>KURS</Text>
        </View>
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
