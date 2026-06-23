import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROOT_ROUTES, TAB_ROUTES } from './route-names';
import { DiscoverTabScreen } from '../screens/discover/DiscoverScreen';
import { TherapyTabScreen } from '../screens/therapy/TherapyScreen';
import { FavoritesTabScreen } from '../screens/favorites/FavoritesScreen';
import { NotificationsTabScreen } from '../screens/notifications/NotificationsScreen';
import { OptionsTabScreen } from '../screens/options/OptionsScreen';
import { ProfileTabScreen } from '../screens/profile/ProfileScreen';
import { TherapistProfileScreen } from '../screens/public/TherapistProfileScreen';
import { PracticeProfileScreen } from '../screens/public/PracticeProfileScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { translations } from '../i18n/translations';
import { CustomTabBar } from './CustomTabBar';
import { TAB_TRANSLATION_KEYS } from './tab-config';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/use-theme';
import { appStyles } from '../styles/app-styles';

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
        <ProfileStack.Screen component={ProfileTabScreen} name={ROOT_ROUTES.PROFILE} />
        <ProfileStack.Screen component={TherapistProfileScreen} name={ROOT_ROUTES.THERAPIST_PROFILE} />
        <ProfileStack.Screen component={PracticeProfileScreen} name={ROOT_ROUTES.PRACTICE_PROFILE} />
      </ProfileStack.Navigator>
    );
  };
}

const DiscoverStack = withProfileScreens(DiscoverTabScreen, 'DiscoverHome');
const FavoritesStack = withProfileScreens(FavoritesTabScreen, 'FavoritesHome');
const TherapyStack = withProfileScreens(TherapyTabScreen, 'TherapyHome');
const NotificationsStack = withProfileScreens(NotificationsTabScreen, 'NotificationsHome');
const OptionsStack = withProfileScreens(OptionsTabScreen, 'OptionsHome');

const translate = (key) => translations.de[key] ?? key;

function AuthTabScreen({ navigation }) {
  const { c } = useTheme();

  return (
    <LoginScreen
      c={c}
      t={translate}
      styles={appStyles}
      onClose={() => navigation.navigate(TAB_ROUTES.DISCOVER)}
      showBackButton={false}
    />
  );
}

export function AppTabs() {
  const t = translations.de;
  const { authToken } = useAuth();
  const { notifications, dismissedNotifIds } = useNotifications();
  const isLoggedIn = Boolean(authToken);
  const unreadNotifications = notifications.filter((n) => !dismissedNotifIds.has(n.id)).length;

  return (
    <Tab.Navigator
      key={isLoggedIn ? 'signed-in-tabs' : 'guest-tabs'}
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          badgeCounts={{ [TAB_ROUTES.NOTIFICATIONS]: unreadNotifications }}
        />
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        component={DiscoverStack}
        name={TAB_ROUTES.DISCOVER}
        options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.DISCOVER]] }}
      />
      {isLoggedIn ? (
        <>
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
            component={NotificationsStack}
            name={TAB_ROUTES.NOTIFICATIONS}
            options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.NOTIFICATIONS]] }}
          />
          <Tab.Screen
            component={OptionsStack}
            name={TAB_ROUTES.OPTIONS}
            options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.OPTIONS]] }}
          />
        </>
      ) : (
        <Tab.Screen
          component={AuthTabScreen}
          name={TAB_ROUTES.AUTH}
          options={{ title: t[TAB_TRANSLATION_KEYS[TAB_ROUTES.AUTH]] }}
        />
      )}
    </Tab.Navigator>
  );
}
