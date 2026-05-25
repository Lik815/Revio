import React, { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
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
import { SkeletonCard } from '../components/SkeletonCard';
import { TabHeader } from '../components/TabHeader';
import { useTheme } from '../hooks/use-theme';
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
const BOTTOM_NAV_HEIGHT = 86;


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
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showPatientName, setShowPatientName] = useState(false);


  // Auth — from AuthContext
  const {
    authToken, setAuthToken,
    loggedInTherapist, setLoggedInTherapist,
    loggedInPatient, setLoggedInPatient,
    accountType, setAccountType,
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
    setShowRoleSelect(true);
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


  const handlePickRegistrationDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!validateDocumentSize(asset, t)) return;
      setRegDocument(asset);
    } catch {
      Alert.alert(t('alertConnectionError'), t('alertConnectionErrorBody'));
    }
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

  const renderTab = () => {
    const hasBadge = notifications.filter(n => !dismissedNotifIds.has(n.id)).length > 0;

    if (activeTab === 'therapy' && selectedAppointment) {
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

    if (activeTab === 'therapy') {
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
              <Text style={[styles.emptyTitle, { color: c.text }]}>{t('favoritesLoginRequired') ?? 'Einloggen erforderlich'}</Text>
              <Text style={[styles.emptyBody, { color: c.muted }]}>Melde dich an, um deine Termine zu sehen.</Text>
              <Pressable onPress={() => { setActiveTab('profile'); setShowLogin(true); }} style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 16, paddingHorizontal: 32 }]}>
                <Text style={styles.registerBtnText}>{t('loginAction')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      );
    }

    if (activeTab === 'favorites') {
      return (
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
    }

    if (activeTab === 'profile') {
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
              <LoginScreen
                c={c}
                onClose={() => setShowLogin(false)}
                styles={styles}
                t={t}
              />
            ) : showRegister ? (
              <TherapistRegistrationFlow
                visible={showRegister}
                onClose={() => setShowRegister(false)}
                onRegistered={async (token) => {
                  await AsyncStorage.setItem('revio_auth_token', token);
                  await AsyncStorage.setItem('revio_account_type', 'therapist');
                  setAuthToken(token);
                  setAccountType('therapist');
                  const profileRes = await fetch(`${getBaseUrl()}/auth/me`, { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` } });
                  if (profileRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await profileRes.json()));
                  loadFavorites(token);
                  loadIncomingBookings(token);
                  setShowRegister(false);
                }}
                c={c} t={t} styles={styles}
              />
            ) : (showRoleSelect || showSignup || showPatientName) ? (
              <PatientSignupFlow
                visible={showRoleSelect || showSignup || showPatientName}
                onClose={() => { setShowRoleSelect(false); setShowSignup(false); setShowPatientName(false); }}
                onSignedUp={async (token) => {
                  await AsyncStorage.setItem('revio_auth_token', token);
                  await AsyncStorage.setItem('revio_account_type', 'patient');
                  setAuthToken(token);
                  setAccountType('patient');
                  const profileRes = await fetch(`${getBaseUrl()}/auth/me`, { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` } });
                  if (profileRes.ok) setLoggedInPatient(await profileRes.json());
                  loadFavorites(token);
                  loadMyAppointments(token);
                  setShowRoleSelect(false);
                }}
                onShowLogin={() => { setShowRoleSelect(false); setShowSignup(false); setShowPatientName(false); setShowLogin(true); }}
                onSelectTherapist={() => { setShowRoleSelect(false); setShowSignup(false); setShowPatientName(false); setShowRegister(true); }}
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
    }

    if (activeTab === 'options') {
      return (
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
          c={c} t={t} styles={styles}
        />
      );
    }

    return (
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
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      {/* ── Favoriten-Toast ──────────────────────────────────────────────────── */}
      {toastMsg && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 52,
            left: 16,
            right: 16,
            zIndex: 9999,
            transform: [{ translateY: toastAnim }],
          }}
          pointerEvents="none"
        >
          <View style={{
            backgroundColor: c.text,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 8,
          }}>
            <Text style={{ color: c.background, fontSize: 14, fontWeight: '600', flex: 1 }}>{toastMsg}</Text>
          </View>
        </Animated.View>
      )}

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
        onConfirm={async () => {
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
        }}
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
        onGoToProfile={async () => {
          setShowPhotoPrompt(false);
          await AsyncStorage.setItem('revio_photo_prompt_dismissed', '1');
          setActiveTab('profile');
        }}
        onDismiss={async () => {
          setShowPhotoPrompt(false);
          await AsyncStorage.setItem('revio_photo_prompt_dismissed', '1');
        }}
        c={c} t={t}
      />

      {/* ── Passwort ändern Modal ────────────────────────────────────────────── */}
      <ChangePasswordModal
        visible={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        authToken={authToken}
        c={c} t={t}
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
          {authToken && !selectedTherapist && !showBookingForm && activeTab !== 'therapy' && (
            <Pressable
              onPress={() => setShowNotifications(true)}
              style={{
                position: 'absolute',
                top: 12,
                right: 16,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                elevation: 10,
              }}
            >
              <Ionicons name="notifications-outline" size={18} color={c.text} />
              {notifications.filter((n) => !dismissedNotifIds.has(n.id)).length > 0 && (
                <View style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: c.error }} />
              )}
            </Pressable>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  rootLayout: { flex: 1, position: 'relative' },
  appFrame: { flex: 1, overflow: 'hidden', paddingBottom: BOTTOM_NAV_HEIGHT },
  scrollContent: { padding: SPACE.xl, gap: SPACE.lg },

  hero: { paddingTop: SPACE.sm, paddingBottom: SPACE.xs, gap: SPACE.sm },
  heroTitle: { ...TYPE.xl },
  heroSub: { ...TYPE.body },

  authBrandWordmark: { ...TYPE.lg, marginLeft: 4, letterSpacing: 0.4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingBottom: SPACE.xs,
    width: '100%',
    minHeight: 48,
    alignSelf: 'stretch',
  },
  logoMark: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', lineHeight: 20 },
  brandName: { ...TYPE.lg, letterSpacing: 3, marginLeft: 4 },
  logoContainer: { backgroundColor: COLORS.light.primary, padding: SPACE.md, borderRadius: RADIUS.md },
  logoImage: { width: 80, height: 80, resizeMode: 'contain' },
  headerTitle: { ...TYPE.lg },
  headerSub: { ...TYPE.meta, marginTop: 1 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingLeft: 14,
    paddingRight: 4,
    height: 52,
    gap: 10,
    ...SHADOW.card,
  },
  searchInput: { flex: 1, fontSize: TYPE.body.fontSize, fontWeight: TYPE.body.fontWeight },
  searchDivider: { width: 1, height: 24, opacity: 0.5 },
  searchFilterArea: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 44,
    justifyContent: 'center',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
  },

  autocompleteBox: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    marginTop: -4,
    paddingTop: 4,
    overflow: 'hidden',
  },
  acItem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44 },
  acSearchIcon: { ...TYPE.meta },
  acItemText: { ...TYPE.body },

  chipsRow: { gap: SPACE.sm, paddingVertical: 2 },
  chip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { ...TYPE.meta },

  filterRow: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'center' },
  cityInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 44,
    ...TYPE.body,
  },
  filterBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnText: { ...TYPE.meta },
  goBtn: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  goBtnText: { ...TYPE.heading, color: '#FFFFFF' },

  filterPanel: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE.lg, gap: SPACE.md },
  filterCompactPanel: { padding: SPACE.md, gap: SPACE.md },
  filterPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  filterCompactHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  filterCompactTitle: { ...TYPE.heading },
  filterSectionBlock: { gap: SPACE.sm },
  filterSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  filterSectionTitle: { ...TYPE.label, marginBottom: 10 },
  filterCompactSection: { gap: SPACE.sm },
  filterCompactSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  filterCompactSectionTitle: { ...TYPE.label },
  filterResetBtn: {
    minHeight: 30,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterResetBtnText: { ...TYPE.meta },
  filterChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  kassenartCompactToggle: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  kassenartCompactToggleBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  kassenartCompactToggleText: { ...TYPE.meta },
  filterCompactChip: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  filterCompactChipText: { ...TYPE.meta },
  filterSearchField: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterSearchInput: { flex: 1, ...TYPE.meta, paddingVertical: 0 },
  filterSearchResults: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  filterSearchResultItem: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
  },
  filterSearchResultText: { ...TYPE.meta, flex: 1 },
  filterSelectedChip: {
    maxWidth: '100%',
    minHeight: 34,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterSelectedChipText: { ...TYPE.meta, maxWidth: 220 },
  filterEmptyText: { ...TYPE.meta },
  sectionBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap', marginBottom: 6 },
  inlineMetaPill: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  inlineMetaPillText: { ...TYPE.label, fontSize: 11, lineHeight: 11 },
  metaNote: { ...TYPE.meta },
  optionalInlineLabel: { fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: 11, lineHeight: 14 },
  collapseToggle: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  kassenartRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  kassenartBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
  },
  kassenartText: { ...TYPE.meta },
  kassenartToggleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  kassenartToggleCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
  },
  kassenartToggleText: { ...TYPE.meta, flex: 1 },
  kassenartToggleCheck: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTile: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  filterTileIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTileTitle: { ...TYPE.heading },
  filterTileMeta: { ...TYPE.meta },
  filterTileCheck: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedFiltersRow: { gap: SPACE.sm, paddingVertical: 2, paddingRight: SPACE.sm },
  selectedFilterChip: {
    maxWidth: 220,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedFilterChipText: { ...TYPE.meta, flexShrink: 1 },
  multiSelectList: { gap: SPACE.sm },
  multiSelectOption: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  multiSelectOptionText: { ...TYPE.body, flex: 1 },
  multiSelectCheck: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterMoreBtn: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACE.md,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  filterMoreBtnText: { ...TYPE.meta },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: 8, minHeight: 44 },
  checkbox: { width: 22, height: 22, borderRadius: RADIUS.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#FFFFFF', ...TYPE.label, fontSize: 12, lineHeight: 12, letterSpacing: 0, textTransform: 'none' },
  checkLabel: { ...TYPE.body, flex: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  switchTitle: { ...TYPE.body, fontWeight: '600', marginBottom: 2 },
  switchLabel: { ...TYPE.meta },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACE.sm },
  sectionLabel: { ...TYPE.heading },
  approvedPill: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  approvedPillText: { ...TYPE.meta },
  metaPill: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  metaPillText: { ...TYPE.meta },

  resultCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 18, gap: 14, ...SHADOW.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  avatar: { width: 56, height: 56, borderRadius: RADIUS.full },
  cardName: { ...TYPE.heading, marginBottom: 2 },
  cardTitle: { ...TYPE.meta },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { ...TYPE.meta },
  practiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    minHeight: 56,
  },
  practiceInitial: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceInitialText: { ...TYPE.heading, fontWeight: '700' },
  practiceName: { ...TYPE.body, fontWeight: '600' },
  practiceCity: { ...TYPE.meta, marginTop: 1 },
  practiceArrow: { fontSize: 18 },
  filterIconBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconText: { fontSize: 20 },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { ...TYPE.label, color: '#FFFFFF', fontSize: 11, lineHeight: 11, letterSpacing: 0, textTransform: 'none' },
  distBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6 },
  distBadgeText: { ...TYPE.meta, fontWeight: '700' },

  backBtn: { paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backBtnText: { ...TYPE.body, fontWeight: '600' },
  practiceHeader: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 20, alignItems: 'center', gap: 6, ...SHADOW.card },
  practiceLogoLarge: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  practiceLogoText: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', lineHeight: 26 },
  practiceLogoCross: { position: 'absolute', top: 8, right: 8, width: 18, height: 18 },
  plusBarH: { position: 'absolute', top: '38%', left: 0, right: 0, height: 5, borderRadius: 3 },
  plusBarV: { position: 'absolute', left: '38%', top: 0, bottom: 0, width: 5, borderRadius: 3 },
  practiceHeaderName: { ...TYPE.lg },
  practiceHeaderCity: { ...TYPE.body },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailIcon: { fontSize: 18 },
  detailText: { ...TYPE.body, flex: 1 },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 14,
  },
  miniAvatar: { width: 44, height: 44, borderRadius: RADIUS.full },

  ctaBtn: { borderRadius: RADIUS.md, paddingVertical: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaBtnText: { ...TYPE.heading, color: '#FFFFFF' },
  ctaBtnSecondary: { borderRadius: RADIUS.md, paddingVertical: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ctaBtnSecondaryText: { ...TYPE.heading },

  emptyState: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.xxl, alignItems: 'center', gap: SPACE.sm },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { ...TYPE.heading },
  emptyBody: { ...TYPE.body, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  emptyActionBtn: { flex: 1, borderRadius: RADIUS.md, paddingVertical: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  emptyActionText: { ...TYPE.meta, fontWeight: '700' },
  emptyInlineState: { borderWidth: 1, borderRadius: RADIUS.md, padding: 14, marginHorizontal: 16, marginTop: 8 },

  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 14,
    width: '100%',
  },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  noticeIcon: { fontSize: 20, marginTop: 1, width: 24, textAlign: 'center' },
  noticeTitle: { ...TYPE.body, fontWeight: '700', marginBottom: 3 },
  noticeBody: { ...TYPE.meta, flex: 1, flexShrink: 1 },
  infoCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 20, gap: 10, ...SHADOW.card },
  infoTitle: { ...TYPE.lg },
  infoBody: { ...TYPE.body },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderBottomWidth: 1,
    paddingBottom: 14,
  },
  stepNum: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#FFFFFF', ...TYPE.body, fontWeight: '700', lineHeight: 18 },
  stepTitle: { ...TYPE.body, fontWeight: '600', marginBottom: 2 },
  stepBody: { ...TYPE.meta },
  registerBtn: { borderRadius: RADIUS.md, paddingVertical: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  registerBtnText: { ...TYPE.heading, color: '#FFFFFF' },
  loginLink: { textAlign: 'center', ...TYPE.body, fontWeight: '600', paddingVertical: 12 },

  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  optionLabel: { ...TYPE.body, fontWeight: '500' },
  optionValue: { ...TYPE.meta },

  therapistAvatarLarge: { width: 80, height: 80, borderRadius: RADIUS.full, marginBottom: 4 },
  therapistAvatarSmall: { width: 40, height: 40 },
  practiceHeaderInitial: { width: 64, height: 64, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  practiceHeaderInitialText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', lineHeight: 24 },
  infoSection: { borderWidth: 1, borderRadius: RADIUS.md, padding: 18, gap: 10, ...SHADOW.card },
  profileName: { ...TYPE.lg },
  therapistName: { ...TYPE.heading },
  therapistTitle: { ...TYPE.meta },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  verifiedBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { ...TYPE.meta, fontWeight: '700' },
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailInfoLabel: { ...TYPE.label },
  detailInfoValue: { ...TYPE.body, marginTop: 1 },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    ...TYPE.body,
    outlineWidth: 0,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    ...TYPE.body,
    outlineWidth: 0,
  },

  themeToggleRow: { flexDirection: 'row', gap: 6 },
  themeBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtnText: { ...TYPE.meta, fontWeight: '600' },

  regProgressRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  regProgressBar: { height: 4, borderRadius: 2, flex: 1 },
  regStepTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  regStepSub: { ...TYPE.body, marginBottom: 4 },
  regInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    fontSize: TYPE.body.fontSize,
    fontWeight: TYPE.body.fontWeight,
    outlineWidth: 0,
  },
  regTextarea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },

  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  previewLabel: { ...TYPE.meta, fontWeight: '600', flex: 1 },
  previewValue: { ...TYPE.meta, flex: 2, textAlign: 'right' },
});
