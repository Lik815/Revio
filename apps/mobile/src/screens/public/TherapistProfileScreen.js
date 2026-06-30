import React, { useEffect, useState } from 'react';
import { Linking, Modal, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { appStoreSelectors, useAppStore } from '../../store/useStore';
import { useTheme } from '../../hooks/use-theme';
import { useFavorites } from '../../hooks/use-favorites';
import { useToast } from '../../hooks/use-toast';
import { appStyles } from '../../styles/app-styles';
import { translations } from '../../i18n/translations';
import { ROOT_ROUTES, TAB_ROUTES } from '../../navigation/route-names';
import { getBaseUrl, mapApiTherapist, TUNNEL_HEADERS } from '../../utils/app-utils';
import { HeartButton } from '../../components/HeartButton';
import { ToastOverlay } from '../../components/ToastOverlay';
import { BookingRequestForm } from './BookingRequestForm';
import { TherapistProfileContent } from './TherapistProfileContent';

const t = (key) => translations.de[key] ?? key;

export function TherapistProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { therapistId, therapist: initialTherapist = null } = route.params ?? {};

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);

  const { c } = useTheme();
  const { toastMsg, toastAnim, showToast } = useToast();

  const [therapist, setTherapist] = useState(initialTherapist);
  const [showBookingForm, setShowBookingForm] = useState(false);

  const { favorites, loadFavorites, toggleFavorite, isFavorite } = useFavorites({
    authToken,
    showToast,
    t,
  });

  useEffect(() => {
    if (authToken) loadFavorites(authToken);
  }, [authToken]);

  // initialTherapist (aus dem Suchergebnis) wird sofort angezeigt,
  // aber immer durch einen frischen API-Call ersetzt.
  useEffect(() => {
    if (!therapistId) return;
    fetch(`${getBaseUrl()}/therapist/${therapistId}`, { headers: { ...TUNNEL_HEADERS } })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        const enriched = payload?.therapist ? mapApiTherapist(payload.therapist) : null;
        if (enriched) setTherapist(enriched);
      })
      .catch(() => {});
  }, [therapistId]);

  const handleBookingRequest = (th) => {
    if (!authToken) {
      navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.AUTH });
      return;
    }
    if (th) setShowBookingForm(true);
  };

  const callPhone = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  if (!therapist) return null;

  return (
    <View style={{ flex: 1 }}>
      <TherapistProfileContent
        HeartButton={HeartButton}
        c={c}
        callPhone={callPhone}
        isFavorite={isFavorite}
        setSelectedTherapist={(val) => { if (!val) navigation.goBack(); }}
        styles={appStyles}
        t={t}
        th={therapist}
        toggleFavorite={toggleFavorite}
        authToken={authToken}
        accountType={accountType}
        onBookingRequest={handleBookingRequest}
        availableSlots={[]}
      />

      <Modal
        visible={showBookingForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBookingForm(false)}
      >
        <BookingRequestForm
          c={c}
          t={t}
          therapist={therapist}
          authToken={authToken}
          onSuccess={() => {
            setShowBookingForm(false);
            navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.THERAPY });
          }}
          onClose={() => setShowBookingForm(false)}
        />
      </Modal>

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}
