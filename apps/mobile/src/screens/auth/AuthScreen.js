import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../hooks/use-theme';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { LoginScreen } from './LoginScreen';
import { TherapistLandingScreen } from './TherapistLandingScreen';
import { RegistrationFlow } from './registration/RegistrationFlow';

const t = (key) => translations.de[key] ?? key;

export function AuthScreen() {
  const { c } = useTheme();

  const [view, setView] = useState('landing');

  return (
    <View style={{ flex: 1 }}>
      {view === 'login' ? (
        <LoginScreen
          c={c}
          styles={appStyles}
          t={t}
          onClose={() => setView('landing')}
        />
      ) : view === 'register' ? (
        <RegistrationFlow
          onClose={() => setView('landing')}
          onShowLogin={() => setView('login')}
          onComplete={() => setView('landing')}
          c={c}
          t={t}
          styles={appStyles}
        />
      ) : (
        <TherapistLandingScreen
          c={c}
          setShowLogin={() => setView('login')}
          setShowSignup={() => setView('register')}
          styles={appStyles}
          t={t}
        />
      )}
    </View>
  );
}
