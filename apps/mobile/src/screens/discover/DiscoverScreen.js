import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback } from 'react';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useFavorites } from '../../hooks/use-favorites';
import { useToast } from '../../hooks/use-toast';
import { useSearch } from '../../hooks/use-search';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { HeartButton } from '../../components/HeartButton';
import { SkeletonCard } from '../../components/SkeletonCard';
import { ToastOverlay } from '../../components/ToastOverlay';
import { LocationSheet } from '../../modals/LocationSheet';
import { appStyles } from '../../styles/app-styles';
import { DiscoverContent } from './DiscoverContent';
import { NextAppointmentBanner, NEXT_APPOINTMENT_BANNER_HEIGHT } from '../../components/NextAppointmentBanner';
import { useTherapyData } from '../../context/TherapyContext';
import { getNextPatientAppointment, courseCategoryChips } from '../../utils/app-utils';

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
  const route = useRoute();

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);
  const loggedInTherapist = useAppStore(appStoreSelectors.loggedInTherapist);
  const { c } = useTheme();
  const { toastMsg, toastAnim, showToast } = useToast();

  const { favorites, toggleFavorite, isFavorite } = useFavorites({ authToken, showToast, t });

  const search = useSearch({ t });
  const discoverScrollRef = useRef(null);

  const {
    myAppointments,
    appointmentsLastLoadedAt,
    refreshTherapyTab,
  } = useTherapyData();

  // Nachladen wenn eingeloggt und Termine veraltet/nie geladen
  useFocusEffect(
    useCallback(() => {
      if (!authToken || accountType !== 'patient') return;
      refreshTherapyTab(authToken, accountType, loggedInTherapist, { force: false });
    }, [authToken, accountType, loggedInTherapist, refreshTherapyTab]),
  );

  useEffect(() => {
    if (!route.params?.resetToHomeAt) return;
    search.resetDiscoverState();
    discoverScrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [route.params?.resetToHomeAt]);

  const isSearchActive = !!(search.searched || search.query);

  const nextAppointment = useMemo(() => {
    if (accountType !== 'patient') return null;
    if (isSearchActive) return null;
    return getNextPatientAppointment(myAppointments);
  }, [myAppointments, accountType, isSearchActive]);

  const ThemedHeartButton = (props) => (
    <HeartButton {...props} savedColor={c.saved} unsavedColor={props.unsavedColor ?? c.muted} />
  );

  const openTherapistById = (id, fallback = null) => {
    navigation.navigate(ROOT_ROUTES.THERAPIST_PROFILE, { therapistId: id, therapist: fallback });
  };

  const openCourseById = (id, title = null) => {
    navigation.navigate(ROOT_ROUTES.COURSE_DETAIL, { courseId: id, courseTitle: title });
  };

  const handleBannerPress = () => {
    navigation.navigate(ROOT_ROUTES.MAIN_TABS, {
      screen: TAB_ROUTES.THERAPY,
    });
  };

  return (
    <>
      <DiscoverContent
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
        fortbildungen={search.fortbildungen}
        gender={search.gender}
        getMapRegion={search.getMapRegion}
        homeVisit={search.homeVisit}
        isFavorite={isFavorite}
        kassenart={search.kassenart}
        locationLabel={search.locationLabel}
        mapScrollEnabled={search.mapScrollEnabled}
        mapTherapists={search.mapTherapists}
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
        bannerExtraPadding={nextAppointment ? NEXT_APPOINTMENT_BANNER_HEIGHT + 16 : 0}
        courseResults={search.courseResults}
        courseLoading={search.courseLoading}
        courseCategoryKey={search.courseCategoryKey}
        selectCourseCategory={search.selectCourseCategory}
        courseCategoryChips={courseCategoryChips}
        openCourseById={openCourseById}
      />

      <NextAppointmentBanner
        appointment={nextAppointment}
        onPress={handleBannerPress}
        c={c}
      />

      <LocationSheet
        visible={search.showLocationSheet}
        onClose={() => search.setShowLocationSheet(false)}
        city={search.locationSheetCity}
        onChangeCity={search.fetchLocationSuggestions}
        suggestions={search.locationSuggestions}
        onSelectSuggestion={search.selectLocationSuggestion}
        onUseGPS={search.handleLocationSheetGPS}
        loading={search.locationLoading}
        onConfirm={search.handleLocationSheetManual}
        c={c}
        t={t}
      />

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </>
  );
}
