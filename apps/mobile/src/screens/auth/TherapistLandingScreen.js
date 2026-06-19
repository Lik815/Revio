import React from 'react';
import { View } from 'react-native';
import { AuthHero } from '../../components/auth/AuthHero';
import { AuthInlineLink } from '../../components/auth/AuthInlineLink';
import { AuthOptionCard } from '../../components/auth/AuthOptionCard';
import { AuthPrimaryButton } from '../../components/auth/AuthPrimaryButton';
import { AuthScreenShell } from '../../components/auth/AuthScreenShell';

// Logged-out fallback rendered directly inside the profile tab (no header,
// no BackButton — this is tab content, not a stack screen).
export function TherapistLandingScreen({ c, t, styles, onLogin, onSignup }) {
  const features = [
    { icon: 'search-outline', title: t('landingFeature1Title'), body: t('landingFeature1Body') },
    { icon: 'shield-checkmark-outline', title: t('landingFeature3Title'), body: t('landingFeature3Body') },
    { icon: 'person-outline', title: t('landingFeature2Title'), body: t('landingFeature2Body') },
  ];

  return (
    <AuthScreenShell c={c} t={t} scroll={false} centered style={{ paddingBottom: 16 }}>
      <AuthHero align="center" title={t('landingTitle')} subtitle={t('landingSub')} c={c} />

      <View style={{ gap: 10, marginBottom: 28 }}>
        {features.map((item) => (
          <AuthOptionCard key={item.title} {...item} scale="sm" showChevron c={c} />
        ))}
      </View>

      <AuthPrimaryButton label={t('registerBtn')} icon="arrow-forward" onPress={onSignup} c={c} styles={styles} />

      <AuthInlineLink
        lead={t('alreadyHaveAccount')}
        action={t('loginAction')}
        accentAction
        onPress={onLogin}
        c={c}
        style={{ alignSelf: 'center', marginTop: 16 }}
      />
    </AuthScreenShell>
  );
}
