import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useNotificationPolling } from '../../hooks/use-notification-polling';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../mobile-translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { OptionsScreen } from '../../mobile-options-screen';
import { FeedbackModal } from '../../mobile-feedback-modal';
import { ChangePasswordModal } from '../../mobile-change-password-modal';
import { DeleteAccountModal } from '../../mobile-delete-account-modal';
import { NotificationSheet } from '../../modals/NotificationSheet';

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

  const [showFeedback, setShowFeedback] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const handleLogout = () => {
    signOut();
    navigation.navigate(ROOT_ROUTES.AUTH);
  };

  const handleDeleteAccountConfirmed = async () => {
    signOut();
    navigation.navigate(ROOT_ROUTES.AUTH);
  };

  const handleNavigateToProfile = () => {
    navigation.navigate(TAB_ROUTES.PROFILE);
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
        onShowLogin={() => navigation.navigate(ROOT_ROUTES.AUTH)}
        onShowRegister={() => navigation.navigate(ROOT_ROUTES.AUTH)}
        onShowFeedback={() => setShowFeedback(true)}
        onShowChangePassword={() => setShowChangePassword(true)}
        onDeleteAccount={() => setShowDeleteAccount(true)}
        onLogout={handleLogout}
        onNavigateToProfile={handleNavigateToProfile}
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
        onPressNotification={() => setShowNotifications(false)}
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
    </>
  );
}
