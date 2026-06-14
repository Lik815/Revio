import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/use-theme';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { RegistrationFlow } from '../../screens/auth/registration/RegistrationFlow';
import { ROOT_ROUTES, TAB_ROUTES } from '../route-names';

const t = (key) => translations.de[key] ?? key;

// Root-stack wrapper for the registration flow. Because it sits above MainTabs,
// the bottom tab bar is hidden while registering. On completion it resets back
// to the tabs and lands on the appropriate tab.
export function RegistrationRouteScreen() {
  const navigation = useNavigation();
  const { c } = useTheme();

  const handleComplete = ({ landing } = {}) => {
    const tab = landing === 'discover' ? TAB_ROUTES.DISCOVER : TAB_ROUTES.PROFILE;
    navigation.reset({ index: 0, routes: [{ name: ROOT_ROUTES.MAIN_TABS }] });
    navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: tab });
  };

  return (
    <RegistrationFlow
      c={c}
      t={t}
      styles={appStyles}
      onClose={() => navigation.goBack()}
      onShowLogin={() => navigation.replace(ROOT_ROUTES.LOGIN)}
      onComplete={handleComplete}
    />
  );
}
