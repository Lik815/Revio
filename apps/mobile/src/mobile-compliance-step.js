import React from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';

import {
  RADIUS,
  SPACE,
  TYPE,
} from './mobile-utils';

const TAX_OPTIONS = ['yes', 'no', 'in_progress'];
const HEALTH_OPTIONS = ['yes', 'no', 'in_progress', 'unknown'];

export function getComplianceStatusLabel(value, t) {
  switch (value) {
    case 'yes':
      return t('yesLabel');
    case 'no':
      return t('noLabel');
    case 'in_progress':
      return t('inProgressLabel');
    case 'unknown':
      return t('uncertainLabel');
    default:
      return t('notProvidedLabel');
  }
}

function ComplianceOption({ c, label, onPress, selected }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minWidth: '47%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.sm,
        paddingHorizontal: SPACE.md,
        paddingVertical: 12,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primaryBg : c.card,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: RADIUS.full,
          borderWidth: 1.5,
          borderColor: selected ? c.primary : c.muted,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? c.primaryBg : 'transparent',
        }}
      >
        {selected ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: RADIUS.full,
              backgroundColor: c.primary,
            }}
          />
        ) : null}
      </View>
      <Text style={{ ...TYPE.meta, color: c.text, fontWeight: selected ? '700' : '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ComplianceQuestion({ c, label, onChange, options, t, value }) {
  return (
    <View
      style={{
        gap: SPACE.sm,
        padding: SPACE.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
      }}
    >
      <Text style={{ ...TYPE.heading, color: c.text, fontSize: 15 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
        {options.map((option) => (
          <ComplianceOption
            key={option}
            c={c}
            label={getComplianceStatusLabel(option, t)}
            onPress={() => onChange(option)}
            selected={value === option}
          />
        ))}
      </View>
    </View>
  );
}

export function ComplianceStatusStep(props) {
  const {
    c,
    healthAuthorityStatus,
    onChangeHealthAuthorityStatus,
    onChangeTaxRegistrationStatus,
    t,
    taxRegistrationStatus,
  } = props;

  return (
    <View style={{ gap: SPACE.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm }}>
        <Text style={{ ...TYPE.lg, color: c.text, fontSize: 17 }}>
          {t('complianceSectionTitle')}
        </Text>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: RADIUS.full,
            backgroundColor: c.mutedBg,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text style={{ ...TYPE.meta, color: c.muted, fontSize: 12 }}>
            {t('optionalBadge')}
          </Text>
        </View>
      </View>

      <Text style={{ ...TYPE.body, color: c.muted, fontSize: 14 }}>
        {t('complianceSectionBody')}
      </Text>

      <ComplianceQuestion
        c={c}
        label={t('taxRegistrationQuestion')}
        onChange={onChangeTaxRegistrationStatus}
        options={TAX_OPTIONS}
        t={t}
        value={taxRegistrationStatus}
      />

      <ComplianceQuestion
        c={c}
        label={t('healthAuthorityQuestion')}
        onChange={onChangeHealthAuthorityStatus}
        options={HEALTH_OPTIONS}
        t={t}
        value={healthAuthorityStatus}
      />

      <View
        style={{
          padding: SPACE.md,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.mutedBg,
        }}
      >
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
          {t('complianceDisclaimer')}
        </Text>
      </View>
    </View>
  );
}
