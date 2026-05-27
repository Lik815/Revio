import React, { useRef } from 'react';
import { Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useFavorites } from '../../hooks/use-favorites';
import { useNotificationPolling } from '../../hooks/use-notification-polling';
import { useToast } from '../../hooks/use-toast';
import { useSearch } from '../../hooks/use-search';
import { translations } from '../../mobile-translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { HeartButton } from '../../components/HeartButton';
import { SkeletonCard } from '../../components/SkeletonCard';
import { ToastOverlay } from '../../components/ToastOverlay';
import { NotificationSheet } from '../../modals/NotificationSheet';
import { appStyles } from '../../styles/app-styles';
import { DiscoverScreen } from '../../mobile-discover-screen';

const t = (key) => translations.de[key] ?? key;

function callPhone(phone) {
  if (!phone) {
    Alert.alert(t('alertNoPhone'), t('alertNoPhoneBody'));
    return;
  }
  Alert.alert(phone, t('callBtn') + '?', [
    { text: t('callBtn'), onPress: () => Linking.openURL(`tel:${phone}`) },
    { text: t('cancelBtn'), style: 'cancel' },
  ]);
}

export function DiscoverTabScreen() {
  const navigation = useNavigation();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);

  const { c } = useTheme();
  const { toastMsg, toastAnim, showToast } = useToast();

  const { favorites, toggleFavorite, isFavorite } = useFavorites({ authToken, showToast, t });

  const {
    notifications, dismissedNotifIds,
    showNotifications, setShowNotifications,
    dismissNotification, dismissAllNotifications,
  } = useNotificationPolling({ authToken, accountType });

  const search = useSearch();
  const discoverScrollRef = useRef(null);

  const ThemedHeartButton = (props) => (
    <HeartButton {...props} savedColor={c.saved} unsavedColor={props.unsavedColor ?? c.muted} />
  );

  const openTherapistById = (id, fallback = null) => {
    navigation.navigate(ROOT_ROUTES.THERAPIST_PROFILE, { therapistId: id, therapist: fallback });
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
      <DiscoverScreen
        HeartButton={ThemedHeartButton}
        SkeletonCard={SkeletonCard}
        acSuggestions={search.acSuggestions}
        activeChip={search.activeChip}
        activeFilterCount={search.activeFilterCount}
        authToken={authToken}
        c={c}
        callPhone={callPhone}
        certificationOptions={search.certificationOptions}
        city={search.city}
        discoverScrollRef={discoverScrollRef}
        dismissedNotifIds={dismissedNotifIds}
        fortbildungen={search.fortbildungen}
        gender={search.gender}
        getMapRegion={search.getMapRegion}
        homeVisit={search.homeVisit}
        isFavorite={isFavorite}
        kassenart={search.kassenart}
        locationLabel={search.locationLabel}
        mapScrollEnabled={search.mapScrollEnabled}
        mapTherapists={search.mapTherapists}
        notifications={notifications}
        openTherapistById={openTherapistById}
        query={search.query}
        requestableOnly={search.requestableOnly}
        results={search.results}
        runSearch={search.runSearch}
        runSearchWith={search.runSearchWith}
        searched={search.searched}
        searchLoading={search.searchLoading}
        searchRadius={search.searchRadius}
        selectChip={search.selectChip}
        selectSuggestion={search.selectSuggestion}
        setActiveChip={search.setActiveChip}
        setFortbildungen={search.setFortbildungen}
        setGender={search.setGender}
        setHomeVisit={search.setHomeVisit}
        setKassenart={search.setKassenart}
        setLocationSheetCity={search.setLocationSheetCity}
        setMapScrollEnabled={search.setMapScrollEnabled}
        setQuery={search.setQuery}
        setRequestableOnly={search.setRequestableOnly}
        setShowAutocomplete={search.setShowAutocomplete}
        setShowFilters={search.setShowFilters}
        setShowLocationSheet={search.setShowLocationSheet}
        setShowNotifications={setShowNotifications}
        setSearchRadius={search.setSearchRadius}
        setViewMode={search.setViewMode}
        showAutocomplete={search.showAutocomplete}
        showFilters={search.showFilters}
        styles={appStyles}
        t={t}
        toggleFavorite={toggleFavorite}
        toggleFortbildung={search.toggleFortbildung}
        userCoords={search.userCoords}
        viewMode={search.viewMode}
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

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </>
  );
}
