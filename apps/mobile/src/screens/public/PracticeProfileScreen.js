import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../hooks/use-theme';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES } from '../../navigation/route-names';
import { getBaseUrl, mapApiTherapist, softenErrorMessage, TUNNEL_HEADERS } from '../../utils/app-utils';
import { PracticeProfileContent } from './PracticeProfileContent';

const t = (key) => translations.de[key] ?? key;
const FAV_PRACTICES_KEY = 'revio_fav_practices';

export function PracticeProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { practice: initialPractice = null } = route.params ?? {};

  const { c } = useTheme();

  const [practice, setPractice] = useState(initialPractice);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [favPractices, setFavPractices] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(FAV_PRACTICES_KEY).then((raw) => {
      if (!raw) return;
      try { setFavPractices(JSON.parse(raw)); } catch {}
    });
  }, []);

  useEffect(() => {
    const id = practice?.id;
    if (!id) return;
    setLoading(true);
    setError('');
    fetch(`${getBaseUrl()}/practice-detail/${id}`, { headers: { ...TUNNEL_HEADERS } })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setTherapists((data.therapists ?? []).map(mapApiTherapist)))
      .catch(() => setError(t('alertNoConnection')))
      .finally(() => setLoading(false));
  }, [practice?.id]);

  const toggleFavoritePractice = (p) => {
    const { therapists: _drop, ...practiceData } = p;
    setFavPractices((prev) => {
      const exists = prev.some((f) => f.id === p.id);
      const next = exists ? prev.filter((f) => f.id !== p.id) : [...prev, practiceData];
      AsyncStorage.setItem(FAV_PRACTICES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const isPracticeFavorite = (id) => favPractices.some((f) => f.id === id);

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
    </View>
  );
}
