import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/use-theme';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { LoginScreen } from '../../screens/auth/LoginScreen';

const t = (key) => translations.de[key] ?? key;

// Root-stack wrapper for login. LoginScreen calls onClose() both on cancel and
// after a successful login; goBack() returns to MainTabs, where ProfileScreen
// now renders the dashboard for the logged-in user.
export function LoginRouteScreen() {
  const navigation = useNavigation();
  const { c } = useTheme();

  return (
    <LoginScreen
      c={c}
      t={t}
      styles={appStyles}
      onClose={() => navigation.goBack()}
    />
  );
}
