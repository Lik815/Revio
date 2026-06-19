import React from 'react';
import { View } from 'react-native';
import { AuthHero } from '../../../../components/auth/AuthHero';
import { AuthOptionCard } from '../../../../components/auth/AuthOptionCard';
import { AuthScreenShell } from '../../../../components/auth/AuthScreenShell';

// Step 1 — choose patient vs therapist. The role is kept locally in
// RegistrationFlow until an account is actually created.
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
          icon="person-outline"
          title={t('registerRoleTherapist')}
          body={t('registerRoleTherapistSub')}
          scale="lg"
          onPress={() => onSelectRole('therapist')}
          c={c}
        />
      </View>
    </AuthScreenShell>
  );
}
