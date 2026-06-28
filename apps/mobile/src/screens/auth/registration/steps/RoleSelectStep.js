import React from 'react';
import { View } from 'react-native';
import { AuthHero } from '../../../../components/auth/AuthHero';
import { AuthOptionCard } from '../../../../components/auth/AuthOptionCard';
import { AuthScreenShell } from '../../../../components/auth/AuthScreenShell';

// Step 1 — choose patient vs provider. The provider sub-type (freelancer,
// practice, works-in-practice) is picked next in ProviderTypeStep. The role is
// kept locally in RegistrationFlow until an account is actually created.
export function RoleSelectStep({ onSelectRole, onBack, c, t }) {
  return (
    <AuthScreenShell c={c} t={t} onBack={onBack} scroll={false}>
      <AuthHero title={t('registerRoleTitle')} subtitle={t('registerRoleBody')} c={c} />

      <View style={{ gap: 12 }}>
        <AuthOptionCard
          icon="heart-outline"
          title={t('registerRolePatient')}
          body={t('registerRolePatientSub')}
          variant="filled"
          scale="lg"
          onPress={() => onSelectRole('patient')}
          c={c}
        />
        <AuthOptionCard
          icon="medkit-outline"
          title={t('registerRoleProvider')}
          body={t('registerRoleProviderSub')}
          scale="lg"
          onPress={() => onSelectRole('provider')}
          c={c}
        />
      </View>
    </AuthScreenShell>
  );
}
