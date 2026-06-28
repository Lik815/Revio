import React from 'react';
import { View } from 'react-native';
import { AuthHero } from '../../../../components/auth/AuthHero';
import { AuthOptionCard } from '../../../../components/auth/AuthOptionCard';
import { AuthScreenShell } from '../../../../components/auth/AuthScreenShell';

// Step 2 (provider only) — choose the provider sub-type. No "in preparation"
// option. Maps to:
//   freelance   -> therapist track (isFreelancer), no employment step
//   practice     -> practice_admin track (create a practice profile)
//   in_practice -> therapist track + link to an existing practice
export function ProviderTypeStep({ onSelectType, onBack, c, t }) {
  return (
    <AuthScreenShell c={c} t={t} onBack={onBack} scroll={false}>
      <AuthHero title={t('providerTypeTitle')} subtitle={t('providerTypeBody')} c={c} />

      <View style={{ gap: 12 }}>
        <AuthOptionCard
          icon="person-outline"
          title={t('providerTypeFreelance')}
          body={t('providerTypeFreelanceSub')}
          scale="md"
          onPress={() => onSelectType('freelance')}
          c={c}
        />
        <AuthOptionCard
          icon="business-outline"
          title={t('providerTypePractice')}
          body={t('providerTypePracticeSub')}
          scale="md"
          onPress={() => onSelectType('practice')}
          c={c}
        />
        <AuthOptionCard
          icon="people-outline"
          title={t('providerTypeInPractice')}
          body={t('providerTypeInPracticeSub')}
          scale="md"
          onPress={() => onSelectType('in_practice')}
          c={c}
        />
      </View>
    </AuthScreenShell>
  );
}
