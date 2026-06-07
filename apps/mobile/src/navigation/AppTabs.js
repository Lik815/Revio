import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROOT_ROUTES, TAB_ROUTES } from './route-names';
import { DiscoverTabScreen } from '../screens/discover/DiscoverScreen';
import { TherapyTabScreen } from '../screens/therapy/TherapyScreen';
import { FavoritesTabScreen } from '../screens/favorites/FavoritesScreen';
import { ProfileTabScreen } from '../screens/profile/ProfileScreen';
import { OptionsTabScreen } from '../screens/options/OptionsScreen';
import { TherapistProfileScreen } from '../screens/public/TherapistProfileScreen';
import { PracticeProfileScreen } from '../screens/public/PracticeProfileScreen';
import { translations } from '../i18n/translations';
import { CustomTabBar } from './CustomTabBar';
import { TAB_TRANSLATION_KEYS } from './tab-config';

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

// Wraps a tab's home screen together with the public profile screens it can
// open, so those screens stay nested inside the tab navigator and the
// CustomTabBar remains visible (instead of covering the whole screen as a
// root-level stack push would).
function withProfileScreens(HomeComponent, homeName) {
  return function TabStackScreen() {
    return (
      <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
        <ProfileStack.Screen component={HomeComponent} name={homeName} />
        <ProfileStack.Screen component={TherapistProfileScreen} name={ROOT_ROUTES.THERAPIST_PROFILE} />
        <ProfileStack.Screen component={PracticeProfileScreen} name={ROOT_ROUTES.PRACTICE_PROFILE} />
      </ProfileStack.Navigator>
    );
  };
}

const DiscoverStack = withProfileScreens(DiscoverTabScreen, 'DiscoverHome');
const FavoritesStack = withProfileScreens(FavoritesTabScreen, 'FavoritesHome');
const TherapyStack = withProfileScreens(TherapyTabScreen, 'TherapyHome');
const ProfileStackScreen = withProfileScreens(ProfileTabScreen, 'ProfileHome');

export function AppTabs() {
  const t = translations.de;

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        component={DiscoverStack}
        name={TAB_ROUTES.DISCOVER}
        options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.DISCOVER]] }}
      />
      <Tab.Screen
        component={FavoritesStack}
        name={TAB_ROUTES.FAVORITES}
        options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.FAVORITES]] }}
      />
      <Tab.Screen
        component={TherapyStack}
        name={TAB_ROUTES.THERAPY}
        options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.THERAPY]] }}
      />
      <Tab.Screen
        component={ProfileStackScreen}
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
