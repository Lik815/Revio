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
import { PatientPhoneModal } from '../../modals/PatientPhoneModal';
import { PatientKassenartModal } from '../../modals/PatientKassenartModal';
import { AuthDebugScreen } from '../AuthDebugScreen';
import { useAuth } from '../../context/AuthContext';
import { WorkingHoursScreen } from '../therapy/WorkingHoursScreen';
import { TherapistServicesScreen } from '../therapy/TherapistServicesScreen';
import { BlockedTimesScreen } from '../therapy/BlockedTimesScreen';
import { AbsenceScreen } from './AbsenceScreen';
import { TherapistCoursesScreen } from '../courses/TherapistCoursesScreen';

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
  const updatePatientProfile = useAppStore((s) => s.updatePatientProfile);

  const { themeMode, setThemeMode, c } = useTheme();

  const { logout: logoutFromContext, authToken: ctxAuthToken, accountType: ctxAccountType, bootReady, loggedInPatient: ctxPatient, loggedInTherapist: ctxTherapist } = useAuth();

  const [showFeedback, setShowFeedback] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [showKassenartEdit, setShowKassenartEdit] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showWorkingHours, setShowWorkingHours] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [showBlockedTimes, setShowBlockedTimes] = useState(false);
  const [showAbsences, setShowAbsences] = useState(false);
  const [showMyCourses, setShowMyCourses] = useState(false);

  const handleLogout = async () => {
    await logoutFromContext();
    signOut();
    showLoginTab(navigation);
  };

  if (showWorkingHours) {
    return <WorkingHoursScreen c={c} authToken={authToken} onBack={() => setShowWorkingHours(false)} />;
  }
  if (showServices) {
    return <TherapistServicesScreen c={c} authToken={authToken} onBack={() => setShowServices(false)} />;
  }
  if (showBlockedTimes) {
    return <BlockedTimesScreen c={c} authToken={authToken} onBack={() => setShowBlockedTimes(false)} />;
  }
  if (showAbsences) {
    return <AbsenceScreen c={c} authToken={authToken} onBack={() => setShowAbsences(false)} />;
  }
  if (showMyCourses) {
    return <TherapistCoursesScreen c={c} authToken={authToken} onBack={() => setShowMyCourses(false)} />;
  }

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
        onShowPhoneEdit={() => setShowPhoneEdit(true)}
        onLogout={handleLogout}
        onShowDebug={() => setShowDebug(true)}
        onShowWorkingHours={() => setShowWorkingHours(true)}
        onShowServices={() => setShowServices(true)}
        onShowBlockedTimes={() => setShowBlockedTimes(true)}
        onShowAbsences={() => setShowAbsences(true)}
        onShowMyCourses={() => setShowMyCourses(true)}
        onShowKassenartEdit={() => setShowKassenartEdit(true)}
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

      <PatientPhoneModal
        visible={showPhoneEdit}
        onClose={() => setShowPhoneEdit(false)}
        authToken={authToken}
        currentPhone={loggedInPatient?.phone ?? ''}
        onSaved={(phone) => { updatePatientProfile({ phone }); setShowPhoneEdit(false); }}
        c={c}
      />

      <PatientKassenartModal
        visible={showKassenartEdit}
        onClose={() => setShowKassenartEdit(false)}
        authToken={authToken}
        currentKassenart={loggedInPatient?.kassenart ?? null}
        onSaved={(kassenart) => { updatePatientProfile({ kassenart }); setShowKassenartEdit(false); }}
        c={c}
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
