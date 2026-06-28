import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useFavorites } from '../../hooks/use-favorites';
import { useToast } from '../../hooks/use-toast';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { FavoritesTab } from './FavoritesTab';
import { ToastOverlay } from '../../components/ToastOverlay';

const t = (key) => translations.de[key] ?? key;

export function FavoritesTabScreen() {
  const navigation = useNavigation();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const { c } = useTheme();
  const { toastMsg, toastAnim, showToast } = useToast();

  const {
    favorites,
    favoritesLoading,
    favoritesLastLoadedAt,
    loadFavorites,
    toggleFavorite,
    practiceFavorites,
    practiceFavoritesLoading,
    practiceFavoritesLastLoadedAt,
    loadPracticeFavorites,
    togglePracticeFavorite,
  } = useFavorites({ authToken, showToast, t });

  useEffect(() => {
    if (authToken) {
      loadFavorites(authToken);
      loadPracticeFavorites(authToken);
    }
  }, [authToken]);

  const openTherapistById = (id, fallbackTherapist = null) => {
    navigation.navigate(ROOT_ROUTES.THERAPIST_PROFILE, { therapistId: id, therapist: fallbackTherapist });
  };

  const openPractice = (practice) => {
    if (!practice?.id) return;
    navigation.navigate(ROOT_ROUTES.PRACTICE_PROFILE, { practice });
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
        practiceFavorites={practiceFavorites}
        practiceFavoritesLoading={practiceFavoritesLoading}
        practiceFavoritesLastLoadedAt={practiceFavoritesLastLoadedAt}
        loadPracticeFavorites={loadPracticeFavorites}
        togglePracticeFavorite={togglePracticeFavorite}
        openPractice={openPractice}
        setActiveTab={() => {}}
        setShowLogin={() => navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.AUTH })}
        styles={appStyles}
        c={c}
        t={t}
      />

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </>
  );
}
