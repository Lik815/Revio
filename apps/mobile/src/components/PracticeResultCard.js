import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PracticeLogoAvatar } from './PracticeLogoAvatar';
import { formatDist, RADIUS, resolveMediaUrl } from '../utils/app-utils';

// Search result card for a standalone practice. Mirrors the therapist card's
// shape but is clearly marked as a practice (business icon, "Physiotherapiepraxis"
// label, square logo). The whole card opens the practice profile — the actual
// request/booking happens via a therapist on the detail page.
export function PracticeResultCard({ practice, onPress, c, t, styles }) {
  const mutedText = c.textMuted ?? c.muted;
  const specialties = Array.isArray(practice?.specialties) ? practice.specialties.filter(Boolean) : [];
  const teamCount = typeof practice?.teamCount === 'number' ? practice.teamCount : 0;
  const distLabel = practice?.distKm != null ? formatDist(practice.distKm) : null;

  return (
    <Pressable
      style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}
      onPress={onPress}
    >
      {/* Header: logo · name · practice label · chevron */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <PracticeLogoAvatar
          uri={practice?.logo ? resolveMediaUrl(practice.logo) : undefined}
          name={practice?.name}
          c={c}
          style={{ width: 52, height: 52, borderRadius: RADIUS.md }}
        />
        <View style={{ flex: 1, paddingTop: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, lineHeight: 22 }} numberOfLines={1}>
            {practice?.name ?? 'Praxis'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <Ionicons name="business-outline" size={12} color={mutedText} />
            <Text style={{ fontSize: 13, color: mutedText, lineHeight: 18 }}>{t('practiceLabel')}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={14} color={c.muted} style={{ opacity: 0.45, paddingTop: 4 }} />
      </View>

      {/* Specialties as chips */}
      {specialties.length > 0 ? (
        <View style={[styles.tagRow, { marginTop: 12 }]}>
          {specialties.slice(0, 3).map((spec) => (
            <View key={spec} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
              <Text style={[styles.tagText, { color: c.text }]} numberOfLines={1}>{spec}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Footer: location · distance · team */}
      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
          <Ionicons name="location-outline" size={13} color={mutedText} />
          <Text style={{ fontSize: 13, color: mutedText }} numberOfLines={1}>
            {practice?.city ?? '—'}{distLabel ? ` · ${distLabel}` : ''}
          </Text>
        </View>
        {teamCount > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={13} color={mutedText} />
            <Text style={{ fontSize: 13, color: mutedText }}>
              {teamCount} {teamCount === 1 ? t('therapistSingular') : t('therapistPlural')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* CTA */}
      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: RADIUS.md, backgroundColor: c.primaryBg }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>{t('viewPractice')}</Text>
        <Ionicons name="arrow-forward" size={15} color={c.primary} />
      </View>
    </Pressable>
  );
}
