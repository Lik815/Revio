import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TAB_ROUTES } from './route-names';
import { DiscoverTabScreen } from '../screens/discover/DiscoverScreen';
import { TherapyTabScreen } from '../screens/therapy/TherapyScreen';
import { FavoritesTabScreen } from '../screens/favorites/FavoritesScreen';
import { ProfileTabScreen } from '../screens/profile/ProfileScreen';
import { OptionsTabScreen } from '../screens/options/OptionsScreen';
import { translations } from '../i18n/translations';
import { CustomTabBar } from './CustomTabBar';
import { TAB_TRANSLATION_KEYS } from './tab-config';

const Tab = createBottomTabNavigator();

export function AppTabs() {
  const t = translations.de;

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
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
