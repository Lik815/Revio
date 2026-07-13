import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { InquiryRequestForm } from './InquiryRequestForm';
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
  const [showLoginRequired, setShowLoginRequired] = useState(false);

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
      // Nicht eingeloggt: erst Hinweis-Modal statt direktem Sprung zum Login.
      setShowLoginRequired(true);
      return;
    }
    if (th) setShowBookingForm(true);
  };

  const goToLogin = () => {
    setShowLoginRequired(false);
    navigation.navigate(ROOT_ROUTES.MAIN_TABS, { screen: TAB_ROUTES.AUTH });
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
        <InquiryRequestForm
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

      {/* ── Login-Hinweis bei Buchung ohne Anmeldung ────────────────────────── */}
      <Modal visible={showLoginRequired} transparent animationType="fade" onRequestClose={() => setShowLoginRequired(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => setShowLoginRequired(false)}
        >
          <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="calendar-outline" size={26} color={c.primary} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center', marginBottom: 8 }}>
                Anmeldung erforderlich
              </Text>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
                Um einen Termin zu buchen, melde dich mit deinem Patienten-Konto an oder erstelle ein kostenloses Konto.
              </Text>
            </View>
            <Pressable
              onPress={goToLogin}
              style={{ backgroundColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginBottom: 10 }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Jetzt anmelden</Text>
            </Pressable>
            <Pressable onPress={() => setShowLoginRequired(false)} style={{ paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 14 }}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />
    </View>
  );
}
