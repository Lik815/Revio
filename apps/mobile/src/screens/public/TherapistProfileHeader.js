import React from 'react';
import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLangLabel, getPracticeInitials } from '../../utils/app-utils';

function StarRating({ rating, reviewCount, c }) {
  if (!rating || !reviewCount) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <Ionicons name="star" size={14} color={c.success} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>{rating.toFixed(1)}</Text>
      <Text style={{ fontSize: 13, color: c.muted }}>· {reviewCount} Bewertungen</Text>
    </View>
  );
}

function InfoChip({ icon, label, color, c, styles }) {
  return (
    <View style={[styles.tag, {
      backgroundColor: c.mutedBg,
      borderWidth: 1,
      borderColor: color ?? c.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
    }]}>
      <Ionicons name={icon} size={14} color={color ?? c.muted} />
      <Text style={[styles.tagText, { color: color ?? c.text, fontSize: 13 }]}>{label}</Text>
    </View>
  );
}

function InfoGrid({ cols, c, styles }) {
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, overflow: 'hidden', marginTop: 16, flexDirection: 'row' }}>
      {cols.map((col, i) => (
        <View
          key={col.label}
          style={{
            flex: 1,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderLeftWidth: i === 0 ? 0 : 1,
            borderLeftColor: c.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Ionicons name={col.icon} size={14} color={c.muted} />
            <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 0, fontSize: 11 }]}>{col.label}</Text>
          </View>
          <Text style={{ color: c.text, fontSize: 13, lineHeight: 19 }}>{col.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function TherapistProfileHeader({ th, c, styles }) {
  const therapistName = typeof th?.fullName === 'string' && th.fullName.trim() ? th.fullName.trim() : 'Profil';
  const therapistLanguages = Array.isArray(th?.languages) ? th.languages : [];

  return (
    <View style={[styles.practiceHeader, {
      backgroundColor: c.card,
      borderColor: c.border,
      paddingTop: 20,
      paddingBottom: 20,
      alignItems: 'stretch',
    }]}>
      {/* Avatar + Name + Titel + Rating */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <View style={{ position: 'relative' }}>
          {th.photo ? (
            <Image source={{ uri: th.photo }} style={{ width: 96, height: 96, borderRadius: 48 }} />
          ) : (
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>{getPracticeInitials(therapistName)}</Text>
            </View>
          )}
          <View style={{
            position: 'absolute', right: -2, bottom: -2,
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: c.accent,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 3, borderColor: c.card,
          }}>
            <Ionicons name="checkmark" size={18} color={c.background} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.practiceHeaderName, { color: c.text, textAlign: 'left', marginBottom: 2 }]}>
            {therapistName}
          </Text>
          <Text style={[styles.practiceHeaderCity, { color: c.muted, textAlign: 'left' }]}>
            {th.professionalTitle ?? ''}
          </Text>
          <StarRating rating={th.avgRating} reviewCount={th.reviewCount} c={c} />
        </View>
      </View>

      {/* Chips: Hausbesuch + Stadt */}
      <View style={[styles.tagRow, { marginTop: 16, gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }]}>
        <InfoChip
          icon="home-outline"
          label={th.homeVisit
            ? `Hausbesuch${th.serviceRadiusKm ? ` bis ${th.serviceRadiusKm} km` : ''}`
            : 'Kein Hausbesuch'}
          color={th.homeVisit ? c.success : undefined}
          c={c}
          styles={styles}
        />
        {th.city ? (
          <InfoChip icon="location-outline" label={th.city} c={c} styles={styles} />
        ) : null}
      </View>

      {/* 2-Spalten-Grid: Sprachen | Kostenübernahme */}
      <InfoGrid
        c={c}
        styles={styles}
        cols={[
          {
            icon: 'chatbubble-outline',
            label: 'SPRACHEN',
            value: therapistLanguages.length > 0 ? therapistLanguages.map(getLangLabel).join(', ') : '—',
          },
          {
            icon: 'card-outline',
            label: 'KOSTENÜBERNAHME',
            value: th.kassenart || 'Alle Kassen',
          },
        ]}
      />
    </View>
  );
}
