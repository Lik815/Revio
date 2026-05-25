import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { AppTabs } from './AppTabs';
import { ROOT_ROUTES } from './route-names';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { TherapistProfileScreen } from '../screens/public/TherapistProfileScreen';
import { PracticeProfileScreen } from '../screens/public/PracticeProfileScreen';
import { COLORS } from '../mobile-utils';
import { appStoreSelectors, useAppStore } from '../store/useStore';

const Stack = createNativeStackNavigator();

function buildNavigationTheme(palette, mode) {
  const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: palette.background,
      card: palette.card,
      border: palette.border,
      primary: palette.primary,
      text: palette.text,
      notification: palette.accent,
    },
  };
}

export function RootNavigator() {
  const systemScheme = useColorScheme();
  const themePreference = useAppStore(appStoreSelectors.themePreference);
  const isAuthenticated = useAppStore(appStoreSelectors.isAuthenticated);
  const mode = themePreference === 'system' ? systemScheme : themePreference;
  const palette = COLORS[mode === 'dark' ? 'dark' : 'light'];
  const navigationTheme = React.useMemo(
    () => buildNavigationTheme(palette, mode === 'dark' ? 'dark' : 'light'),
    [mode, palette],
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen component={AppTabs} name={ROOT_ROUTES.MAIN_TABS} />
            <Stack.Screen component={TherapistProfileScreen} name={ROOT_ROUTES.THERAPIST_PROFILE} />
            <Stack.Screen component={PracticeProfileScreen} name={ROOT_ROUTES.PRACTICE_PROFILE} />
          </>
        ) : (
          <Stack.Screen component={AuthScreen} name={ROOT_ROUTES.AUTH} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
