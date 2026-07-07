import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

const CERT_INITIAL_LIMIT = 3;

function QualSection({ label, items, tagStyle, textStyle, c, styles, isFirst }) {
  return (
    <View style={{
      borderTopWidth: isFirst ? 0 : 1,
      borderTopColor: c.border,
      paddingHorizontal: 18,
      paddingVertical: 18,
    }}>
      <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 14 }]}>{label}</Text>
      <View style={styles.tagRow}>
        {items.map((item) => (
          <View key={item} style={[styles.tag, tagStyle, { paddingHorizontal: 18, paddingVertical: 10 }]}>
            <Text style={[styles.tagText, textStyle, { fontSize: 13 }]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function TherapistQualifications({ c, styles, t, heilmittel, specializations, areas, certifications }) {
  const [expanded, setExpanded] = useState(false);

  const visibleCerts = expanded ? certifications : certifications.slice(0, CERT_INITIAL_LIMIT);
  const hasCollapse = certifications.length > CERT_INITIAL_LIMIT;

  const sections = [
    heilmittel.length > 0 && {
      key: 'heilmittel',
      label: 'Heilmittel',
      items: heilmittel,
      tagStyle: { backgroundColor: c.primary },
      textStyle: { color: '#fff' },
    },
    specializations.length > 0 && {
      key: 'specs',
      label: t('specsLabel'),
      items: specializations,
      tagStyle: { backgroundColor: c.mutedBg },
      textStyle: { color: c.text },
    },
    areas.length > 0 && {
      key: 'areas',
      label: t('behandlungLabel'),
      items: areas,
      tagStyle: { backgroundColor: c.mutedBg },
      textStyle: { color: c.text },
    },
    certifications.length > 0 && {
      key: 'certs',
      label: t('certsLabel'),
      items: visibleCerts,
      tagStyle: { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success },
      textStyle: { color: c.success },
    },
  ].filter(Boolean);

  if (sections.length === 0) return null;

  return (
    <View style={[styles.infoSection, {
      backgroundColor: c.card,
      borderColor: c.border,
      paddingHorizontal: 0,
      paddingVertical: 0,
      overflow: 'hidden',
    }]}>
      {sections.map((section, i) => (
        <QualSection
          key={section.key}
          label={section.label}
          items={section.items}
          tagStyle={section.tagStyle}
          textStyle={section.textStyle}
          c={c}
          styles={styles}
          isFirst={i === 0}
        />
      ))}
      {hasCollapse ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={{
            borderTopWidth: 1,
            borderTopColor: c.border,
            paddingVertical: 14,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Text style={{ color: c.primary, fontSize: 14, fontWeight: '600' }}>
            {expanded ? 'Weniger anzeigen' : 'Alle Qualifikationen anzeigen'}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={c.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}
