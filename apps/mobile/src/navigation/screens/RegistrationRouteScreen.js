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
    navigation.reset({ index: 0, routes: [{ name: ROOT_ROUTES.MAIN_TABS }] });
    if (landing === 'discover') {
      navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.DISCOVER });
      return;
    }
    navigation.navigate(ROOT_ROUTES.MAIN_TABS, {
      screen: TAB_ROUTES.OPTIONS,
      params: { screen: ROOT_ROUTES.PROFILE },
    });
  };

  return (
    <RegistrationFlow
      c={c}
      t={t}
      styles={appStyles}
      onClose={() => navigation.goBack()}
      onShowLogin={() => navigation.reset({
        index: 0,
        routes: [{ name: ROOT_ROUTES.MAIN_TABS, params: { screen: TAB_ROUTES.AUTH } }],
      })}
      onComplete={handleComplete}
    />
  );
}
