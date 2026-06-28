import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AuthHero } from '../../../../components/auth/AuthHero';
import { AuthOptionCard } from '../../../../components/auth/AuthOptionCard';
import { AuthPrimaryButton } from '../../../../components/auth/AuthPrimaryButton';
import { AuthScreenShell } from '../../../../components/auth/AuthScreenShell';

// Step 5 (therapist only) — professional situation. SELF_EMPLOYED/PREPARING
// continue the therapist track; "not self-employed" triggers an explicit
// confirmation that an account is created as a patient instead.
export function EmploymentStep({
  showPivotConfirm,
  onSelectEmployment,
  onRequestPivot, onConfirmPivot, onCancelPivot,
  loading,
  onBack,
  c, t, styles,
}) {
  if (showPivotConfirm) {
    return (
      <AuthScreenShell c={c} t={t}>
        <AuthHero title={t('regPivotTitle')} subtitle={t('regPivotBody')} c={c} />

        <AuthPrimaryButton label={loading ? '…' : t('regPivotConfirm')} onPress={onConfirmPivot} disabled={loading} c={c} styles={styles} />
        <Pressable style={{ marginTop: 16, alignItems: 'center', paddingVertical: 10 }} onPress={onCancelPivot} disabled={loading}>
          <Text style={{ fontSize: 14, color: c.muted }}>{t('regPivotCancel')}</Text>
        </Pressable>
      </AuthScreenShell>
    );
  }

  return (
    <AuthScreenShell c={c} t={t} onBack={onBack}>
      <AuthHero title={t('regEmploymentTitle')} subtitle={t('regEmploymentBody')} c={c} />

      <View style={{ gap: 12 }}>
        <AuthOptionCard
          icon="briefcase-outline"
          title={t('regEmploymentSelfEmployed')}
          body={t('regEmploymentSelfEmployedSub')}
          onPress={() => onSelectEmployment('SELF_EMPLOYED')}
          scale="md"
          c={c}
        />
        <AuthOptionCard
          icon="hourglass-outline"
          title={t('regEmploymentPreparing')}
          body={t('regEmploymentPreparingSub')}
          onPress={() => onSelectEmployment('PREPARING')}
          scale="md"
          c={c}
        />
        <AuthOptionCard
          icon="business-outline"
          title={t('regEmploymentNotSelfEmployed')}
          body={t('regEmploymentNotSelfEmployedSub')}
          onPress={onRequestPivot}
          scale="md"
          c={c}
        />
      </View>
    </AuthScreenShell>
  );
}
