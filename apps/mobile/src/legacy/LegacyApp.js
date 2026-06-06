import React, { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COLORS,
  RADIUS,
  SHADOW,
  SPACE,
  TYPE,
  getBaseUrl,
  TUNNEL_HEADERS,
  haversine,
  mapApiTherapist,
  normalizeLanguageCodes,
  normalizeTherapistProfile,
  softenErrorMessage,
  tabs,
} from '../mobile-utils';
import { HeartButton } from '../components/HeartButton';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { NotificationBell } from '../components/NotificationBell';
import { ToastOverlay } from '../components/ToastOverlay';
import { SkeletonCard } from '../components/SkeletonCard';
import { TabHeader } from '../components/TabHeader';
import { useTheme } from '../hooks/use-theme';
import { appStyles as styles } from '../styles/app-styles';
import { useToast } from '../hooks/use-toast';
import { useNotificationPolling } from '../hooks/use-notification-polling';
import { useSearch } from '../hooks/use-search';
import { DiscoverScreen } from '../mobile-discover-screen';
import {
  TherapistProfileScreen,
} from '../mobile-public-profiles';
import {
  LoginScreen,
  TherapistLandingScreen,
} from '../mobile-therapist-screens';
import {
  TherapistDashboardScreen,
} from '../mobile-therapist-dashboard';
import {
  } from '../mobile-compliance-step';
import { translations } from '../mobile-translations';
import { PatientDashboardScreen } from '../mobile-patient-dashboard';
import { BookingRequestForm } from '../mobile-booking';
import { TherapistRegistrationFlow } from '../mobile-therapist-registration-flow';
import { PatientSignupFlow } from '../mobile-patient-signup-flow';
import { ChangePasswordModal } from '../mobile-change-password-modal';
import { DeleteAccountModal } from '../mobile-delete-account-modal';
import { FeedbackModal } from '../mobile-feedback-modal';
import { ResetPasswordModal } from '../mobile-reset-password-modal';
import { EmailVerifyScreen } from '../mobile-email-verify-screen';
import { InviteClaimScreen } from '../mobile-invite-claim-screen';
import { TherapyTabPatient, TherapyTabTherapist } from '../mobile-therapy-tabs';
import { AppointmentDetail } from '../mobile-appointment-detail';
import { OptionsScreen } from '../mobile-options-screen';
import { AuthDebugScreen } from '../screens/AuthDebugScreen';
import { useAuth } from '../context/AuthContext';
import { useTherapyData } from '../context/TherapyContext';
import { NotificationSheet } from '../modals/NotificationSheet';
import { ReviewNotificationModal } from '../mobile-review-notification-modal';
import { VisibilityModal } from '../mobile-visibility-modal';
import { ProfileSavedModal } from '../mobile-profile-saved-modal';
import { SlotCreatedModal } from '../mobile-slot-created-modal';
import { CancelAppointmentModal } from '../mobile-cancel-appointment-modal';
import { TherapistCancelModal } from '../mobile-therapist-cancel-modal';
import { SlotComposerModal } from '../mobile-slot-composer-modal';
import { LocationSheet } from '../mobile-location-sheet';
import { PhotoPromptModal } from '../mobile-photo-prompt-modal';
import { FavoritesTab } from '../mobile-favorites-tab';

const formatProfileOverviewName = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return fullName;
  const lastName = parts[parts.length - 1];
  const firstNames = parts.slice(0, -1).join(' ');
  return `${lastName} ${firstNames}`.trim();
};

const webWindow = typeof globalThis !== 'undefined' ? globalThis.window : undefined;
const webNavigator = typeof globalThis !== 'undefined' ? globalThis.navigator : undefined;

function showWebAlert(message) {
  webWindow?.alert?.(message);
}

