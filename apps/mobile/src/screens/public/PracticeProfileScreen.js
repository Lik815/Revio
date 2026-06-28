import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useFavorites } from '../../hooks/use-favorites';
import { useToast } from '../../hooks/use-toast';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES } from '../../navigation/route-names';
import { getBaseUrl, mapApiTherapist, softenErrorMessage, TUNNEL_HEADERS } from '../../utils/app-utils';
import { ToastOverlay } from '../../components/ToastOverlay';
import { PracticeProfileContent } from './PracticeProfileContent';

const t = (key) => translations.de[key] ?? key;

export function PracticeProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { practice: initialPractice = null } = route.params ?? {};

  const { c } = useTheme();
  const authToken = useAppStore(appStoreSelectors.authToken);
  const { toastMsg, toastAnim, showToast } = useToast();
  const { isPracticeFavorite, togglePracticeFavorite, loadPracticeFavorites } = useFavorites({ authToken, showToast, t });

  const [practice, setPractice] = useState(initialPractice);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Server-backed practice favorites (replaces the old AsyncStorage-only store).
  useEffect(() => {
    if (authToken) loadPracticeFavorites(authToken);
  }, [authToken]);

  useEffect(() => {
    const id = practice?.id;
    if (!id) return;
    setLoading(true);
    setError('');
    fetch(`${getBaseUrl()}/practice-detail/${id}`, { headers: { ...TUNNEL_HEADERS } })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        // Merge the full practice from the detail endpoint so chips / opening
        // hours / website are present even when navigated here with a minimal
        // practice object (e.g. from a therapist's "works at" link).
        if (data.practice) setPractice((prev) => ({ ...(prev ?? {}), ...data.practice }));
        setTherapists((data.therapists ?? []).map(mapApiTherapist));
      })
      .catch(() => setError(t('alertNoConnection')))
      .finally(() => setLoading(false));
  }, [practice?.id]);

  // Strip the joined therapists before storing as a favorite payload.
  const toggleFavoritePractice = (p) => {
    const { therapists: _drop, ...practiceData } = p ?? {};
    togglePracticeFavorite(practiceData);
  };

  const callPhone = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const openTherapistById = (id, fallback = null) => {
    navigation.navigate(ROOT_ROUTES.THERAPIST_PROFILE, { therapistId: id, therapist: fallback });
  };

  if (!practice) return null;

  return (
    <View style={{ flex: 1 }}>
      <PracticeProfileContent
        c={c}
        callPhone={callPhone}
        isPracticeFavorite={isPracticeFavorite}
        openPractice={() => {}}
        openTherapistById={openTherapistById}
        practice={practice}
        selectedPracticeError={error}
        selectedPracticeLoading={loading}
        selectedPracticeTherapists={therapists}
        setSelectedPractice={(val) => { if (!val) navigation.goBack(); else setPractice(val); }}
        styles={appStyles}
        t={t}
        toggleFavoritePractice={toggleFavoritePractice}
      />
      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}
