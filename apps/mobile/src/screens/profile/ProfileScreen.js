import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useNotificationPolling } from '../../hooks/use-notification-polling';
import { useToast } from '../../hooks/use-toast';
import { useFavorites } from '../../hooks/use-favorites';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { fortbildungOptions, getBaseUrl, TUNNEL_HEADERS } from '../../utils/app-utils';
import { TabHeader } from '../../components/TabHeader';
import { ToastOverlay } from '../../components/ToastOverlay';
import { NotificationSheet } from '../../modals/NotificationSheet';
import { ProfileSavedModal } from '../../modals/ProfileSavedModal';
import { ReviewNotificationModal } from '../../modals/ReviewNotificationModal';
import { PhotoPromptModal } from '../../modals/PhotoPromptModal';
import { TherapistDashboardScreen } from './TherapistDashboard';
import { PatientDashboardScreen } from './PatientDashboard';
import { useTherapyData } from '../../context/TherapyContext';
import { useAuth } from '../../context/AuthContext';
import { AuthScreen } from '../auth/AuthScreen';

const t = (key) => translations.de[key] ?? key;

const CERTIFICATION_OPTIONS = (fortbildungOptions ?? []).map((o) => ({
  key: o.key,
  label: o.label,
  selected: false,
}));

export function ProfileTabScreen() {
  const navigation = useNavigation();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);
  const loggedInPatient = useAppStore(appStoreSelectors.loggedInPatient);
  const loggedInTherapist = useAppStore(appStoreSelectors.loggedInTherapist);
  const updatePatientProfile = useAppStore((s) => s.updatePatientProfile);

  const { c } = useTheme();
  const { toastMsg, toastAnim, showToast } = useToast();

  const { myAppointments } = useTherapyData();
  const { favorites } = useFavorites({ authToken });

  const {
    notifications, dismissedNotifIds,
    showNotifications, setShowNotifications,
    dismissNotification, dismissAllNotifications,
    showReviewNotificationModal, reviewNotification, markReviewNotificationSeen,
  } = useNotificationPolling({ authToken, accountType });

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

  const handleNotificationPress = (notification) => {
    setShowNotifications(false);
    const type = notification?.type;
    if (
      type === 'NEW_BOOKING_REQUEST' || type === 'BOOKING_CONFIRMED' ||
      type === 'BOOKING_DECLINED' || type === 'BOOKING_CANCELLED'
    ) {
      navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.THERAPY });
    }
  };

  const [profileSavedTitle, setProfileSavedTitle] = useState('');
  const [profileSavedBody, setProfileSavedBody] = useState('');
  const [showProfileSaved, setShowProfileSaved] = useState(false);

  const hasBadge = notifications.filter((n) => !dismissedNotifIds.has(n.id)).length > 0;

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
          <TabHeader c={c} title="Mein Profil" onBellPress={() => setShowNotifications(true)} hasBadge={hasBadge} />
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
        <NotificationSheet
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          dismissedNotifIds={dismissedNotifIds}
          dismissNotification={dismissNotification}
          dismissAllNotifications={dismissAllNotifications}
          onPressNotification={handleNotificationPress}
          c={c} t={t}
        />
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
          <TabHeader c={c} title="Mein Profil" onBellPress={() => setShowNotifications(true)} hasBadge={hasBadge} />
          <TherapistDashboardScreen
            c={c} t={t} styles={appStyles}
            certificationOptions={CERTIFICATION_OPTIONS}
            onOpenTherapyTab={() => navigation.navigate(TAB_ROUTES.THERAPY)}
            onAddSlot={handleAddSlot}
            onProfileSaved={openProfileSavedModal}
          />
        </View>
        <NotificationSheet
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          dismissedNotifIds={dismissedNotifIds}
          dismissNotification={dismissNotification}
          dismissAllNotifications={dismissAllNotifications}
          onPressNotification={handleNotificationPress}
          c={c} t={t}
        />
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

  return <AuthScreen />;
}
