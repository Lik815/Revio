import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TAB_ROUTES } from './route-names';
import { DiscoverTabScreen } from '../screens/discover/DiscoverScreen';
import { TherapyTabScreen } from '../screens/therapy/TherapyScreen';
import { FavoritesTabScreen } from '../screens/favorites/FavoritesScreen';
import { ProfileTabScreen } from '../screens/profile/ProfileScreen';
import { OptionsTabScreen } from '../screens/options/OptionsScreen';
import { translations } from '../i18n/translations';
import { useTheme } from '../hooks/use-theme';

const Tab = createBottomTabNavigator();

const TAB_ICON_BY_ROUTE = {
  [TAB_ROUTES.DISCOVER]:   'search',
  [TAB_ROUTES.THERAPY]:    'calendar',
  [TAB_ROUTES.FAVORITES]:  'heart',
  [TAB_ROUTES.PROFILE]:    'person',
  [TAB_ROUTES.OPTIONS]:    'settings',
};

const TAB_TRANSLATION_KEYS = {
  [TAB_ROUTES.DISCOVER]:   'tabSearch',
  [TAB_ROUTES.THERAPY]:    'tabTherapy',
  [TAB_ROUTES.FAVORITES]:  'tabFavorites',
  [TAB_ROUTES.PROFILE]:    'tabProfile',
  [TAB_ROUTES.OPTIONS]:    'tabOptions',
};

export function AppTabs() {
  const { c } = useTheme();
  const t = translations.de;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted ?? c.muted,
        tabBarStyle: {
          backgroundColor: c.nav,
          borderTopColor: c.border,
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
        component={FavoritesTabScreen}
        name={TAB_ROUTES.FAVORITES}
        options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.FAVORITES]] }}
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
