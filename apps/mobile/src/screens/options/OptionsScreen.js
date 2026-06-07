import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useNotificationPolling } from '../../hooks/use-notification-polling';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { OptionsScreen } from '../../_archive/screens/mobile-options-screen';
import { FeedbackModal } from '../../_archive/screens/mobile-feedback-modal';
import { ChangePasswordModal } from '../../_archive/screens/mobile-change-password-modal';
import { DeleteAccountModal } from '../../_archive/screens/mobile-delete-account-modal';
import { NotificationSheet } from '../../modals/NotificationSheet';
import { AuthDebugScreen } from '../AuthDebugScreen';
import { useAuth } from '../../context/AuthContext';

const t = (key) => translations.de[key] ?? key;

export function OptionsTabScreen() {
  const navigation = useNavigation();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);
  const loggedInPatient = useAppStore(appStoreSelectors.loggedInPatient);
  const loggedInTherapist = useAppStore(appStoreSelectors.loggedInTherapist);
  const signOut = useAppStore((s) => s.signOut);

  const { themeMode, setThemeMode, c } = useTheme();

  const {
    notifications,
    dismissedNotifIds,
    showNotifications,
    setShowNotifications,
    dismissNotification,
    dismissAllNotifications,
  } = useNotificationPolling({ authToken, accountType });

  const { logout: logoutFromContext, authToken: ctxAuthToken, accountType: ctxAccountType, bootReady, loggedInPatient: ctxPatient, loggedInTherapist: ctxTherapist } = useAuth();

  const [showFeedback, setShowFeedback] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const handleLogout = async () => {
    await logoutFromContext();
    signOut();
    navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.PROFILE });
  };

  const handleDeleteAccountConfirmed = async () => {
    await logoutFromContext();
    signOut();
    navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.PROFILE });
  };

  const handleNavigateToProfile = () => {
    navigation.navigate(TAB_ROUTES.PROFILE);
  };

  const handleNotificationPress = (notification) => {
    setShowNotifications(false);
    const type = notification?.type;
    if (
      type === 'NEW_BOOKING_REQUEST' || type === 'BOOKING_CONFIRMED' ||
      type === 'BOOKING_DECLINED' || type === 'BOOKING_CANCELLED'
    ) {
      navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.THERAPY });
    } else if (
      type === 'PROFILE_APPROVED' || type === 'PROFILE_CHANGES_REQUESTED' ||
      type === 'PROFILE_REJECTED' || type === 'PROFILE_SUSPENDED'
    ) {
      navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.PROFILE });
    }
  };

  return (
    <>
      <OptionsScreen
        loggedInTherapist={loggedInTherapist}
        loggedInPatient={loggedInPatient}
        accountType={accountType}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        notifications={notifications}
        dismissedNotifIds={dismissedNotifIds}
        onShowNotifications={() => setShowNotifications(true)}
        onShowLogin={() => navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.PROFILE })}
        onShowRegister={() => navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.PROFILE })}
        onShowFeedback={() => setShowFeedback(true)}
        onShowChangePassword={() => setShowChangePassword(true)}
        onDeleteAccount={() => setShowDeleteAccount(true)}
        onLogout={handleLogout}
        onNavigateToProfile={handleNavigateToProfile}
        onShowDebug={() => setShowDebug(true)}
        c={c}
        t={t}
        styles={appStyles}
      />

      <NotificationSheet
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        dismissedNotifIds={dismissedNotifIds}
        dismissNotification={dismissNotification}
        dismissAllNotifications={dismissAllNotifications}
        onPressNotification={handleNotificationPress}
        c={c}
        t={t}
      />

      <FeedbackModal
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
        authToken={authToken}
        authenticatedEmail={loggedInPatient?.email ?? loggedInTherapist?.email ?? ''}
        c={c}
        t={t}
      />

      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        authToken={authToken}
        c={c}
        t={t}
      />

      <DeleteAccountModal
        visible={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        onConfirmed={handleDeleteAccountConfirmed}
        loggedInTherapist={loggedInTherapist}
        loggedInPatient={loggedInPatient}
        c={c}
        t={t}
      />

      <AuthDebugScreen
        visible={showDebug}
        onClose={() => setShowDebug(false)}
        authContext={{ authToken: ctxAuthToken, accountType: ctxAccountType, bootReady, loggedInPatient: ctxPatient, loggedInTherapist: ctxTherapist }}
        c={c}
      />
    </>
  );
}
