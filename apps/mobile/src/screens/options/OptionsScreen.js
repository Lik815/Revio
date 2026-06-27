import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { OptionsContent } from './OptionsContent';
import { FeedbackModal } from '../../modals/FeedbackModal';
import { ChangePasswordModal } from '../../modals/ChangePasswordModal';
import { AuthDebugScreen } from '../AuthDebugScreen';
import { useAuth } from '../../context/AuthContext';

const t = (key) => translations.de[key] ?? key;

function showLoginTab(navigation) {
  navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.AUTH });
}

export function OptionsTabScreen() {
  const navigation = useNavigation();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const loggedInPatient = useAppStore(appStoreSelectors.loggedInPatient);
  const loggedInTherapist = useAppStore(appStoreSelectors.loggedInTherapist);
  const signOut = useAppStore((s) => s.signOut);

  const { themeMode, setThemeMode, c } = useTheme();

  const { logout: logoutFromContext, authToken: ctxAuthToken, accountType: ctxAccountType, bootReady, loggedInPatient: ctxPatient, loggedInTherapist: ctxTherapist } = useAuth();

  const [showFeedback, setShowFeedback] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const handleLogout = async () => {
    await logoutFromContext();
    signOut();
    showLoginTab(navigation);
  };

  return (
    <>
      <OptionsContent
        loggedInTherapist={loggedInTherapist}
        loggedInPatient={loggedInPatient}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        onShowLogin={() => showLoginTab(navigation)}
        onShowRegister={() => navigation.navigate(ROOT_ROUTES.REGISTRATION)}
        onShowFeedback={() => setShowFeedback(true)}
        onShowChangePassword={() => setShowChangePassword(true)}
        onLogout={handleLogout}
        onShowDebug={() => setShowDebug(true)}
        c={c}
        t={t}
        styles={appStyles}
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

      <AuthDebugScreen
        visible={showDebug}
        onClose={() => setShowDebug(false)}
        authContext={{ authToken: ctxAuthToken, accountType: ctxAccountType, bootReady, loggedInPatient: ctxPatient, loggedInTherapist: ctxTherapist }}
        c={c}
      />
    </>
  );
}
