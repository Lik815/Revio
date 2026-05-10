import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TAB_ROUTES } from './route-names';
import { DiscoverTabScreen } from '../screens/discover/DiscoverScreen';
import { TherapyTabScreen } from '../screens/therapy/TherapyScreen';
import { ProfileTabScreen } from '../screens/profile/ProfileScreen';
import { OptionsTabScreen } from '../screens/options/OptionsScreen';
import { COLORS } from '../mobile-utils';
import { translations } from '../mobile-translations';
import { appStoreSelectors, useAppStore } from '../store/useStore';
import { useColorScheme } from 'react-native';

const Tab = createBottomTabNavigator();

const TAB_ICON_BY_ROUTE = {
  [TAB_ROUTES.DISCOVER]: 'search',
  [TAB_ROUTES.THERAPY]: 'heart',
  [TAB_ROUTES.PROFILE]: 'person',
  [TAB_ROUTES.OPTIONS]: 'settings',
};

const TAB_TRANSLATION_KEYS = {
  [TAB_ROUTES.DISCOVER]: 'tabSearch',
  [TAB_ROUTES.THERAPY]: 'tabTherapy',
  [TAB_ROUTES.PROFILE]: 'tabTherapist',
  [TAB_ROUTES.OPTIONS]: 'tabOptions',
};

function usePalette() {
  const systemScheme = useColorScheme();
  const themePreference = useAppStore(appStoreSelectors.themePreference);
  const mode = themePreference === 'system' ? systemScheme : themePreference;
  return COLORS[mode === 'dark' ? 'dark' : 'light'];
}

function useTranslations() {
  const locale = useAppStore(appStoreSelectors.locale);
  return translations[locale] ?? translations.de;
}

export function AppTabs() {
  const palette = usePalette();
  const t = useTranslations();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted ?? palette.muted,
        tabBarStyle: {
          backgroundColor: palette.nav,
          borderTopColor: palette.border,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const baseIcon = TAB_ICON_BY_ROUTE[route.name] ?? 'ellipse';
          const iconName = focused ? baseIcon : `${baseIcon}-outline`;
          return <Ionicons color={color} name={iconName} size={size} />;
        },
      })}
    >
      <Tab.Screen
        component={DiscoverTabScreen}
        name={TAB_ROUTES.DISCOVER}
        options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.DISCOVER]] }}
      />
      <Tab.Screen
        component={TherapyTabScreen}
        name={TAB_ROUTES.THERAPY}
        options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.THERAPY]] }}
      />
      <Tab.Screen
        component={ProfileTabScreen}
        name={TAB_ROUTES.PROFILE}
        options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.PROFILE]] }}
      />
      <Tab.Screen
        component={OptionsTabScreen}
        name={TAB_ROUTES.OPTIONS}
        options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.OPTIONS]] }}
      />
    </Tab.Navigator>
  );
}
