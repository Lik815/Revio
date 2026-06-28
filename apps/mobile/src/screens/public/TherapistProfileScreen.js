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

function therapistHasProfileContent(therapist) {
  if (!therapist) return false;
  return Boolean(
    (typeof therapist.bio === 'string' && therapist.bio.trim()) ||
    (Array.isArray(therapist.specializations) && therapist.specializations.length > 0) ||
    (Array.isArray(therapist.behandlungsbereiche) && therapist.behandlungsbereiche.length > 0) ||
    (Array.isArray(therapist.fortbildungen) && therapist.fortbildungen.length > 0) ||
    (Array.isArray(therapist.practices) && therapist.practices.length > 0) ||
    (Array.isArray(therapist.languages) && therapist.languages.length > 0),
  );
}

export function TherapistProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { therapistId, therapist: initialTherapist = null } = route.params ?? {};

  const authToken = useAppStore(appStoreSelectors.authToken);
  const accountType = useAppStore(appStoreSelectors.accountType);

  const { c } = useTheme();
  const { toastMsg, toastAnim, showToast } = useToast();

  const [therapist, setTherapist] = useState(initialTherapist);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(null);

  const { favorites, loadFavorites, toggleFavorite, isFavorite } = useFavorites({
    authToken,
    showToast,
    t,
  });

  useEffect(() => {
    if (authToken) loadFavorites(authToken);
  }, [authToken]);

  useEffect(() => {
    if (!therapistId) return;
    if (therapistHasProfileContent(therapist)) return;
    fetch(`${getBaseUrl()}/therapist/${therapistId}`, { headers: { ...TUNNEL_HEADERS } })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        const enriched = payload?.therapist ? mapApiTherapist(payload.therapist) : null;
        if (enriched) setTherapist(enriched);
      })
      .catch(() => {});
  }, [therapistId]);

  const loadAvailableSlots = async (id) => {
    setSlotsLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/therapists/${id}/slots`, {
        headers: { ...TUNNEL_HEADERS },
      });
      setAvailableSlots(res.ok ? ((await res.json()).slots ?? []) : []);
    } catch {
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (therapist?.bookingMode === 'FIRST_APPOINTMENT_REQUEST') loadAvailableSlots(therapist.id);
  }, [therapist?.id, therapist?.bookingMode]);

  const handleBookingRequest = (th) => {
    if (!authToken) {
      navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.AUTH });
      return;
    }
    if (th) {
      loadAvailableSlots(th.id);
      setSelectedSlotId(th.selectedSlotId ?? null);
      setShowBookingForm(true);
    }
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
        onOpenPractice={(practice) => navigation.navigate(ROOT_ROUTES.PRACTICE_PROFILE, { practice })}
        availableSlots={availableSlots}
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
          therapist={selectedSlotId ? { ...therapist, selectedSlotId } : therapist}
          authToken={authToken}
          availableSlots={availableSlots}
          slotsLoading={slotsLoading}
          onSuccess={() => {
            setShowBookingForm(false);
            navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.THERAPY });
          }}
          onClose={() => setShowBookingForm(false)}
          onReloadSlots={() => loadAvailableSlots(therapist.id)}
        />
      </Modal>

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}
