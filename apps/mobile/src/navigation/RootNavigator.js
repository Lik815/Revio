import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppTabs } from './AppTabs';
import { ROOT_ROUTES } from './route-names';
import { TherapistProfileScreen } from '../screens/public/TherapistProfileScreen';
import { PracticeProfileScreen } from '../screens/public/PracticeProfileScreen';
import { useTheme } from '../hooks/use-theme';

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
  const { scheme, c: palette } = useTheme();
  const navigationTheme = React.useMemo(
    () => buildNavigationTheme(palette, scheme),
    [scheme, palette],
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen component={AppTabs} name={ROOT_ROUTES.MAIN_TABS} />
        <Stack.Screen component={TherapistProfileScreen} name={ROOT_ROUTES.THERAPIST_PROFILE} />
        <Stack.Screen component={PracticeProfileScreen} name={ROOT_ROUTES.PRACTICE_PROFILE} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
