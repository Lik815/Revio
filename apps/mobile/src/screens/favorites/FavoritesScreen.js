import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useFavorites } from '../../hooks/use-favorites';
import { useNotificationPolling } from '../../hooks/use-notification-polling';
import { useToast } from '../../hooks/use-toast';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../mobile-translations';
import { ROOT_ROUTES } from '../../navigation/route-names';
import { FavoritesTab } from '../../mobile-favorites-tab';
import { NotificationSheet } from '../../modals/NotificationSheet';
import { ToastOverlay } from '../../components/ToastOverlay';

const t = (key) => translations.de[key] ?? key;

export function FavoritesTabScreen() {
  const navigation = useNavigation();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);

  const { c } = useTheme();
  const { toastMsg, toastAnim, showToast } = useToast();

  const {
    favorites,
    favoritesLoading,
    favoritesLastLoadedAt,
    loadFavorites,
    toggleFavorite,
  } = useFavorites({ authToken, showToast, t });

  const {
    notifications,
    dismissedNotifIds,
    showNotifications,
    setShowNotifications,
    dismissNotification,
    dismissAllNotifications,
  } = useNotificationPolling({ authToken, accountType });

  useEffect(() => {
    if (authToken) loadFavorites(authToken);
  }, [authToken]);

  const openTherapistById = (id, fallbackTherapist = null) => {
    navigation.navigate(ROOT_ROUTES.THERAPIST_PROFILE, { therapistId: id, therapist: fallbackTherapist });
  };

  return (
    <>
      <FavoritesTab
        authToken={authToken}
        favorites={favorites}
        favoritesLoading={favoritesLoading}
        favoritesLastLoadedAt={favoritesLastLoadedAt}
        loadFavorites={loadFavorites}
        toggleFavorite={toggleFavorite}
        openTherapistById={openTherapistById}
        notifications={notifications}
        dismissedNotifIds={dismissedNotifIds}
        setShowNotifications={setShowNotifications}
        setActiveTab={() => {}}
        setShowLogin={() => navigation.navigate(ROOT_ROUTES.AUTH)}
        styles={appStyles}
        c={c}
        t={t}
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

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </>
  );
}
