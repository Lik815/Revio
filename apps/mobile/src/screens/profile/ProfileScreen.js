import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../hooks/use-toast';
import { useFavorites } from '../../hooks/use-favorites';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { getBaseUrl, TUNNEL_HEADERS } from '../../utils/app-utils';
import { useConfigOptions } from '../../hooks/use-config-options';
import { TabHeader } from '../../components/TabHeader';
import { ToastOverlay } from '../../components/ToastOverlay';
import { ProfileSavedModal } from '../../modals/ProfileSavedModal';
import { ReviewNotificationModal } from '../../modals/ReviewNotificationModal';
import { PhotoPromptModal } from '../../modals/PhotoPromptModal';
import { TherapistDashboardScreen } from './TherapistDashboard';
import { PatientDashboardScreen } from './PatientDashboard';
import { useTherapyData } from '../../context/TherapyContext';
import { TherapistLandingScreen } from '../auth/TherapistLandingScreen';

const t = (key) => translations.de[key] ?? key;

export function ProfileTabScreen() {
  const navigation = useNavigation();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);
  const loggedInPatient = useAppStore(appStoreSelectors.loggedInPatient);
  const loggedInTherapist = useAppStore(appStoreSelectors.loggedInTherapist);
  const updatePatientProfile = useAppStore((s) => s.updatePatientProfile);

  const { c } = useTheme();
  const { certificationOptions, specializationOptions, heilmittelOptions } = useConfigOptions();
  const { toastMsg, toastAnim, showToast } = useToast();

  const { myAppointments } = useTherapyData();
  const { favorites } = useFavorites({ authToken });

  const {
    showReviewNotificationModal, reviewNotification, markReviewNotificationSeen,
  } = useNotifications();

  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);

  useEffect(() => {
    if (!loggedInTherapist || loggedInTherapist.photo) return;
    AsyncStorage.getItem('revio_photo_prompt_dismissed').then((v) => {
      if (!v) setTimeout(() => setShowPhotoPrompt(true), 2800);
    });
  }, [loggedInTherapist?.id]);

  const handlePhotoPromptDismiss = async () => {
    setShowPhotoPrompt(false);
    await AsyncStorage.setItem('revio_photo_prompt_dismissed', '1');
  };

  const handlePhotoPromptGoToProfile = async () => {
    setShowPhotoPrompt(false);
    await AsyncStorage.setItem('revio_photo_prompt_dismissed', '1');
  };

  const [profileSavedTitle, setProfileSavedTitle] = useState('');
  const [profileSavedBody, setProfileSavedBody] = useState('');
  const [showProfileSaved, setShowProfileSaved] = useState(false);

  const handlePatientProfileSaved = ({ firstName, lastName, phone }) => {
    updatePatientProfile({ firstName, lastName, phone });
    setProfileSavedTitle(t('profileSavedModalTitle') ?? 'Profil gespeichert');
    setProfileSavedBody(t('profileSavedModalBody') ?? 'Deine Änderungen wurden erfolgreich gespeichert.');
    setShowProfileSaved(true);
  };

  const handleAddSlot = async (slot) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ slots: [slot] }),
      });
      if (res.ok) showToast(t('slotCreated') ?? 'Termin erstellt');
    } catch {}
  };

  const openProfileSavedModal = (title, body) => {
    setProfileSavedTitle(title);
    setProfileSavedBody(body);
    setShowProfileSaved(true);
  };

  if (loggedInPatient) {
    return (
      <>
        <View style={{ flex: 1 }}>
          <TabHeader c={c} title="Mein Profil" />
          <PatientDashboardScreen
            c={c} t={t} styles={appStyles}
            loggedInPatient={loggedInPatient}
            authToken={authToken}
            favorites={favorites}
            myAppointments={myAppointments}
            onOpenTherapist={(id, th) => navigation.navigate(ROOT_ROUTES.THERAPIST_PROFILE, { therapistId: id, therapist: th })}
            onProfileSaved={handlePatientProfileSaved}
          />
        </View>
        <ProfileSavedModal
          visible={showProfileSaved}
          onClose={() => setShowProfileSaved(false)}
          title={profileSavedTitle}
          body={profileSavedBody}
          c={c} t={t}
        />
        <ReviewNotificationModal
          visible={showReviewNotificationModal}
          notification={reviewNotification}
          onDone={markReviewNotificationSeen}
          c={c} t={t}
        />
        <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
      </>
    );
  }

  if (loggedInTherapist) {
    return (
      <>
        <View style={{ flex: 1 }}>
          <TabHeader c={c} title="Mein Profil" />
          <TherapistDashboardScreen
            c={c} t={t} styles={appStyles}
            certificationOptions={certificationOptions}
            specializationOptions={specializationOptions}
            heilmittelOptions={heilmittelOptions}
            onOpenTherapyTab={() => navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.THERAPY })}
            onAddSlot={handleAddSlot}
            onProfileSaved={openProfileSavedModal}
          />
        </View>
        <ProfileSavedModal
          visible={showProfileSaved}
          onClose={() => setShowProfileSaved(false)}
          title={profileSavedTitle}
          body={profileSavedBody}
          c={c} t={t}
        />
        <ReviewNotificationModal
          visible={showReviewNotificationModal}
          notification={reviewNotification}
          onDone={markReviewNotificationSeen}
          c={c} t={t}
        />
        <PhotoPromptModal
          visible={showPhotoPrompt}
          onGoToProfile={handlePhotoPromptGoToProfile}
          onDismiss={handlePhotoPromptDismiss}
          c={c} t={t}
        />
        <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
      </>
    );
  }

  return (
    <TherapistLandingScreen
      c={c}
      t={t}
      styles={appStyles}
      onLogin={() => navigation.navigate(ROOT_ROUTES.LOGIN)}
      onSignup={() => navigation.navigate(ROOT_ROUTES.REGISTRATION)}
    />
  );
}
