import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useNotificationPolling } from '../../hooks/use-notification-polling';
import { useToast } from '../../hooks/use-toast';
import { useFavorites } from '../../hooks/use-favorites';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../mobile-translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { fortbildungOptions, getBaseUrl, TUNNEL_HEADERS } from '../../mobile-utils';
import { TabHeader } from '../../components/TabHeader';
import { ToastOverlay } from '../../components/ToastOverlay';
import { NotificationSheet } from '../../modals/NotificationSheet';
import { ProfileSavedModal } from '../../mobile-profile-saved-modal';
import { TherapistDashboardScreen } from '../../mobile-therapist-dashboard';
import { PatientDashboardScreen } from '../../mobile-patient-dashboard';
import { useTherapyData } from '../../context/TherapyContext';
import { useAuth } from '../../context/AuthContext';

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
  } = useNotificationPolling({ authToken, accountType });

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
          onPressNotification={() => setShowNotifications(false)}
          c={c} t={t}
        />
        <ProfileSavedModal
          visible={showProfileSaved}
          onClose={() => setShowProfileSaved(false)}
          title={profileSavedTitle}
          body={profileSavedBody}
          c={c}
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
          onPressNotification={() => setShowNotifications(false)}
          c={c} t={t}
        />
        <ProfileSavedModal
          visible={showProfileSaved}
          onClose={() => setShowProfileSaved(false)}
          title={profileSavedTitle}
          body={profileSavedBody}
          c={c}
        />
        <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TabHeader c={c} wordmark />
    </View>
  );
}