function showWebConfirm(message) {
  return webWindow?.confirm?.(message) ?? false;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

const ICON_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
const COMPLIANCE_STATUS_VALUES = ['yes', 'no', 'in_progress'];
const HEALTH_AUTHORITY_STATUS_VALUES = ['yes', 'no', 'in_progress', 'unknown'];


// ─── App ──────────────────────────────────────────────────────────────────────

function callPhone(phone, t) {
  if (!phone) {
    Alert.alert(t('alertNoPhone'), t('alertNoPhoneBody'));
    return;
  }
  Alert.alert(phone, t('callBtn') + '?', [
    { text: t('callBtn'), onPress: () => Linking.openURL(`tel:${phone}`) },
    { text: t('cancelBtn'), style: 'cancel' },
  ]);
}


export default function App() {
  const { themeMode, setThemeMode, scheme, c } = useTheme();
  const ThemedHeartButton = (props) => (
    <HeartButton {...props} savedColor={c.saved} unsavedColor={props.unsavedColor ?? c.muted} />
  );

  const t = (key) => translations.de[key];

  const [activeTab, setActiveTab] = useState('discover');
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [selectedPracticeTherapists, setSelectedPracticeTherapists] = useState([]);
  const [selectedPracticeLoading, setSelectedPracticeLoading] = useState(false);
  const [selectedPracticeError, setSelectedPracticeError] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showCancelAppointmentModal, setShowCancelAppointmentModal] = useState(false);
  const [showTherapistCancelModal, setShowTherapistCancelModal] = useState(false);
  const [therapistCancelBookingId, setTherapistCancelBookingId] = useState(null);
  const [therapistDetailBooking, setTherapistDetailBooking] = useState(null);

  const handleCancelSelectedAppointment = async () => {
    if (!selectedAppointment) return;
    try {
      const res = await fetch(`${getBaseUrl()}/bookings/${selectedAppointment.id}/cancel`, {
        method: 'PATCH',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        await loadMyAppointments(authToken);
        setSelectedAppointment(null);
      } else {
        Alert.alert('Fehler', 'Stornierung fehlgeschlagen. Bitte versuche es erneut.');
      }
    } catch {
      Alert.alert('Fehler', 'Keine Verbindung. Bitte versuche es erneut.');
    }
  };

  // Favorites — stored locally on device only

  const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;


  const toggleFavorite = async (therapist) => {
    if (!authToken) {
      showToast(t('favLoginRequired') ?? 'Bitte einloggen um Favoriten zu speichern');
      return;
    }
    const exists = favorites.some(f => f.id === therapist.id);
    // Optimistic update
    setFavorites(prev => exists ? prev.filter(f => f.id !== therapist.id) : [...prev, therapist]);
    if (!exists) showToast(t('favSaved').replace('{name}', therapist.fullName));
    else showToast(`${therapist.fullName} entfernt`);
    try {
      let res;
      if (exists) {
        res = await fetch(`${getBaseUrl()}/auth/favorites/therapists/${therapist.id}`, {
          method: 'DELETE',
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        });
      } else {
        res = await fetch(`${getBaseUrl()}/auth/favorites/therapists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ therapistId: therapist.id }),
        });
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(`Fehler ${res.status}: ${JSON.stringify(errData).slice(0, 80)}`);
        setFavorites(prev => exists ? [...prev, therapist] : prev.filter(f => f.id !== therapist.id));
      }
    } catch (e) {
      showToast(`Netzwerkfehler: ${String(e).slice(0, 60)}`);
      setFavorites(prev => exists ? [...prev, therapist] : prev.filter(f => f.id !== therapist.id));
    }
  };
  const isFavorite = (id) => favorites.some(f => f.id === id);

  // Practice favorites — stored locally
  useEffect(() => {
    AsyncStorage.getItem('revio_fav_practices').then(val => {
      if (!val) return;
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) setFavoritePractices(parsed);
      } catch {}
    });
  }, []);
  const toggleFavoritePractice = (practice) => {
    // Store only practice metadata — therapists are always fetched live via openPractice()
    const { therapists: _drop, ...practiceData } = practice;
    setFavoritePractices(prev => {
      const exists = prev.some(f => f.id === practice.id);
      const next = exists ? prev.filter(f => f.id !== practice.id) : [...prev, practiceData];
      AsyncStorage.setItem('revio_fav_practices', JSON.stringify(next));
      if (!exists) showToast(t('favSaved').replace('{name}', practice.name));
      else showToast(`${practice.name} entfernt`);
      return next;
    });
  };
  const isPracticeFavorite = (id) => favoritePractices.some(f => f.id === id);

  // Registration state
  const [showRegister, setShowRegister] = useState(false);
  const [showPatientSignup, setShowPatientSignup] = useState(false);


  // Auth — from AuthContext
  const {
    authToken, setAuthToken,
    loggedInTherapist, setLoggedInTherapist,
    loggedInPatient, setLoggedInPatient,
    accountType, setAccountType,
    bootReady,
    loginAsTherapist, loginAsPatient, logout: logoutFromContext,
  } = useAuth();
  // Therapy data — from TherapyContext
  const {
    myAppointments, myAppointmentsLoading, setMyAppointments,
    incomingBookings, incomingBookingsLoading, setIncomingBookings,
    mySlots, slotsLoading, deletingSlotIds, setMySlots, setDeletingSlotIds,
    favorites, favoritesLoading, favoritePractices,
    setFavorites, setFavoritesLoading, setFavoritePractices,
    availableSlots, availableSlotsTherapistId, availableSlotsLoading,
    setAvailableSlots, setAvailableSlotsTherapistId,
    therapyRefreshing, setTherapyRefreshing,
    favoritesLastLoadedAt, appointmentsLastLoadedAt,
    incomingBookingsLastLoadedAt, slotsLastLoadedAt,
    loadFavorites, loadMyAppointments, loadIncomingBookings,
    loadMySlots, loadAvailableSlots,
    resetTherapyData, refreshTherapyTab: refreshTherapyTabCtx, handleTherapyRefresh: handleTherapyRefreshCtx,
  } = useTherapyData();
  const handleTherapyRefresh = () => handleTherapyRefreshCtx(authToken, accountType, loggedInTherapist);
  const refreshTherapyTab = () => refreshTherapyTabCtx(authToken, accountType, loggedInTherapist);

  // ── Custom hooks ──────────────────────────────────────────────────────────
  const { toastMsg, toastAnim, showToast } = useToast();

  const {
    notifications, setNotifications,
    dismissedNotifIds, setDismissedNotifIds,
    showNotifications, setShowNotifications,
    showReviewNotificationModal, setShowReviewNotificationModal,
    reviewNotification, setReviewNotification,
    dismissNotification, dismissAllNotifications, markReviewNotificationSeen,
  } = useNotificationPolling({
    authToken,
    accountType,
    onTherapistReviewStatus: (therapistId, reviewStatus) => {
      setLoggedInTherapist((prev) =>
        prev?.id === therapistId && prev.reviewStatus !== reviewStatus
          ? { ...prev, reviewStatus }
          : prev,
      );
    },
  });

  const {
    query, setQuery,
    showAutocomplete, setShowAutocomplete,
    activeChip, setActiveChip,
    homeVisit, setHomeVisit,
    kassenart, setKassenart,
    gender, setGender,
    requestableOnly, setRequestableOnly,
    fortbildungen, setFortbildungen,
    certificationOptions,
    searchRadius, setSearchRadius,
    showFilters, setShowFilters,
    activeFilterCount,
    getCertificationLabel,
    toggleFortbildung,
    results, setResults,
    searchLoading,
    allApiTherapists,
    searched, setSearched,
    viewMode, setViewMode,
    mapScrollEnabled, setMapScrollEnabled,
    acSuggestions,
    runSearch, runSearchWith,
    selectChip, selectSuggestion,
    city, setCity,
    userCoords, setUserCoords,
    locationLabel, setLocationLabel,
    showLocationSheet, setShowLocationSheet,
    locationSheetCity, setLocationSheetCity,
    locationLoading,
    locationSuggestions,
    fetchLocationSuggestions,
    selectLocationSuggestion,
    confirmLocationAndSearch,
    handleLocationSheetGPS,
    handleLocationSheetManual,
    mapTherapists,
    mapRegion,
    getMapRegion,
  } = useSearch({ t });

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingTargetTherapist, setBookingTargetTherapist] = useState(null);
  const blockTherapistEnrichRef = useRef(false);
  const [showLogin, setShowLogin] = useState(false);

  const [activeFilterTherapist, setActiveFilterTherapist] = useState('all');
  const [activeFilterPatient, setActiveFilterPatient] = useState('all');
  const [showArchivedApts, setShowArchivedApts] = useState(false);


  // Invite claim flow state
  const [showInviteClaim, setShowInviteClaim] = useState(false);
  const [inviteClaimToken, setInviteClaimToken] = useState(null);
  const [inviteClaimData, setInviteClaimData] = useState(null);
  const [inviteClaimLoading, setInviteClaimLoading] = useState(false);

  // Password reset deep-link state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordToken, setResetPasswordToken] = useState('');

  // Email verification deep-link state
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [emailVerifyStatus, setEmailVerifyStatus] = useState('idle');
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [emailVerifyError, setEmailVerifyError] = useState('');
  const [inviteClaimError, setInviteClaimError] = useState('');
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showProfileSavedModal, setShowProfileSavedModal] = useState(false);
  const [showSlotCreatedModal, setShowSlotCreatedModal] = useState(false);
  const [createdSlot, setCreatedSlot] = useState(null);
  const [profileSavedModalTitle, setProfileSavedModalTitle] = useState('');
  const [profileSavedModalBody, setProfileSavedModalBody] = useState('');
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  const openSignupFlow = () => {
    setShowLogin(false);
    setShowRegister(false);
    setShowPatientSignup(true);
  };

  const openProfileSavedModal = (title, body) => {
    setProfileSavedModalTitle(title);
    setProfileSavedModalBody(body);
    setShowProfileSavedModal(true);
  };

  const handlePatientProfileSaved = ({ firstName, lastName, phone }) => {
    setLoggedInPatient(prev => prev ? { ...prev, firstName, lastName, phone } : prev);
    openProfileSavedModal(t('profileSavedModalTitle') ?? 'Profil gespeichert', t('profileSavedModalBody') ?? 'Deine Änderungen wurden erfolgreich gespeichert.');
  };

  const closeProfileSavedModal = () => {
    setShowProfileSavedModal(false);
  };



  // Email verification deep-link handler (revo://verify?token=xxx)
  const handleVerifyEmailLink = async (token) => {
    setActiveTab('profile');
    setShowLogin(false);
    setShowRegister(false);
    setEmailVerifyError('');
    setEmailVerifyStatus('verifying');
    setShowEmailVerify(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 30000);
      let res;
      try {
        res = await fetch(`${getBaseUrl()}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setEmailVerifyError(err.message ?? t('alertVerifyFailed'));
        setEmailVerifyStatus('error');
        return;
      }
      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('revio_auth_token', data.token);
        await AsyncStorage.setItem('revio_account_type', data.accountType ?? 'therapist');
        setAuthToken(data.token);
        setAccountType(data.accountType ?? 'therapist');
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${data.token}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.role === 'patient') {
            setLoggedInPatient(profile);
          } else {
            setLoggedInTherapist(normalizeTherapistProfile(profile));
            if (!profile.photo) setTimeout(() => setShowPhotoPrompt(true), 2800);
          }
        }
      }
      setEmailVerifyStatus('success');
      setTimeout(() => setShowEmailVerify(false), 2500);
    } catch {
      setEmailVerifyError(t('alertConnectionError') + '. ' + t('alertConnectionErrorBody'));
      setEmailVerifyStatus('error');
    }
  };

  // Deep-link / initial URL handling
  useEffect(() => {
    const handleUrl = async (url) => {
      if (!url) return;
      try {
        const isVerifyLink = /revo:\/\/verify|\/verify[?]|verify-email/.test(url);
        const match = url.match(/[?&]token=([^&]+)/);
        if (!match) return;
        const token = decodeURIComponent(match[1]);

        if (isVerifyLink) {
          await handleVerifyEmailLink(token);
          return;
        }

        const isResetLink = /revo:\/\/reset-password|reset-password/.test(url);
        if (isResetLink) {
          setResetPasswordToken(token);
          setShowResetPassword(true);
          return;
        }

        // Existing invite-claim flow (unchanged)
        setInviteClaimLoading(true);
        setInviteClaimError('');
        try {
          const res = await fetch(`${getBaseUrl()}/invite/validate?token=${encodeURIComponent(token)}`);
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setInviteClaimError(err.message ?? t('alertInvalidInvite'));
            setShowInviteClaim(true);
            return;
          }
          const data = await res.json();
          setInviteClaimToken(token);
          setInviteClaimData(data);
          setInviteClaimPassword('');
          setInviteClaimPasswordConfirm('');
          setInviteClaimError('');
          setActiveTab('profile');
          setShowLogin(false);
          setShowRegister(false);
          setShowInviteClaim(true);
        } catch {
          setInviteClaimError(t('alertInviteConnectionError'));
          setShowInviteClaim(true);
        } finally {
          setInviteClaimLoading(false);
        }
      } catch {}
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);






  const handleNotificationPress = async (notification) => {
    setShowNotifications(false);
    const type = notification?.type;
    const bookingId = notification?.bookingId;

    switch (type) {
      case 'NEW_BOOKING_REQUEST':
        setActiveTab('therapy');
        setActiveFilterTherapist('pending');
        await loadIncomingBookings(authToken, { background: true });
        break;

      case 'BOOKING_CONFIRMED':
      case 'BOOKING_DECLINED':
      case 'BOOKING_CANCELLED':
        setActiveTab('therapy');
        if (authToken) {
          await loadMyAppointments(authToken, { background: true });
          if (bookingId) {
            setMyAppointments((prev) => {
              const found = prev.find((a) => a.id === bookingId);
              if (found) setTimeout(() => setSelectedAppointment(found), 100);
              return prev;
            });
          }
        }
        break;

      case 'PROFILE_APPROVED':
      case 'PROFILE_CHANGES_REQUESTED':
      case 'PROFILE_REJECTED':
      case 'PROFILE_SUSPENDED':
        setActiveTab('profile');
        break;

      case 'JOIN_REQUEST':
      case 'INVITE':
        setActiveTab('options');
        break;

      default:
        break;
    }
  };

  const handleLogout = async () => {
    if (authToken) {
      await fetch(`${getBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
      await AsyncStorage.removeItem('revio_auth_token');
      await AsyncStorage.removeItem('revio_account_type');
    }
    setAuthToken(null);
    setLoggedInTherapist(null);
    setLoggedInPatient(null);
    setAccountType(null);
    resetTherapyData();
    setShowBookingForm(false);
    setBookingTargetTherapist(null);
    setShowLogin(true);
  };

  const deleteAccountConfirmed = async () => {
    try {
      await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'DELETE',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
      });
    } catch {}
    await AsyncStorage.removeItem('revio_auth_token');
    await AsyncStorage.removeItem('revio_account_type');
    setAuthToken(null);
    setLoggedInTherapist(null);
    setLoggedInPatient(null);
    setAccountType(null);
    resetTherapyData();
  };

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const handleDeleteAccount = () => {
    if (loggedInTherapist?.adminPractice) {
      const msg = t('alertDeleteAdminWarning').replace('{name}', loggedInTherapist.adminPractice.name);
      if (Platform.OS === 'web') { showWebAlert(msg); }
      else { Alert.alert(t('alertHint'), msg, [{ text: 'OK' }]); }
      return;
    }
    setDeleteNameInput('');
    setShowDeleteAccountModal(true);
  };


  // GPS: request on demand only
  const handleGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('alertLocationUnavailable'), t('alertAllowLocation'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      if (geo?.city) {
        const streetParts = [geo.street, geo.streetNumber].filter(Boolean).join(' ');
        const label = streetParts ? `${streetParts}, ${geo.city}` : geo.city;
        setCity(geo.city);
        setLocationLabel(label);
        AsyncStorage.setItem('savedCity', geo.city);
        AsyncStorage.setItem('savedLocationLabel', label);
      }
      setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      AsyncStorage.setItem('savedCoords', JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude }));
    } catch {
      Alert.alert(t('alertError'), t('alertLocationFail'));
    }
  };

  const discoverScrollRef = React.useRef(null);
  const [showDebugScreen, setShowDebugScreen] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const openFeedbackModal = () => setShowFeedbackModal(true);
  const closeFeedbackModal = () => setShowFeedbackModal(false);
  const [showSlotComposerModal, setShowSlotComposerModal] = useState(false);


  useEffect(() => {
    if (activeTab === 'profile' && authToken && loggedInTherapist) {
      loadMySlots(authToken, { background: slotsLastLoadedAt > 0 });
    }
  }, [activeTab, authToken, loggedInTherapist?.id]);

  useEffect(() => {
    if (activeTab !== 'therapy' || !authToken) return;
    refreshTherapyTab();
  }, [activeTab, authToken, accountType, loggedInTherapist?.id, loggedInPatient?.id]);





  // ── Open practice (always loads fresh therapist data) ─────────────────────

  const openPractice = async (practice) => {
    setSelectedPracticeTherapists([]);
    setSelectedPracticeLoading(true);
    setSelectedPracticeError('');
    setSelectedPractice(practice);
    try {
      const res = await fetch(`${getBaseUrl()}/practice-detail/${practice.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPracticeTherapists((data.therapists ?? []).map(mapApiTherapist));
      } else {
        const body = await res.json().catch(() => ({}));
        console.error('[openPractice] status:', res.status, 'body:', JSON.stringify(body));
        setSelectedPracticeError(softenErrorMessage(body.message ?? t('alertLoadFail')));
      }
    } catch {
      setSelectedPracticeError(t('alertNoConnection'));
    } finally {
      setSelectedPracticeLoading(false);
    }
  };

  const therapistHasProfileContent = (therapist) => {
    if (!therapist) return false;
    return Boolean(
      (typeof therapist.bio === 'string' && therapist.bio.trim()) ||
      (Array.isArray(therapist.specializations) && therapist.specializations.length > 0) ||
      (Array.isArray(therapist.behandlungsbereiche) && therapist.behandlungsbereiche.length > 0) ||
      (Array.isArray(therapist.fortbildungen) && therapist.fortbildungen.length > 0) ||
      (Array.isArray(therapist.practices) && therapist.practices.length > 0) ||
      (Array.isArray(therapist.languages) && therapist.languages.length > 0)
    );
  };

  const mapPublicTherapistDetail = (therapist) => mapApiTherapist(therapist);

  const openTherapistById = async (id, fallbackTherapist = null) => {
    blockTherapistEnrichRef.current = false;
    const th = results.find(x => x.id === id)
      || allApiTherapists.find(x => x.id === id)
      || favorites.find(x => x.id === id)
      || selectedPracticeTherapists.find(x => x.id === id)
      || fallbackTherapist;

    if (th) {
      setSelectedTherapist(th);
      // Load slots now — only once; if enrichment reveals a different bookingMode we reload below
      if (th.bookingMode === 'FIRST_APPOINTMENT_REQUEST') loadAvailableSlots(id);
    }

    if (therapistHasProfileContent(th)) return;

    try {
      const response = await fetch(`${getBaseUrl()}/therapist/${id}`, {
        headers: { ...TUNNEL_HEADERS },
      });
      if (!response.ok) return;
      const payload = await response.json();
      const enriched = mapPublicTherapistDetail(payload?.therapist);
      if (!enriched) return;
      if (blockTherapistEnrichRef.current) return;
      setSelectedTherapist(enriched);
      // Only (re)load slots if we didn't already load them for this therapist
      if (enriched.bookingMode === 'FIRST_APPOINTMENT_REQUEST' && availableSlotsTherapistId !== id) {
        loadAvailableSlots(id);
      }
    } catch {}
  };

  const handleAddSlot = async (slot) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ slots: [slot] }),
      });
      if (res.ok) {
        setCreatedSlot(slot);
        setShowSlotCreatedModal(true);
      }
      await loadMySlots(authToken);
    } catch {}
  };

  const handleCancelSlot = async (slotId) => {
    if (!authToken) return;
    try {
      await fetch(`${getBaseUrl()}/therapist/slots/${slotId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      await loadMySlots(authToken);
    } catch {}
  };

  // ── Invite Claim Screen ───────────────────────────────────────────────────

  const handleVisibilityChoice = async (preference) => {
    if (!authToken) return;
    setVisibilityLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/invite/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ visibilityPreference: preference }),
      });
      const data = await res.json().catch(() => ({}));
      setShowVisibilityModal(false);
      if (res.ok) {
        // Refresh profile
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (profileRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await profileRes.json()));

        if (preference === 'visible') {
          if (data.isPublished) {
            Alert.alert(t('alertProfileVisible'), t('alertProfileVisibleBody'));
          } else if (data.missingFields && data.missingFields.length > 0) {
            const fields = data.missingFields.join(', ');
            Alert.alert(
              t('alertProfileIncomplete'),
              t('alertProfileIncompleteBody').replace('{fields}', fields),
              [{ text: t('editProfileAction'), onPress: () => setActiveTab('profile') }, { text: t('laterBtn'), style: 'cancel' }]
            );
          }
        } else {
          Alert.alert(t('alertProfileHidden'), t('alertProfileHiddenBody'));
        }
      } else {
        Alert.alert(t('alertError'), data.message ?? t('alertSettingSaveFail'));
      }
    } catch {
      setShowVisibilityModal(false);
      Alert.alert(t('alertConnectionError'), t('alertConnectionErrorBody'));
    } finally {
      setVisibilityLoading(false);
    }
  };

  const renderInviteClaimScreen = () => (
    <InviteClaimScreen
      loading={inviteClaimLoading}
      error={inviteClaimError}
      claimData={inviteClaimData}
      token={inviteClaimToken}
      onClose={() => { setShowInviteClaim(false); setInviteClaimError(''); }}
      onClaimed={async (token) => {
        await AsyncStorage.setItem('revio_auth_token', token);
        setAuthToken(token);
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (profileRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await profileRes.json()));
        setShowInviteClaim(false);
        setInviteClaimToken(null);
        setInviteClaimData(null);
        setShowVisibilityModal(true);
      }}
      c={c} t={t} styles={styles}
    />
  );
  const handleBottomTabPress = (tabKey) => {
    setSelectedPractice(null);
    setSelectedTherapist(null);
    if (tabKey !== 'profile') {
      setShowLogin(false);
      setShowRegister(false);
      setShowInviteClaim(false);
    }
    if (tabKey === 'discover') {
      setQuery('');
      setActiveChip(null);
      setResults([]);
      setSearched(false);
      setShowAutocomplete(false);
      setShowFilters(false);
      setViewMode('list');
    }
    setActiveTab(tabKey);
  };

  const handleTherapistCancelConfirm = async () => {
    setShowTherapistCancelModal(false);
    setTherapistDetailBooking(null);
    if (!therapistCancelBookingId) { setTherapistCancelBookingId(null); return; }
    const res = await fetch(`${getBaseUrl()}/bookings/${therapistCancelBookingId}/therapist-cancel`, {
      method: 'PATCH',
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) { loadIncomingBookings(authToken); loadMySlots(authToken); }
    else Alert.alert('Fehler', 'Stornierung fehlgeschlagen. Bitte erneut versuchen.');
    setTherapistCancelBookingId(null);
  };

  const handlePhotoPromptGoToProfile = async () => {
    setShowPhotoPrompt(false);
    await AsyncStorage.setItem('revio_photo_prompt_dismissed', '1');
    setActiveTab('profile');
  };

  const handlePhotoPromptDismiss = async () => {
    setShowPhotoPrompt(false);
    await AsyncStorage.setItem('revio_photo_prompt_dismissed', '1');
  };

  const handleTherapistRegistered = async (token) => {
    await AsyncStorage.setItem('revio_auth_token', token);
    await AsyncStorage.setItem('revio_account_type', 'therapist');
    setAuthToken(token);
    setAccountType('therapist');
    const profileRes = await fetch(`${getBaseUrl()}/auth/me`, { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` } });
    if (profileRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await profileRes.json()));
    loadFavorites(token);
    loadIncomingBookings(token);
    setShowRegister(false);
  };

  const handlePatientSignedUp = async (token) => {
    await AsyncStorage.setItem('revio_auth_token', token);
    await AsyncStorage.setItem('revio_account_type', 'patient');
    setAuthToken(token);
    setAccountType('patient');
    const profileRes = await fetch(`${getBaseUrl()}/auth/me`, { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` } });
    if (profileRes.ok) setLoggedInPatient(await profileRes.json());
    loadFavorites(token);
    loadMyAppointments(token);
    setShowPatientSignup(false);
  };

  const renderTherapyTab = () => {
    if (selectedAppointment) {
      return (
        <AppointmentDetail
          appointment={selectedAppointment}
          onBack={() => setSelectedAppointment(null)}
          onOpenTherapist={openTherapistById}
          onCancelRequest={() => setShowCancelAppointmentModal(true)}
          c={c} t={t} styles={styles}
        />
      );
    }
    if (accountType === 'patient') {
      return (
        <TherapyTabPatient
          myAppointments={myAppointments}
          myAppointmentsLoading={myAppointmentsLoading}
          activeFilterPatient={activeFilterPatient}
          setActiveFilterPatient={setActiveFilterPatient}
          therapyRefreshing={therapyRefreshing}
          appointmentsLastLoadedAt={appointmentsLastLoadedAt}
          notifications={notifications}
          dismissedNotifIds={dismissedNotifIds}
          onShowNotifications={() => setShowNotifications(true)}
          onRefresh={handleTherapyRefresh}
          onOpenTherapistById={openTherapistById}
          onSelectAppointment={setSelectedAppointment}
          c={c} t={t} styles={styles}
        />
      );
    }
    if (accountType === 'therapist') {
      return (
        <TherapyTabTherapist
          authToken={authToken}
          mySlots={mySlots}
          slotsLoading={slotsLoading}
          incomingBookings={incomingBookings}
          incomingBookingsLoading={incomingBookingsLoading}
          deletingSlotIds={deletingSlotIds}
          activeFilterTherapist={activeFilterTherapist}
          setActiveFilterTherapist={setActiveFilterTherapist}
          therapyRefreshing={therapyRefreshing}
          slotsLastLoadedAt={slotsLastLoadedAt}
          incomingBookingsLastLoadedAt={incomingBookingsLastLoadedAt}
          onRefresh={handleTherapyRefresh}
          onLoadMySlots={loadMySlots}
          onLoadIncomingBookings={loadIncomingBookings}
          onOpenTherapistById={openTherapistById}
          notifications={notifications}
          dismissedNotifIds={dismissedNotifIds}
          onShowNotifications={() => setShowNotifications(true)}
          onCancelSlot={handleCancelSlot}
          onTherapistCancelRequest={(bookingId) => { setTherapistCancelBookingId(bookingId); setShowTherapistCancelModal(true); }}
          onSelectTherapistDetailBooking={setTherapistDetailBooking}
          setShowSlotComposerModal={setShowSlotComposerModal}
          loggedInTherapist={loggedInTherapist}
          c={c} t={t} styles={styles}
        />
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <TabHeader c={c} title="Meine Termine" />
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20, paddingTop: SPACE.sm }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="calendar-outline" size={32} color={c.muted} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>{t('therapyLoginRequired') ?? 'Hier kannst du deine Termine sehen'}</Text>
            <Text style={[styles.emptyBody, { color: c.muted }]}>{t('therapyLoginRequiredBody') ?? 'Dafür musst du dich registrieren oder anmelden.'}</Text>
            <Pressable onPress={() => { setActiveTab('profile'); setShowLogin(true); }} style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 16, paddingHorizontal: 32 }]}>
              <Text style={styles.registerBtnText}>{t('loginAction')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderFavoritesTab = () => (
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
      setActiveTab={setActiveTab}
      setShowLogin={setShowLogin}
      styles={styles}
      c={c} t={t}
    />
  );

  const renderProfileTab = () => {
    const hasBadge = notifications.filter(n => !dismissedNotifIds.has(n.id)).length > 0;
    if (loggedInPatient) {
      return (
        <View style={{ flex: 1 }}>
          <TabHeader c={c} title="Mein Profil" onBellPress={() => setShowNotifications(true)} hasBadge={hasBadge} />
          <PatientDashboardScreen c={c} t={t} styles={styles} loggedInPatient={loggedInPatient} authToken={authToken} favorites={favorites} myAppointments={myAppointments} onOpenTherapist={openTherapistById} onProfileSaved={handlePatientProfileSaved} />
        </View>
      );
    }
    if (showEmailVerify) {
      return (
        <EmailVerifyScreen
          status={emailVerifyStatus}
          error={emailVerifyError}
          onCancel={() => { setShowEmailVerify(false); setEmailVerifyStatus('idle'); setEmailVerifyError(''); }}
          c={c} t={t} styles={styles}
        />
      );
    }
    if (loggedInTherapist) {
      return (
        <View style={{ flex: 1 }}>
          <TabHeader c={c} title="Mein Profil" onBellPress={() => setShowNotifications(true)} hasBadge={hasBadge} />
          <TherapistDashboardScreen c={c} t={t} styles={styles} certificationOptions={certificationOptions} onOpenTherapyTab={() => setActiveTab('therapy')} onAddSlot={handleAddSlot} onProfileSaved={openProfileSavedModal} />
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <TabHeader c={c} wordmark />
        <View style={{ flex: 1 }}>
          {showLogin ? (
            <LoginScreen c={c} onClose={() => setShowLogin(false)} styles={styles} t={t} />
          ) : showRegister ? (
            <TherapistRegistrationFlow
              visible={showRegister}
              onClose={() => setShowRegister(false)}
              onRegistered={handleTherapistRegistered}
              c={c} t={t} styles={styles}
            />
          ) : showPatientSignup ? (
            <PatientSignupFlow
              visible={showPatientSignup}
              onClose={() => setShowPatientSignup(false)}
              onSignedUp={handlePatientSignedUp}
              onShowLogin={() => { setShowPatientSignup(false); setShowLogin(true); }}
              onSelectTherapist={() => { setShowPatientSignup(false); setShowRegister(true); }}
              c={c} t={t} styles={styles}
            />
          ) : (
            <TherapistLandingScreen
              __DEV__={__DEV__}
              c={c}
              setShowLogin={setShowLogin}
              setShowSignup={openSignupFlow}
              styles={styles}
              t={t}
            />
          )}
        </View>
      </View>
    );
  };

  const renderOptionsTab = () => (
    <OptionsScreen
      loggedInTherapist={loggedInTherapist}
      loggedInPatient={loggedInPatient}
      accountType={accountType}
      themeMode={themeMode}
      setThemeMode={setThemeMode}
      notifications={notifications}
      dismissedNotifIds={dismissedNotifIds}
      onShowNotifications={() => setShowNotifications(true)}
      onShowLogin={() => { setShowLogin(true); setActiveTab('profile'); }}
      onShowRegister={() => setShowRegister(true)}
      onShowFeedback={openFeedbackModal}
      onShowChangePassword={() => setShowChangePasswordModal(true)}
      onDeleteAccount={() => setShowDeleteAccountModal(true)}
      onNavigateToProfile={() => setActiveTab('profile')}
      onLogout={handleLogout}
      onShowDebug={() => setShowDebugScreen(true)}
      c={c} t={t} styles={styles}
    />
  );

  const renderDiscoverTab = () => (
    <DiscoverScreen
      HeartButton={ThemedHeartButton}
      SkeletonCard={SkeletonCard}
      acSuggestions={acSuggestions}
      activeChip={activeChip}
      activeFilterCount={activeFilterCount}
      authToken={authToken}
      c={c}
      callPhone={(phone) => callPhone(phone, t)}
      certificationOptions={certificationOptions}
      city={city}
      discoverScrollRef={discoverScrollRef}
      dismissedNotifIds={dismissedNotifIds}
      fortbildungen={fortbildungen}
      gender={gender}
      getMapRegion={getMapRegion}
      homeVisit={homeVisit}
      isFavorite={isFavorite}
      kassenart={kassenart}
      locationLabel={locationLabel}
      mapScrollEnabled={mapScrollEnabled}
      mapTherapists={mapTherapists}
      notifications={notifications}
      openTherapistById={openTherapistById}
      query={query}
      requestableOnly={requestableOnly}
      results={results}
      runSearch={runSearch}
      runSearchWith={runSearchWith}
      searched={searched}
      searchLoading={searchLoading}
      searchRadius={searchRadius}
      selectChip={selectChip}
      selectSuggestion={selectSuggestion}
      setActiveChip={setActiveChip}
      setFortbildungen={setFortbildungen}
      setGender={setGender}
      setHomeVisit={setHomeVisit}
      setKassenart={setKassenart}
      setLocationSheetCity={setLocationSheetCity}
      setMapScrollEnabled={setMapScrollEnabled}
      setQuery={setQuery}
      setRequestableOnly={setRequestableOnly}
      setShowAutocomplete={setShowAutocomplete}
      setShowFilters={setShowFilters}
      setShowLocationSheet={setShowLocationSheet}
      setShowNotifications={setShowNotifications}
      setSearchRadius={setSearchRadius}
      setViewMode={setViewMode}
      showAutocomplete={showAutocomplete}
      showFilters={showFilters}
      styles={styles}
      t={t}
      toggleFavorite={toggleFavorite}
      toggleFortbildung={toggleFortbildung}
      userCoords={userCoords}
      viewMode={viewMode}
    />
  );

  const renderTab = () => {
    if (selectedTherapist) {
      return (
        <TherapistProfileScreen
          HeartButton={ThemedHeartButton}
          c={c}
          callPhone={(phone) => callPhone(phone, t)}
          isFavorite={isFavorite}
          openPractice={openPractice}
          setSelectedTherapist={setSelectedTherapist}
          styles={styles}
          t={t}
          th={selectedTherapist}
          toggleFavorite={toggleFavorite}
          authToken={authToken}
          accountType={accountType}
          availableSlots={availableSlotsTherapistId === selectedTherapist?.id ? availableSlots : []}
          onBookingRequest={(therapist) => {
            if (!authToken) {
              setBookingTargetTherapist(therapist);
              setSelectedTherapist(null);
              setActiveTab('profile');
              setShowLogin(true);
              return;
            }
            if (therapist) {
              setBookingTargetTherapist(therapist);
              loadAvailableSlots(therapist.id);
              setShowBookingForm(true);
            }
          }}
        />
      );
    }
    if (activeTab === 'therapy') return renderTherapyTab();
    if (activeTab === 'favorites') return renderFavoritesTab();
    if (activeTab === 'profile') return renderProfileTab();
    if (activeTab === 'options') return renderOptionsTab();
    return renderDiscoverTab();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      {/* ── Favoriten-Toast ──────────────────────────────────────────────────── */}
      <ToastOverlay message={toastMsg} anim={toastAnim} c={c} />

      {/* ── Notification Sheet ──────────────────────────────────────────────── */}
      <ResetPasswordModal
        visible={showResetPassword}
        token={resetPasswordToken}
        onClose={() => setShowResetPassword(false)}
        onDone={() => setShowLogin(true)}
        c={c}
      />

      <Modal visible={showBookingForm} animationType="slide" onRequestClose={() => { setShowBookingForm(false); setBookingTargetTherapist(null); }}>
        <View style={{ flex: 1, backgroundColor: c.background }}>
          {showBookingForm && bookingTargetTherapist && (
            <BookingRequestForm
              c={c}
              t={t}
              therapist={bookingTargetTherapist}
              authToken={authToken}
              availableSlots={availableSlotsTherapistId === bookingTargetTherapist?.id ? availableSlots : []}
              slotsLoading={availableSlotsLoading}
              onSuccess={() => {
                blockTherapistEnrichRef.current = true;
                setShowBookingForm(false);
                setBookingTargetTherapist(null);
                setAvailableSlots([]);
                setSelectedTherapist(null);
                setSelectedAppointment(null);
                loadMyAppointments(authToken);
                setActiveTab('therapy');
              }}
              onClose={() => {
                setShowBookingForm(false);
                setBookingTargetTherapist(null);
                setAvailableSlots([]);
              }}
              onReloadSlots={() => {
                if (bookingTargetTherapist?.id) loadAvailableSlots(bookingTargetTherapist.id);
              }}
            />
          )}
        </View>
      </Modal>

      <FeedbackModal
        visible={showFeedbackModal}
        onClose={closeFeedbackModal}
        authToken={authToken}
        authenticatedEmail={loggedInPatient?.email ?? loggedInTherapist?.email ?? ''}
        c={c} t={t}
      />

      <NotificationSheet
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        dismissedNotifIds={dismissedNotifIds}
        dismissNotification={dismissNotification}
        dismissAllNotifications={dismissAllNotifications}
        onPressNotification={handleNotificationPress}
        c={c} t={t}
      />

      <ReviewNotificationModal
        visible={showReviewNotificationModal}
        notification={reviewNotification}
        onDone={markReviewNotificationSeen}
        c={c} t={t}
      />

      <VisibilityModal
        visible={showVisibilityModal}
        onClose={() => setShowVisibilityModal(false)}
        onChoice={handleVisibilityChoice}
        loading={visibilityLoading}
        c={c} t={t}
      />

      <ProfileSavedModal
        visible={showProfileSavedModal}
        onClose={closeProfileSavedModal}
        title={profileSavedModalTitle}
        body={profileSavedModalBody}
        c={c} t={t}
      />

      <SlotCreatedModal
        visible={showSlotCreatedModal}
        onClose={() => setShowSlotCreatedModal(false)}
        slot={createdSlot}
        c={c}
      />

      <CancelAppointmentModal
        visible={showCancelAppointmentModal}
        onClose={() => setShowCancelAppointmentModal(false)}
        onConfirm={async () => {
          setShowCancelAppointmentModal(false);
          await handleCancelSelectedAppointment();
        }}
        appointment={selectedAppointment}
        c={c}
      />

      <TherapistCancelModal
        visible={showTherapistCancelModal}
        onClose={() => { setShowTherapistCancelModal(false); setTherapistDetailBooking(null); setTherapistCancelBookingId(null); }}
        onConfirm={handleTherapistCancelConfirm}
        booking={therapistDetailBooking}
        c={c}
      />

      <SlotComposerModal
        visible={showSlotComposerModal}
        onClose={() => setShowSlotComposerModal(false)}
        onAddSlot={(slot) => { handleAddSlot(slot); setShowSlotComposerModal(false); }}
        c={c}
      />

      <LocationSheet
        visible={showLocationSheet}
        onClose={() => setShowLocationSheet(false)}
        locationSheetCity={locationSheetCity}
        onChangeCity={fetchLocationSuggestions}
        onConfirm={handleLocationSheetManual}
        locationSuggestions={locationSuggestions}
        onSelectSuggestion={selectLocationSuggestion}
        locationLoading={locationLoading}
        searchRadius={searchRadius}
        onRadiusChange={setSearchRadius}
        onGPS={handleLocationSheetGPS}
        c={c} t={t}
      />

      <PhotoPromptModal
        visible={showPhotoPrompt}
        onGoToProfile={handlePhotoPromptGoToProfile}
        onDismiss={handlePhotoPromptDismiss}
        c={c} t={t}
      />

      {/* ── Passwort ändern Modal ────────────────────────────────────────────── */}
      <ChangePasswordModal
        visible={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        authToken={authToken}
        c={c} t={t}
      />

      <AuthDebugScreen
        visible={showDebugScreen}
        onClose={() => setShowDebugScreen(false)}
        authContext={{ authToken, accountType, bootReady, loggedInPatient, loggedInTherapist }}
        c={c}
      />

      {/* ── Konto löschen Modal ──────────────────────────────────────────────── */}
      <DeleteAccountModal
        visible={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        onConfirmed={deleteAccountConfirmed}
        loggedInTherapist={loggedInTherapist}
        loggedInPatient={loggedInPatient}
        c={c} t={t}
      />

      <View style={styles.rootLayout}>
        <View style={styles.appFrame}>
          {renderTab()}
          {/* ── Globale Notification-Glocke ───────────────────────────────── */}
          {authToken && !selectedTherapist && !showBookingForm && activeTab === 'discover' && (
            <NotificationBell
              onPress={() => setShowNotifications(true)}
              badgeCount={notifications.filter((n) => !dismissedNotifIds.has(n.id)).length}
              c={c}
            />
          )}
        </View>

        {/* Bottom nav */}
        <MobileBottomNav
          tabs={tabs}
          activeTab={activeTab}
          onTabPress={handleBottomTabPress}
          c={c}
          t={t}
          badgeCount={notifications.filter((n) => !dismissedNotifIds.has(n.id)).length}
          showBadge={!!loggedInTherapist}
        />
      </View>
    </SafeAreaView>
  );
}

