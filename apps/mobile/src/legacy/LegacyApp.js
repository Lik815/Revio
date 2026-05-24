import React, { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme
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
  fortbildungOptions,
  getBaseUrl,
  TUNNEL_HEADERS,
  haversine,
  mapApiTherapist,
  normalizeLanguageCodes,
  normalizeTherapistProfile,
  softenErrorMessage,
  tabs,
} from '../mobile-utils';
import { DiscoverScreen } from '../mobile-discover-screen';
import {
  PracticeProfileScreen,
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
  TherapistSlotComposer,
} from '../mobile-slot-composer';
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
const REVIEW_NOTIFICATION_TYPES = new Set([
  'PROFILE_APPROVED',
  'PROFILE_CHANGES_REQUESTED',
  'PROFILE_REJECTED',
  'PROFILE_SUSPENDED',
]);
const COMPLIANCE_STATUS_VALUES = ['yes', 'no', 'in_progress'];
const HEALTH_AUTHORITY_STATUS_VALUES = ['yes', 'no', 'in_progress', 'unknown'];

function getReviewNotificationSeenKey(therapistId) {
  return `revio_seen_review_status_${therapistId}`;
}

function getReviewNotificationTitle(notification, t) {
  switch (notification?.type) {
    case 'PROFILE_APPROVED':
      return t('reviewNotificationApprovedTitle');
    case 'PROFILE_CHANGES_REQUESTED':
      return t('reviewNotificationChangesTitle');
    case 'PROFILE_REJECTED':
      return t('reviewNotificationRejectedTitle');
    case 'PROFILE_SUSPENDED':
      return t('reviewNotificationSuspendedTitle');
    default:
      return t('notificationsOption');
  }
}

function normalizeCertificationOption(option) {
  if (typeof option === 'string') {
    const value = option.trim();
    return value ? { key: value, label: value } : null;
  }

  if (!option || typeof option !== 'object') return null;

  const key = typeof option.key === 'string' && option.key.trim()
    ? option.key.trim()
    : typeof option.label === 'string' && option.label.trim()
      ? option.label.trim()
      : '';
  const label = typeof option.label === 'string' && option.label.trim()
    ? option.label.trim()
    : key;

  if (!key || !label) return null;
  return { key, label };
}

function normalizeCertificationOptions(options, fallback = fortbildungOptions) {
  const source = Array.isArray(options) ? options : fallback;
  const seen = new Set();

  return source
    .map(normalizeCertificationOption)
    .filter((option) => {
      if (!option || seen.has(option.key)) return false;
      seen.add(option.key);
      return true;
    });
}

function normalizeAutocompleteSuggestions(groups) {
  if (!Array.isArray(groups)) return [];

  return groups
    .map((group) => {
      const type = typeof group?.type === 'string' && group.type.trim() ? group.type.trim() : 'OTHER';
      const items = Array.isArray(group?.items)
        ? group.items
            .map((item) => {
              const text = typeof item?.text === 'string' ? item.text.trim() : '';
              if (!text) return null;
              return {
                text,
                entityId: typeof item?.entityId === 'string' ? item.entityId : null,
              };
            })
            .filter(Boolean)
        : [];

      if (items.length === 0) return null;
      return { type, items };
    })
    .filter(Boolean);
}

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

function HeartButton({
  isSaved,
  onToggle,
  size = 22,
  savedColor = COLORS.light.saved,
  unsavedColor = COLORS.light.muted,
  hitSlop = ICON_HIT_SLOP,
  style = undefined,
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    const willSave = !isSaved;
    onToggle();
    if (willSave) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.45, useNativeDriver: true, speed: 40, bounciness: 12 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }),
      ]).start();
    }
  };

  return (
    <Pressable onPress={handlePress} hitSlop={hitSlop} style={style}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={isSaved ? 'heart' : 'heart-outline'}
          size={size}
          color={isSaved ? savedColor : unsavedColor}
        />
      </Animated.View>
    </Pressable>
  );
}

function PracticeLogoAvatar({ uri, name, style, c }) {
  const [error, setError] = useState(false);
  const initials = name
    ? (name.split(' ').filter(w => w.length > 2).map(w => w[0]).join('').toUpperCase().slice(0, 2) || name.charAt(0).toUpperCase())
    : '?';
  if (uri && !error) {
    return (
      <Image
        source={{ uri }}
        style={style}
        onError={() => setError(true)}
      />
    );
  }
  return (
    <View style={[style, { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{initials}</Text>
    </View>
  );
}

function SkeletonCard({ C }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: RADIUS.lg,
        padding: 18,
        gap: 14,
        backgroundColor: C.card,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: C.mutedBg }} />
        <View style={{ gap: 8, flex: 1 }}>
          <View style={{ height: 16, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg, width: '55%' }} />
          <View style={{ height: 12, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg, width: '35%' }} />
        </View>
      </View>
      <View style={{ height: 12, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg }} />
      <View style={{ height: 12, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg, width: '70%' }} />
      <View style={{ height: 42, borderRadius: RADIUS.md, backgroundColor: C.mutedBg }} />
    </View>
  );
}

export default function App() {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState(systemScheme === 'dark' ? 'dark' : 'light'); // 'light' | 'dark'
  const scheme = themeMode;
  const c = COLORS[scheme];
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


  // ── Toast notification ────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState(null);
  const toastAnim = useRef(new Animated.Value(-80)).current;
  const toastTimer = useRef(null);
  const showToast = (message) => {
    setToastMsg(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: -80, duration: 250, useNativeDriver: true }).start(() => setToastMsg(null));
    }, 2500);
  };

  const toggleFavorite = async (therapist) => {
    if (!authToken) {
      showToast(t('favLoginRequired') ?? 'Bitte einloggen um Favoriten zu speichern');
      return;
    }
    const exists = favorites.some(f => f.id === therapist.id);
    // Optimistic update
    setFavorites(prev => exists ? prev.filter(f => f.id !== therapist.id) : [...prev, therapist]);
    if (!exists) showToast(t('favSaved').replace('{name}', therapist.fullName));
    else showToast(`${therapist.fullName} ✕`);
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
      else showToast(`${practice.name} ✕`);
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
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingTargetTherapist, setBookingTargetTherapist] = useState(null);
  const blockTherapistEnrichRef = useRef(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
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
          setResetPasswordNew('');
          setResetPasswordConfirm('');
          setResetPasswordError('');
          setResetPasswordDone(false);
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




  // Notification polling
  useEffect(() => {
    if (notificationPollRef.current) clearInterval(notificationPollRef.current);
    if (!authToken) { setNotifications([]); setReviewNotification(null); setShowReviewNotificationModal(false); return; }
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/notifications`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (!res.ok) return;
        const data = await res.json();
        let next = Array.isArray(data.notifications) ? data.notifications : [];
        const reviewNotif = next.find((n) => REVIEW_NOTIFICATION_TYPES.has(n.type) && n.reviewStatus && n.therapistId);
        if (accountType === 'therapist' && reviewNotif?.therapistId) {
          const seenStatus = await AsyncStorage.getItem(getReviewNotificationSeenKey(reviewNotif.therapistId));
          if (seenStatus === reviewNotif.reviewStatus) {
            next = next.filter((n) => n.id !== reviewNotif.id);
          } else {
            setReviewNotification((prev) => prev?.id === reviewNotif.id ? prev : reviewNotif);
            setShowReviewNotificationModal(true);
            setLoggedInTherapist((prev) =>
              prev?.id === reviewNotif.therapistId && prev.reviewStatus !== reviewNotif.reviewStatus
                ? { ...prev, reviewStatus: reviewNotif.reviewStatus } : prev);
          }
        }
        setNotifications(next);
      } catch {}
    };
    AsyncStorage.getItem('revio_dismissed_notif_ids').then((raw) => {
      if (raw) { try { setDismissedNotifIds(new Set(JSON.parse(raw))); } catch {} }
    });
    fetchNotifications();
    notificationPollRef.current = setInterval(fetchNotifications, 30000);
    return () => clearInterval(notificationPollRef.current);
  }, [authToken, accountType]);


  const registerPushToken = async (token) => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
      await fetch(`${getBaseUrl()}/auth/push-token`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expoPushToken }),
      });
    } catch { /* best-effort */ }
  };


  const handleLogin = async () => {
    setLoginError('');
    setLoginNotice('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.message ?? t('alertInvalidCredentials'));
        return;
      }
      const data = await res.json();
      // Auth V2 returns accessToken, legacy returns token
      const token = data.accessToken || data.token;
      await AsyncStorage.setItem('revio_auth_token', token);
      setAuthToken(token);

      const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        loadFavorites(token);
        if (profile.role === 'patient') {
          await AsyncStorage.setItem('revio_account_type', 'patient');
          setAccountType('patient');
          setLoggedInPatient(profile);
          loadMyAppointments(token);
          registerPushToken(token);
          setShowLogin(false);
          setLoginEmail('');
          setLoginPassword('');
          // Nach Login direkt zum Booking wenn ein Therapeut vorgemerkt war
          if (bookingTargetTherapist) {
            loadAvailableSlots(bookingTargetTherapist.id).then(() => setShowBookingForm(true));
          }
          return;
        }
        // Therapist account
        await AsyncStorage.setItem('revio_account_type', 'therapist');
        setAccountType('therapist');
        const therapistProfile = normalizeTherapistProfile(profile);
        setLoggedInTherapist(therapistProfile);
        loadIncomingBookings(token);
        registerPushToken(token);
        if (!therapistProfile.photo) {
          const dismissed = await AsyncStorage.getItem('revio_photo_prompt_dismissed');
          if (!dismissed) setShowPhotoPrompt(true);
        }
      }
      setShowLogin(false);
      setLoginEmail('');
      setLoginPassword('');
    } catch {
      setLoginError(t('alertConnectionError') + '. ' + t('alertConnectionErrorBody'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = loginEmail.trim();
    setLoginError('');
    setLoginNotice('');

    if (!email) {
      setLoginError(t('forgotPasswordEmailMissing'));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError(t('forgotPasswordEmailInvalid'));
      return;
    }

    setForgotPasswordLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.message ?? t('alertConnectionError'));
        return;
      }

      setLoginNotice(t('forgotPasswordSent'));
    } catch {
      setLoginError(t('alertConnectionError') + '. ' + t('alertConnectionErrorBody'));
    } finally {
      setForgotPasswordLoading(false);
    }
  };

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

  const dismissNotification = async (id) => {
    const next = new Set(dismissedNotifIds);
    next.add(id);
    setDismissedNotifIds(next);
    await AsyncStorage.setItem('revio_dismissed_notif_ids', JSON.stringify([...next]));
  };

  const dismissAllNotifications = async () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setDismissedNotifIds(allIds);
    await AsyncStorage.setItem('revio_dismissed_notif_ids', JSON.stringify([...allIds]));
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

  const markReviewNotificationSeen = async (notification = reviewNotification) => {
    if (notification?.therapistId && notification?.reviewStatus) {
      await AsyncStorage.setItem(
        getReviewNotificationSeenKey(notification.therapistId),
        notification.reviewStatus,
      );
    }
    setNotifications((prev) => prev.filter((item) => item.id !== notification?.id));
    setShowReviewNotificationModal(false);
    setReviewNotification(null);
  };

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

  // Search state
  const [query, setQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeChip, setActiveChip] = useState(null);
  const [city, setCity] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [homeVisit, setHomeVisit] = useState(false);
  const [kassenart, setKassenart] = useState(null);
  const [gender, setGender] = useState(null);
  const [requestableOnly, setRequestableOnly] = useState(false);
  const [fortbildungen, setFortbildungen] = useState([]);
  const [certificationOptions, setCertificationOptions] = useState(() => normalizeCertificationOptions(fortbildungOptions));
  const [searchRadius, setSearchRadius] = useState(5);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allApiTherapists, setAllApiTherapists] = useState([]);

  const [searched, setSearched] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [mapScrollEnabled, setMapScrollEnabled] = useState(true);
  const discoverScrollRef = React.useRef(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const openFeedbackModal = () => setShowFeedbackModal(true);
  const closeFeedbackModal = () => setShowFeedbackModal(false);
  // Notifications — from NotifContext (inline in render)
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotifIds, setDismissedNotifIds] = useState(new Set());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showReviewNotificationModal, setShowReviewNotificationModal] = useState(false);
  const [reviewNotification, setReviewNotification] = useState(null);
  const notificationPollRef = React.useRef(null);
  const [locationLabel, setLocationLabel] = useState(''); // display: "Hauptstraße 5, München"
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [showSlotComposerModal, setShowSlotComposerModal] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);
  const [locationSheetCity, setLocationSheetCity] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const locationDebounceRef = React.useRef(null);
  const pendingGPSResult = React.useRef(null); // stores { city, coords, label } from GPS detection

  // ── API-powered autocomplete ──────────────────────────────────────────────
  const [acSuggestions, setAcSuggestions] = useState([]);   // [{ type, items: [{ text, entityId }] }]
  const acDebounceRef = React.useRef(null);
  const acAbortRef = React.useRef(null);

  useEffect(() => {
    if (query.length < 2) { setAcSuggestions([]); return; }

    if (acDebounceRef.current) clearTimeout(acDebounceRef.current);
    acDebounceRef.current = setTimeout(async () => {
      // Abort previous in-flight request
      if (acAbortRef.current) acAbortRef.current.abort();
      const controller = new AbortController();
      acAbortRef.current = controller;

      try {
        const res = await fetch(
          `${getBaseUrl()}/suggest?q=${encodeURIComponent(query)}`,
          { headers: TUNNEL_HEADERS, signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAcSuggestions(normalizeAutocompleteSuggestions(data?.suggestions));
      } catch (err) {
        if (err.name !== 'AbortError') setAcSuggestions([]);
      }
    }, 200);

    return () => {
      if (acDebounceRef.current) clearTimeout(acDebounceRef.current);
    };
  }, [query]);

  const activeFilterCount = (homeVisit ? 1 : 0) + (kassenart ? 1 : 0) + (gender ? 1 : 0) + fortbildungen.length + (requestableOnly ? 1 : 0);
  const getCertificationLabel = (key) => certificationOptions.find((option) => option.key === key)?.label ?? key;

  const toggleFortbildung = (key) => {
    setFortbildungen(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  useEffect(() => {
    let cancelled = false;

    const loadCertificationOptions = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/config/options`, {
          headers: TUNNEL_HEADERS,
        });
        if (!res.ok) return;
        const data = await res.json();
        const nextOptions = normalizeCertificationOptions(data?.certifications, fortbildungOptions);
        if (!cancelled && nextOptions.length > 0) {
          setCertificationOptions(nextOptions);
        }
      } catch {}
    };

    loadCertificationOptions();
    return () => { cancelled = true; };
  }, []);

  // Auto-refresh search when filters change (only if a search has already been run)
  const searchedRef = React.useRef(false);
  useEffect(() => { searchedRef.current = searched; }, [searched]);
  useEffect(() => {
    if (!searchedRef.current) return;
    runSearchWith(query, userCoords);
  }, [homeVisit, kassenart, gender, fortbildungen]);

  // Radius changes should trigger a fresh nearby search when an origin is active,
  // otherwise widening the radius would never load new results from the backend.
  useEffect(() => {
    if (!searchedRef.current) return;
    if (userCoords) {
      runSearchWith(query, userCoords);
      return;
    }
    if (allApiTherapists.length === 0) return;
    setResults(applyFilters(allApiTherapists, userCoords));
  }, [searchRadius]);

  const applyFilters = (list, coords) => {
    const origin = coords === undefined ? userCoords : coords;
    const safeList = Array.isArray(list) ? list : [];
    return safeList.filter(t => {
      if (homeVisit && !t.homeVisit) return false;
      if (kassenart && t.kassenart && t.kassenart !== kassenart) return false;
      if (gender && t.gender !== gender) return false;
      if (fortbildungen.length > 0) {
        const certs = Array.isArray(t?.fortbildungen)
          ? t.fortbildungen
          : Array.isArray(t?.certifications)
            ? t.certifications
            : [];
        if (!fortbildungen.some(f => certs.includes(f))) return false;
      }
      if (origin) {
        if (t.distKm == null) return false;
        if (t.distKm > searchRadius) return false;
      }
      return true;
    });
  };

  const withDistances = (list, coords) => {
    const safeList = Array.isArray(list) ? list : [];
    if (!coords) return safeList;
    return safeList
      .map(t => {
        if (typeof t.distKm === 'number') return t;
        const p = (t.practices ?? []).find(practice => typeof practice.distKm === 'number') ?? t.practices?.[0];
        if (!p?.lat) return { ...t, distKm: null };
        const distKm = typeof p.distKm === 'number'
          ? p.distKm
          : haversine(coords.lat, coords.lng, p.lat, p.lng);
        return { ...t, distKm };
      })
      .sort((a, b) => (a.distKm ?? 9999) - (b.distKm ?? 9999));
  };

  const fetchSearchResults = async (q, effectiveCity, origin) => {
    const response = await fetch(`${getBaseUrl()}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
      body: JSON.stringify({
        query: q || 'physiotherapie',
        city: effectiveCity,
        origin: origin ? {
          lat: origin.lat,
          lng: origin.lng,
        } : undefined,
        radiusKm: origin ? searchRadius : undefined,
        homeVisit: homeVisit || undefined,
        kassenart: kassenart || undefined,
        gender: gender || undefined,
        requestable: requestableOnly || undefined,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return (Array.isArray(payload?.therapists) ? payload.therapists : []).map(mapApiTherapist);
  };

  const runSearchWith = async (q, coords, cityOverride, originOverride) => {
    const effectiveCity = typeof (cityOverride ?? city) === 'string' ? (cityOverride ?? city) : '';
    const effectiveOrigin = originOverride !== undefined ? originOverride : (coords ?? userCoords);
    if (!effectiveCity.trim()) {
      setPendingQuery(q);
      setLocationSheetCity('');
      setShowLocationSheet(true);
      return;
    }
    setShowAutocomplete(false);
    setSearched(true);
    setSearchLoading(true);
    try {
      const mapped = await fetchSearchResults(q, effectiveCity, effectiveOrigin);
      const origin = effectiveOrigin;
      const withDist = withDistances(mapped, origin);
      let filtered = applyFilters(withDist, origin);
      let sourceList = withDist;

      setResults(filtered);
      setAllApiTherapists(sourceList);
    } catch (err) {
      const message = String(err?.message ?? t('alertUnknownError'));
      const usingLocalTunnel = getBaseUrl().includes('.loca.lt');
      const tunnelHint = usingLocalTunnel
        ? '\n\nHint: Your API URL points to a localtunnel link. Check if the tunnel is still active or use your machine\'s LAN IP locally instead.'
        : '';
      Alert.alert(t('alertConnectionError'), `${t('alertSearchFail')}: ${message}\n\nAPI-URL: ${getBaseUrl()}${tunnelHint}`);
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectChip = (chip) => {
    setActiveChip(chip);
    setQuery(chip.label);
    runSearchWith(chip.label, userCoords);
  };

  const selectSuggestion = (suggestion) => {
    const text = typeof suggestion === 'string' ? suggestion : suggestion?.text;
    if (!text) return;
    setQuery(text);
    setAcSuggestions([]);
    setShowAutocomplete(false);
    runSearchWith(text, userCoords);
  };

  const runSearch = () => runSearchWith(query, userCoords);

  const fetchLocationSuggestions = (text) => {
    setLocationSheetCity(text);
    pendingGPSResult.current = null; // user is typing manually — discard GPS result
    setLocationSuggestions([]);
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    if (text.length < 3) return;
    locationDebounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=6&countrycodes=de,at,ch&accept-language=de`;
        const res = await fetch(url, { headers: { 'User-Agent': 'RevioApp/1.0' } });
        const data = await res.json();
        const nextSuggestions = (Array.isArray(data) ? data : [])
          .map((item) => {
            const displayName = typeof item?.display_name === 'string' ? item.display_name : '';
            return {
              label: displayName.split(',').slice(0, 3).join(',').trim(),
              city: item?.address?.city || item?.address?.town || item?.address?.village || item?.address?.municipality || '',
              lat: Number.parseFloat(item?.lat),
              lng: Number.parseFloat(item?.lon),
            };
          })
          .filter((suggestion) => suggestion.city && Number.isFinite(suggestion.lat) && Number.isFinite(suggestion.lng));
        setLocationSuggestions(nextSuggestions);
      } catch {}
    }, 350);
  };

  const selectLocationSuggestion = (suggestion) => {
    if (!suggestion?.city || !Number.isFinite(suggestion.lat) || !Number.isFinite(suggestion.lng)) return;
    setLocationSuggestions([]);
    setLocationSheetCity(suggestion.label);
    confirmLocationAndSearch(suggestion.city, { lat: suggestion.lat, lng: suggestion.lng }, suggestion.label);
  };

  const confirmLocationAndSearch = (resolvedCity, coords, label) => {
    setCity(resolvedCity);
    setLocationLabel(label || resolvedCity);
    if (coords) {
      setUserCoords(coords);
      AsyncStorage.setItem('savedCoords', JSON.stringify(coords));
    } else {
      setUserCoords(null);
      AsyncStorage.removeItem('savedCoords');
    }
    AsyncStorage.setItem('savedCity', resolvedCity);
    AsyncStorage.setItem('savedLocationLabel', label || resolvedCity);
    setShowLocationSheet(false);
    runSearchWith(pendingQuery ?? query, coords, resolvedCity, coords ?? null);
    setPendingQuery(null);
  };

  const handleLocationSheetGPS = async () => {
    setLocationLoading(true);

    if (Platform.OS === 'web') {
      if (!webNavigator?.geolocation) {
        Alert.alert(t('alertError'), t('alertLocationNotSupported'));
        setLocationLoading(false);
        return;
      }
      webNavigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=de`
            );
            const data = await res.json();
            const addr = data?.address || {};
            const detectedCity = addr.city || addr.town || addr.village || addr.municipality || '';
            if (!detectedCity) {
              Alert.alert(t('alertError'), t('alertCityNotRecognized'));
              setLocationLoading(false);
              return;
            }
            const streetParts = [addr.road, addr.house_number].filter(Boolean).join(' ');
            const label = streetParts ? `${streetParts}, ${detectedCity}` : detectedCity;
            pendingGPSResult.current = { city: detectedCity, coords: { lat: latitude, lng: longitude }, label };
            setLocationSheetCity(label);
          } catch {
            Alert.alert(t('alertError'), t('alertLocationFail'));
          }
          setLocationLoading(false);
        },
        () => {
          Alert.alert(t('alertNoAccess'), t('alertAllowLocationBrowser'));
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('alertNoAccess'), t('alertAllowLocation'));
        setLocationLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      const detectedCity = geo?.city || '';
      if (!detectedCity) {
        Alert.alert(t('alertError'), t('alertCityNotRecognized'));
        setLocationLoading(false);
        return;
      }
      // Build display label: "Straße Hausnr., Stadt"
      const streetParts = [geo.street, geo.streetNumber].filter(Boolean).join(' ');
      const label = streetParts ? `${streetParts}, ${detectedCity}` : detectedCity;
      pendingGPSResult.current = { city: detectedCity, coords: { lat: loc.coords.latitude, lng: loc.coords.longitude }, label };
      setLocationSheetCity(label);
    } catch {
      Alert.alert(t('alertError'), t('alertLocationFail'));
    }
    setLocationLoading(false);
  };

  const handleLocationSheetManual = async () => {
    const input = locationSheetCity.trim();
    if (!input) return;
    // If GPS already detected this exact location, use it directly — no re-geocoding needed
    if (pendingGPSResult.current && pendingGPSResult.current.label === input) {
      const { city: gpsCity, coords: gpsCoords, label: gpsLabel } = pendingGPSResult.current;
      pendingGPSResult.current = null;
      confirmLocationAndSearch(gpsCity, gpsCoords, gpsLabel);
      return;
    }
    setLocationLoading(true);
    try {
      if (Platform.OS === 'web') {
        // Use Nominatim for geocoding on web
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=1&accept-language=de`
        );
        const data = await res.json();
        if (data.length > 0) {
          const { lat, lon, display_name } = data[0];
          // Extract city from display_name or use input
          const revRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de`
          );
          const revData = await revRes.json();
          const addr = revData?.address || {};
          const resolvedCity = addr.city || addr.town || addr.village || addr.municipality || input;
          const streetParts = [addr.road, addr.house_number].filter(Boolean).join(' ');
          const label = streetParts ? `${streetParts}, ${resolvedCity}` : resolvedCity;
          confirmLocationAndSearch(resolvedCity, { lat: parseFloat(lat), lng: parseFloat(lon) }, label);
        } else {
          Alert.alert(t('alertAddressNotFound'), t('alertAddressNotFoundBody'));
        }
      } else {
        // Try to geocode the input to get coordinates + normalized city
        const results = await Location.geocodeAsync(input);
        if (results.length > 0) {
          const { latitude, longitude } = results[0];
          const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
          const resolvedCity = geo?.city || input;
          const streetParts = [geo?.street, geo?.streetNumber].filter(Boolean).join(' ');
          const label = streetParts ? `${streetParts}, ${resolvedCity}` : resolvedCity;
          confirmLocationAndSearch(resolvedCity, { lat: latitude, lng: longitude }, label);
        } else {
          Alert.alert(t('alertAddressNotFound'), t('alertAddressNotFoundBody'));
        }
      }
    } catch {
      Alert.alert(t('alertAddressFail'), t('alertAddressFailBody'));
    }
    setLocationLoading(false);
  };

  // Push notification tap listener (foreground + background tap → route to correct screen)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      handleNotificationPress({ type: data.type, bookingId: data.bookingId, actionLabel: data.actionLabel });
    });
    // Cold-start: app launched via push tap
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data ?? {};
      handleNotificationPress({ type: data.type, bookingId: data.bookingId, actionLabel: data.actionLabel });
    }).catch(() => {});
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved city + label from AsyncStorage on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('savedCity'),
      AsyncStorage.getItem('savedLocationLabel'),
      AsyncStorage.getItem('savedCoords'),
      AsyncStorage.getItem('themeMode'),
    ]).then(([savedCity, savedLabel, savedCoords, savedThemeMode]) => {
      if (savedCity) setCity(savedCity);
      if (savedLabel) setLocationLabel(savedLabel);
      if (savedThemeMode === 'light' || savedThemeMode === 'dark') setThemeMode(savedThemeMode);
      if (savedCoords) {
        try { setUserCoords(JSON.parse(savedCoords)); } catch {}
      }
    });
  }, []);

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

  // ── Discover tab ──────────────────────────────────────────────────────────

  const mapTherapists = React.useMemo(
    () => results
      .map((th) => {
        if (th.homeVisit && th.homeLat && th.homeLng) {
          return { ...th, _mapLat: th.homeLat, _mapLng: th.homeLng, _mapType: 'home' };
        }
        const p = (th.practices ?? []).find((pr) => pr.lat && pr.lat !== 0 && pr.lng && pr.lng !== 0);
        if (p) {
          return { ...th, _mapLat: p.lat, _mapLng: p.lng, _mapType: 'practice' };
        }
        return null;
      })
      .filter(Boolean),
    [results],
  );

  const mapRegion = React.useMemo(() => {
    // When a nearby-search origin is active, fit the map to show the full radius circle
    if (userCoords) {
      const delta = Math.max((searchRadius / 111) * 2.8, 0.02);
      return {
        latitude: userCoords.lat,
        longitude: userCoords.lng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      };
    }
    // No origin: fit to therapist service areas or fall back to Germany
    if (mapTherapists.length === 0)
      return { latitude: 51.1657, longitude: 10.4515, latitudeDelta: 5.0, longitudeDelta: 5.0 };
    const avgLat = mapTherapists.reduce((s, th) => s + th._mapLat, 0) / mapTherapists.length;
    const avgLng = mapTherapists.reduce((s, th) => s + th._mapLng, 0) / mapTherapists.length;
    const latSpan = Math.max(...mapTherapists.map((th) => Math.abs(th._mapLat - avgLat))) * 2.2 || 0.08;
    const lngSpan = Math.max(...mapTherapists.map((th) => Math.abs(th._mapLng - avgLng))) * 2.2 || 0.08;
    return {
      latitude: avgLat, longitude: avgLng,
      latitudeDelta: Math.max(latSpan, 0.05),
      longitudeDelta: Math.max(lngSpan, 0.05),
    };
  }, [mapTherapists, userCoords, searchRadius]);

  const getMapRegion = () => mapRegion;

  const renderDiscover = () => (
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
      fortbildungen={fortbildungen}
      getMapRegion={getMapRegion}
      homeVisit={homeVisit}
      isFavorite={isFavorite}
      kassenart={kassenart}
      locationLabel={locationLabel}
      mapTherapists={mapTherapists}
      mapScrollEnabled={mapScrollEnabled}
      notifications={notifications}
      dismissedNotifIds={dismissedNotifIds}
      openTherapistById={openTherapistById}
      query={query}
      results={results}
      runSearch={runSearch}
      runSearchWith={runSearchWith}
      searched={searched}
      searchLoading={searchLoading}
      searchRadius={searchRadius}
      selectChip={selectChip}
      setSearchRadius={setSearchRadius}
      selectSuggestion={selectSuggestion}
      setActiveChip={setActiveChip}
      setFortbildungen={setFortbildungen}
      setHomeVisit={setHomeVisit}
      setKassenart={setKassenart}
      gender={gender}
      setGender={setGender}
      setLocationSheetCity={setLocationSheetCity}
      setMapScrollEnabled={setMapScrollEnabled}
      setQuery={setQuery}
      setShowAutocomplete={setShowAutocomplete}
      setShowFilters={setShowFilters}
      setShowLocationSheet={setShowLocationSheet}
      setShowNotifications={setShowNotifications}
      setViewMode={setViewMode}
      showAutocomplete={showAutocomplete}
      showFilters={showFilters}
      styles={styles}
      t={t}
      toggleFavorite={toggleFavorite}
      toggleFortbildung={toggleFortbildung}
      userCoords={userCoords}
      viewMode={viewMode}
      requestableOnly={requestableOnly}
      setRequestableOnly={setRequestableOnly}
    />
  );

  // ── Practice profile ──────────────────────────────────────────────────────

  const renderPracticeProfile = (practice) => {
    return (
      <PracticeProfileScreen
        c={c}
        callPhone={(phone) => callPhone(phone, t)}
        isPracticeFavorite={isPracticeFavorite}
        openPractice={openPractice}
        openTherapistById={openTherapistById}
        practice={practice}
        selectedPracticeError={selectedPracticeError}
        selectedPracticeLoading={selectedPracticeLoading}
        selectedPracticeTherapists={selectedPracticeTherapists}
        setSelectedPractice={setSelectedPractice}
        styles={styles}
        t={t}
        toggleFavoritePractice={toggleFavoritePractice}
      />
    );
  };

  const renderTherapistProfile = (th) => {
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
        th={th}
        toggleFavorite={toggleFavorite}
        authToken={authToken}
        accountType={accountType}
        availableSlots={availableSlotsTherapistId === th?.id ? availableSlots : []}
        onBookingRequest={(therapist) => {
          if (!authToken) {
            // Gewünschten Therapeuten merken — nach Login direkt buchen
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
  };

  // ── Login screen ──────────────────────────────────────────────────────────

  const renderLogin = () => (
    <LoginScreen
      c={c}
      forgotPasswordLoading={forgotPasswordLoading}
      handleLogin={handleLogin}
      handleForgotPassword={handleForgotPassword}
      loginEmail={loginEmail}
      loginError={loginError}
      loginLoading={loginLoading}
      loginNotice={loginNotice}
      loginPassword={loginPassword}
      setLoginEmail={setLoginEmail}
      setLoginPassword={setLoginPassword}
      setShowLogin={setShowLogin}
      styles={styles}
      t={t}
    />
  );

  // ── Therapist dashboard (logged in) ───────────────��───────────────────────

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

  const renderTherapistDashboard = () => (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>Mein Profil</Text>
          </View>
          <Pressable
            onPress={() => setShowNotifications(true)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="notifications-outline" size={18} color={c.text} />
            {notifications.filter(n => !dismissedNotifIds.has(n.id)).length > 0 && (
              <View style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: c.error }} />
            )}
          </Pressable>
        </View>
      </View>
      <TherapistDashboardScreen
        c={c} t={t} styles={styles}
        certificationOptions={certificationOptions}
        onOpenTherapyTab={() => setActiveTab('therapy')}
        onAddSlot={handleAddSlot}
        onProfileSaved={openProfileSavedModal}
      />
    </View>
  );

  // ── Patient registration ──────────────────────────────────────────────────

  const renderRoleSelect = () => (
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
  );
  const renderSignup = renderRoleSelect;
  const renderPatientName = renderRoleSelect;
  const renderTherapist = () => (
    <TherapistLandingScreen
      __DEV__={__DEV__}
      c={c}
      setShowLogin={setShowLogin}
      setShowSignup={openSignupFlow}
      styles={styles}
      t={t}
    />
  );

  // ── Optionen tab ──────────────────────────────────────────────────────────

  const renderOptions = () => (
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

  const renderTherapyTabShell = (title, body) => (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
          <Text style={[styles.headerTitle, { color: c.text }]}>{title}</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 20, paddingTop: SPACE.sm }]}
        showsVerticalScrollIndicator={false}
        refreshControl={authToken ? <RefreshControl refreshing={therapyRefreshing} onRefresh={handleTherapyRefresh} tintColor={c.primary} /> : undefined}
      >
        {body}
      </ScrollView>
    </View>
  );

  const renderTherapyPlaceholder = (label) => (
    <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={styles.emptyIcon}>◌</Text>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{label}</Text>
    </View>
  );

  const therapyTabTitle = 'Meine Termine';

  const renderFavoritesVertical = (onOpenProfile, { showAll = false, onShowAll } = {}) => {
    if (shouldShowSectionLoading(favoritesLoading, favoritesLastLoadedAt)) return renderTherapySectionLoading();
    if (favorites.length === 0) return renderTherapySectionEmpty('Du hast noch keine Therapeut:innen gespeichert.', t('favoritesEmptyBody'));
    const shown = showAll ? favorites : favorites.slice(0, 2);
    const mutedColor = c.textMuted ?? c.muted;
    return (
      <View style={{ gap: 10 }}>
        {shown.map((fav) => {
          const initials = (fav.fullName ?? '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
          const spec = (fav.specializations ?? [])[0] ?? null;
          return (
            <Pressable
              key={fav.id}
              onPress={() => onOpenProfile(fav)}
              style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}
            >
              {/* ── Header ── */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View>
                  {fav.photo ? (
                    <Image source={{ uri: fav.photo }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                  ) : (
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>{initials}</Text>
                    </View>
                  )}
                  {fav.requestable ? (
                    <View style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 5.5, backgroundColor: c.success, borderWidth: 2, borderColor: c.card }} />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingTop: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, lineHeight: 21 }} numberOfLines={1}>{fav.fullName}</Text>
                  <Text style={{ fontSize: 13, color: mutedColor, lineHeight: 18, marginTop: 1 }} numberOfLines={1}>{fav.professionalTitle}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 2 }}>
                  <Pressable onPress={(e) => { e.stopPropagation?.(); toggleFavorite(fav); }} hitSlop={ICON_HIT_SLOP} style={{ padding: 4 }}>
                    <Ionicons name="heart" size={17} color={c.error ?? '#ef4444'} />
                  </Pressable>
                  <Ionicons name="chevron-forward" size={13} color={c.muted} style={{ opacity: 0.45 }} />
                </View>
              </View>

              {/* ── Status-Badge ── */}
              {fav.requestable ? (
                <View style={{ marginTop: 9 }}>
                  <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.successBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.success }} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: c.success }}>Direkt buchbar</Text>
                  </View>
                </View>
              ) : null}

              {/* ── Eigenschaften ── */}
              {(fav.homeVisit || spec) ? (
                <View style={{ marginTop: 10, gap: 6 }}>
                  {fav.homeVisit ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Ionicons name="home-outline" size={13} color={mutedColor} />
                      <Text style={{ fontSize: 13, color: c.text }}>Hausbesuch möglich</Text>
                    </View>
                  ) : null}
                  {spec ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Ionicons name="medical-outline" size={13} color={mutedColor} />
                      <Text style={{ fontSize: 13, color: c.text }} numberOfLines={1}>{spec}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* ── Footer ── */}
              {fav.city ? (
                <View style={{ marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: c.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="location-outline" size={12} color={mutedColor} />
                    <Text style={{ fontSize: 12, color: mutedColor }} numberOfLines={1}>{fav.city}</Text>
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {!showAll && favorites.length > 2 && (
          <Pressable onPress={onShowAll} style={{ paddingTop: 6, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>Alle Favoriten anzeigen ›</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderTherapySectionEmpty = (title, body) => (
    <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 20 }]}>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: c.muted }]}>{body}</Text> : null}
    </View>
  );

  const renderTherapySectionLoading = () => (
    <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 20 }]}>
      <ActivityIndicator color={c.primary} />
    </View>
  );

  const renderAppointmentDetail = (appointment) => (
    <AppointmentDetail
      appointment={appointment}
      onBack={() => setSelectedAppointment(null)}
      onOpenTherapist={openTherapistById}
      onCancelRequest={() => setShowCancelAppointmentModal(true)}
      renderTherapyTabShell={renderTherapyTabShell}
      c={c} t={t} styles={styles}
    />
  );

  const renderFavoriteTherapists = () => (
    favorites.map((fav) => (
      <View key={fav.id} style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={styles.cardTop}>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} onPress={() => setSelectedTherapist(fav)}>
            <Image source={{ uri: fav.photo }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: c.text }]}>{fav.fullName}</Text>
              <Text style={[styles.cardTitle, { color: c.muted }]}>{fav.professionalTitle}</Text>
            </View>
            <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
          </Pressable>
          <ThemedHeartButton isSaved={true} onToggle={() => toggleFavorite(fav)} hitSlop={ICON_HIT_SLOP} />
        </View>
        {(fav.city || fav.availability || fav.homeVisit) ? (
          <View style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}>
            <View style={[styles.practiceInitial, { backgroundColor: fav.homeVisit ? c.successBg : c.border }]}>
              <Ionicons name={fav.homeVisit ? 'home-outline' : 'location-outline'} size={16} color={fav.homeVisit ? c.success : c.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.practiceName, { color: c.text }]}>{fav.city || t('cityLabel')}</Text>
              {fav.availability ? <Text style={[styles.practiceCity, { color: c.muted }]} numberOfLines={1}>{fav.availability}</Text> : null}
            </View>
          </View>
        ) : null}
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: c.accent }]}
          onPress={() => openTherapistById(fav.id)}
        >
          <Ionicons name="person-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.ctaBtnText}>{t('viewProfileBtn')}</Text>
        </Pressable>
      </View>
    ))
  );

  const renderTherapyTabGuest = () => renderTherapyTabShell(
    therapyTabTitle,
    <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={styles.emptyIcon}>♡</Text>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{t('favoritesLoginRequired') ?? 'Einloggen für Favoriten'}</Text>
      <Text style={[styles.emptyBody, { color: c.muted }]}>{t('favoritesLoginRequiredBody') ?? 'Melde dich an, um Therapeuten als Favoriten zu speichern.'}</Text>
      <Pressable
        onPress={() => { setActiveTab('profile'); setShowLogin(true); }}
        style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 16, paddingHorizontal: 32 }]}
      >
        <Text style={styles.registerBtnText}>{t('loginAction')}</Text>
      </Pressable>
    </View>
  );

  const renderTherapyTabPatient = () => (
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
      renderTherapyTabShell={renderTherapyTabShell}
      renderTherapySectionLoading={renderTherapySectionLoading}
    />
  );

  const renderTherapyTabTherapist = () => (
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
      renderTherapyTabShell={renderTherapyTabShell}
      renderTherapySectionLoading={renderTherapySectionLoading}
      renderTherapySectionEmpty={renderTherapySectionEmpty}
    />
  );

  const renderTherapyTab = () => {
    if (!authToken) return renderTherapyTabGuest();
    if (accountType === 'patient') return renderTherapyTabPatient();
    if (accountType === 'therapist') return renderTherapyTabTherapist();
    return renderTherapyTabGuest();
  };

  const renderFavoritesTab = () => {
    if (!authToken) {
      return renderTherapyTabShell(
        t('favoritesTitle'),
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.emptyIcon}>♡</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('favoritesLoginRequired') ?? 'Einloggen für Favoriten'}</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>{t('favoritesLoginRequiredBody') ?? 'Melde dich an, um Therapeuten als Favoriten zu speichern.'}</Text>
          <Pressable
            onPress={() => { setActiveTab('profile'); setShowLogin(true); }}
            style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 16, paddingHorizontal: 32 }]}
          >
            <Text style={styles.registerBtnText}>{t('loginAction')}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
          <View style={[styles.header, { marginBottom: 0 }]}>
            <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: c.text }]}>{t('favoritesTitle')}</Text>
              <Text style={[styles.headerSub, { color: c.muted }]}>
                {favorites.length} gespeicherte {favorites.length === 1 ? 'Therapeut:in' : 'Therapeut:innen'}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowNotifications(true)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="notifications-outline" size={18} color={c.text} />
              {notifications.filter(n => !dismissedNotifIds.has(n.id)).length > 0 && (
                <View style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: c.error }} />
              )}
            </Pressable>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40, paddingTop: 12 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={favoritesLoading} onRefresh={() => loadFavorites(authToken)} tintColor={c.primary} />}
        >
          {renderFavoritesVertical((fav) => openTherapistById(fav.id, fav), { showAll: true })}
        </ScrollView>
      </View>
    );
  };

  // ── Register flow ──────────────────────────────────────────────────────────

  const renderRegister = () => (
    <TherapistRegistrationFlow
      visible={showRegister}
      onClose={() => { setShowRegister(false); }}
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
  );

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

  const renderEmailVerifyScreen = () => (
    <EmailVerifyScreen
      status={emailVerifyStatus}
      error={emailVerifyError}
      onCancel={() => { setShowEmailVerify(false); setEmailVerifyStatus('idle'); setEmailVerifyError(''); }}
      c={c} t={t} styles={styles}
    />
  );

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
  // ── Layout ────────────────────────────────────────────────────────────────

  const renderPatientDashboard = () => (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>Mein Profil</Text>
          </View>
          <Pressable
            onPress={() => setShowNotifications(true)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="notifications-outline" size={18} color={c.text} />
            {notifications.filter(n => !dismissedNotifIds.has(n.id)).length > 0 && (
              <View style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: c.error }} />
            )}
          </Pressable>
        </View>
      </View>
      <PatientDashboardScreen
        c={c} t={t} styles={styles}
        loggedInPatient={loggedInPatient}
        authToken={authToken}
        favorites={favorites}
        myAppointments={myAppointments}
        onOpenTherapist={openTherapistById}
        onProfileSaved={handlePatientProfileSaved}
      />
    </View>
  );

  const renderTab = () => {
    if (activeTab === 'therapy' && selectedAppointment) return renderAppointmentDetail(selectedAppointment);
    if (selectedTherapist) return renderTherapistProfile(selectedTherapist);
    if (activeTab === 'therapy') return renderTherapyTab();
    if (activeTab === 'favorites') return renderFavoritesTab();
    if (activeTab === 'profile') {
      if (loggedInPatient) return renderPatientDashboard();
      if (showEmailVerify) return renderEmailVerifyScreen();
      if (loggedInTherapist) return renderTherapistDashboard();
      return (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
            <View style={[styles.header, { marginBottom: 0 }]}>
              <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
              <Text style={[styles.authBrandWordmark, { color: c.text }]}>evio</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            {showLogin ? renderLogin() : showRegister ? renderRegister() : showRoleSelect ? renderRoleSelect() : showPatientName ? renderPatientName() : showSignup ? renderSignup() : renderTherapist()}
          </View>
        </View>
      );
    }
    if (activeTab === 'options') return renderOptions();
    return renderDiscover();
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

      <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowNotifications(false)} />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, minHeight: 200 }}>
          <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          {(() => {
            const visible = notifications.filter((n) => !dismissedNotifIds.has(n.id));
            const iconMap = {
              PROFILE_APPROVED: { name: 'checkmark-circle', color: c.success ?? '#22c55e' },
              PROFILE_CHANGES_REQUESTED: { name: 'create-outline', color: c.primary },
              PROFILE_REJECTED: { name: 'close-circle', color: c.error },
              PROFILE_SUSPENDED: { name: 'pause-circle', color: c.error },
              NEW_BOOKING_REQUEST: { name: 'calendar', color: c.primary },
              BOOKING_CONFIRMED: { name: 'checkmark-circle', color: c.success ?? '#22c55e' },
              BOOKING_DECLINED: { name: 'close-circle', color: c.error },
              BOOKING_CANCELLED: { name: 'calendar-clear-outline', color: c.muted },
              JOIN_REQUEST: { name: 'person-add-outline', color: c.primary },
              INVITE: { name: 'mail-outline', color: c.primary },
            };
            return (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{t('notificationsTitle')}</Text>
                  {visible.length > 0 && (
                    <Pressable onPress={dismissAllNotifications} hitSlop={8}>
                      <Text style={{ fontSize: 13, color: c.muted }}>{t('clearAllBtn') ?? 'Alle löschen'}</Text>
                    </Pressable>
                  )}
                </View>
                {visible.length === 0 ? (
                  <Text style={{ color: c.muted, textAlign: 'center', marginTop: 24 }}>{t('noNotifications')}</Text>
                ) : (
                  visible.map((n) => {
                    const icon = iconMap[n.type] ?? { name: 'notifications-outline', color: c.primary };
                    return (
                      <Pressable key={n.id} onPress={() => handleNotificationPress(n)} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                          <Ionicons name={icon.name} size={16} color={icon.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>{n.message}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                            <Text style={{ color: c.muted, fontSize: 11 }}>
                              {new Date(n.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {n.actionLabel && (
                              <Text style={{ color: c.primary, fontSize: 11, fontWeight: '600' }}>{n.actionLabel} ›</Text>
                            )}
                          </View>
                        </View>
                        <Pressable onPress={(e) => { e.stopPropagation?.(); dismissNotification(n.id); }} hitSlop={10} style={{ paddingTop: 2 }}>
                          <Ionicons name="close-outline" size={20} color={c.muted} />
                        </Pressable>
                      </Pressable>
                    );
                  })
                )}
              </>
            );
          })()}
        </View>
      </Modal>

      <Modal visible={showReviewNotificationModal} transparent animationType="fade" onRequestClose={() => markReviewNotificationSeen()}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={() => markReviewNotificationSeen()}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
              <View style={{ alignItems: 'center', gap: 10 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons
                    name={reviewNotification?.type === 'PROFILE_APPROVED' ? 'checkmark-circle' : 'notifications'}
                    size={34}
                    color={reviewNotification?.type === 'PROFILE_APPROVED' ? c.success : c.primary}
                  />
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                  {getReviewNotificationTitle(reviewNotification, t)}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 21 }}>
                {reviewNotification?.message}
              </Text>
              <Pressable
                style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                onPress={() => markReviewNotificationSeen()}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('doneBtn')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Visibility Modal ───────────────────────────────────────────────── */}
      <Modal visible={showVisibilityModal} transparent animationType="fade" onRequestClose={() => setShowVisibilityModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={() => setShowVisibilityModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>{t('makeProfileVisible')}</Text>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
                {t('visibilityQuestion')}
              </Text>
              <Pressable
                style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: visibilityLoading ? 0.6 : 1 }}
                onPress={() => handleVisibilityChoice('visible')}
                disabled={visibilityLoading}
              >
                <Ionicons name="eye-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('visibleLabel')}</Text>
              </Pressable>
              <Pressable
                style={{ backgroundColor: c.mutedBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: c.border, opacity: visibilityLoading ? 0.6 : 1 }}
                onPress={() => handleVisibilityChoice('hidden')}
                disabled={visibilityLoading}
              >
                <Ionicons name="eye-off-outline" size={20} color={c.text} />
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{t('hiddenLabel')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Profile Saved Modal ─────────────────────────────────────────────── */}
      <Modal visible={showProfileSavedModal} transparent animationType="fade" onRequestClose={closeProfileSavedModal}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={closeProfileSavedModal}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
              <View style={{ alignItems: 'center', gap: 10 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-circle" size={34} color={c.primary} />
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                  {profileSavedModalTitle || t('profileSavedModalTitle')}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 21 }}>
                {profileSavedModalBody || t('profileSavedModalBody')}
              </Text>
              <Pressable
                style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                onPress={closeProfileSavedModal}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('doneBtn')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>


      {/* ── Slot Created Modal ─────────────────────────────────────────────── */}
      <Modal visible={showSlotCreatedModal} transparent animationType="fade" onRequestClose={() => setShowSlotCreatedModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={() => setShowSlotCreatedModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
              <View style={{ alignItems: 'center', gap: 12 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.accentBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="calendar-outline" size={32} color={c.accent} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                  Termin erstellt
                </Text>
              </View>
              {createdSlot?.startsAt ? (
                <View style={{ backgroundColor: c.primaryBg, borderRadius: 12, padding: 16, alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: c.primary }}>
                    {new Date(createdSlot.startsAt).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </Text>
                  <Text style={{ fontSize: 15, color: c.primary }}>
                    {new Date(createdSlot.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · {createdSlot.durationMin ?? 20} Min.
                  </Text>
                </View>
              ) : null}
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
                Der Termin ist jetzt für Patienten sichtbar und buchbar.
              </Text>
              <Pressable
                style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                onPress={() => setShowSlotCreatedModal(false)}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Fertig</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* ── Cancel Appointment Modal ───────────────────────────────────────── */}
      <Modal visible={showCancelAppointmentModal} transparent animationType="fade" onRequestClose={() => setShowCancelAppointmentModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={() => setShowCancelAppointmentModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 20 }}>
              <View style={{ alignItems: 'center', gap: 12 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close-circle" size={34} color="#DC2626" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                  Termin stornieren
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 21 }}>
                {selectedAppointment?.status === 'CONFIRMED'
                  ? 'Möchtest du diesen bestätigten Termin wirklich stornieren? Der Therapeut wird benachrichtigt.'
                  : 'Möchtest du diese Anfrage wirklich stornieren?'}
              </Text>
              <View style={{ gap: 10 }}>
                <Pressable
                  style={{ backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                  onPress={async () => {
                    setShowCancelAppointmentModal(false);
                    await handleCancelSelectedAppointment();
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Stornieren</Text>
                </Pressable>
                <Pressable
                  style={{ backgroundColor: c.mutedBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                  onPress={() => setShowCancelAppointmentModal(false)}
                >
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>Abbrechen</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Therapist Cancel Modal ────────────────────────────────────────── */}
      <Modal visible={showTherapistCancelModal} transparent animationType="fade" onRequestClose={() => { setShowTherapistCancelModal(false); setTherapistDetailBooking(null); setTherapistCancelBookingId(null); }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={() => { setShowTherapistCancelModal(false); setTherapistDetailBooking(null); setTherapistCancelBookingId(null); }}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 20 }}>
              <View style={{ alignItems: 'center', gap: 12 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="calendar-clear-outline" size={30} color="#DC2626" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                  Termin absagen
                </Text>
              </View>
              {therapistDetailBooking && (
                <View style={{ backgroundColor: c.mutedBg, borderRadius: 12, padding: 14, gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
                    {therapistDetailBooking.patientName ?? 'Patient:in'}
                  </Text>
                  {therapistDetailBooking.patientPhone ? (
                    <Text style={{ fontSize: 13, color: c.muted }}>{therapistDetailBooking.patientPhone}</Text>
                  ) : null}
                </View>
              )}
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 21 }}>
                Möchtest du diesen bestätigten Termin wirklich absagen? Der Patient wird benachrichtigt.
              </Text>
              <View style={{ gap: 10 }}>
                <Pressable
                  style={{ backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                  onPress={async () => {
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
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Absagen</Text>
                </Pressable>
                <Pressable
                  style={{ backgroundColor: c.mutedBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                  onPress={() => { setShowTherapistCancelModal(false); setTherapistCancelBookingId(null); setTherapistDetailBooking(null); }}
                >
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>Abbrechen</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Location Sheet ─────────────────────────────────────────────────── */}
      {/* Slot Composer Modal */}
      <Modal visible={showSlotComposerModal} transparent animationType="slide" onRequestClose={() => setShowSlotComposerModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={() => setShowSlotComposerModal(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, flex: 1 }}>Neuen Termin anlegen</Text>
              <Pressable onPress={() => setShowSlotComposerModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={c.muted} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              <TherapistSlotComposer
                c={c}
                onAddSlot={(slot) => {
                  handleAddSlot(slot);
                  setShowSlotComposerModal(false);
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showLocationSheet} transparent animationType="slide" onRequestClose={() => setShowLocationSheet(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowLocationSheet(false)} />
        <ScrollView
          style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
          contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 }} />
          <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, textAlign: 'center' }}>{t('locationTitle')}</Text>
          <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', marginTop: -8 }}>
            {t('locationSub')}
          </Text>

          {/* GPS Button */}
          <Pressable
            onPress={handleLocationSheetGPS}
            disabled={locationLoading}
            style={{ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <Ionicons name="navigate-sharp" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {locationLoading ? t('gpsLoading') : t('useGPS')}
            </Text>
          </Pressable>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            <Text style={{ color: c.muted, fontSize: 12 }}>{t('locationDivider')}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          </View>

          {/* Manual input with autocomplete */}
          <View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={locationSheetCity}
                onChangeText={fetchLocationSuggestions}
                placeholder={t('locationExamplePlaceholder')}
                placeholderTextColor={c.muted}
                style={{ flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: locationSuggestions.length > 0 ? c.primary : c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontSize: 15 }}
                onSubmitEditing={handleLocationSheetManual}
                returnKeyType="search"
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Pressable
                onPress={handleLocationSheetManual}
                disabled={!locationSheetCity.trim() || locationLoading}
                style={{ backgroundColor: (locationSheetCity.trim() && !locationLoading) ? c.primary : c.mutedBg, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' }}
              >
                <Text style={{ color: (locationSheetCity.trim() && !locationLoading) ? '#fff' : c.muted, fontSize: 15, fontWeight: '600' }}>
                  {locationLoading ? '…' : t('confirmLocation')}
                </Text>
              </Pressable>
            </View>

            {/* Radius selector */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {[1, 3, 5, 10, 25].map((km) => (
                <Pressable
                  key={km}
                  onPress={() => setSearchRadius(km)}
                  style={{ borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: searchRadius === km ? c.primary : c.border, backgroundColor: searchRadius === km ? c.primary : c.card }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: searchRadius === km ? '#fff' : c.muted }}>{km} km</Text>
                </Pressable>
              ))}
            </View>

            {/* Autocomplete dropdown */}
            {locationSuggestions.length > 0 && (
              <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.primary, borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
                {locationSuggestions.map((s, i) => (
                  <Pressable
                    key={i}
                    onPress={() => selectLocationSuggestion(s)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12,
                      borderBottomWidth: i < locationSuggestions.length - 1 ? 1 : 0, borderBottomColor: c.border }}
                  >
                    <Ionicons name="navigate-sharp" size={14} color={c.primary} />
                    <Text style={{ flex: 1, color: c.text, fontSize: 14 }} numberOfLines={2}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Foto-Prompt Modal ────────────────────────────────────────────────── */}
      <Modal visible={showPhotoPrompt} transparent animationType="fade" onRequestClose={() => setShowPhotoPrompt(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowPhotoPrompt(false)}>
          <Pressable style={{ backgroundColor: c.card, borderRadius: 20, padding: 28, width: '100%', alignItems: 'center', gap: 12 }} onPress={() => {}}>
            <Text style={{ fontSize: 52 }}>📷</Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, textAlign: 'center' }}>{t('addProfilePhoto')}</Text>
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
              {t('photoTrustNotice')}
            </Text>
            <Pressable
              onPress={async () => {
                setShowPhotoPrompt(false);
                await AsyncStorage.setItem('revio_photo_prompt_dismissed', '1');
                setActiveTab('profile');
              }}
              style={{ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginTop: 4 }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('choosePhoto')}</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                setShowPhotoPrompt(false);
                await AsyncStorage.setItem('revio_photo_prompt_dismissed', '1');
              }}
              style={{ paddingVertical: 10 }}
            >
              <Text style={{ color: c.muted, fontSize: 14 }}>{t('laterBtn')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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

      <View style={styles.appFrame}>
        {renderTab()}
        {/* ── Globale Notification-Glocke ─────────────────────────────────── */}
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
      <View style={[styles.navbar, { backgroundColor: c.nav, borderColor: c.border }]}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setSelectedPractice(null);
                setSelectedTherapist(null);
                if (tab.key !== 'profile') {
                  setShowLogin(false);
                  setShowRegister(false);
                  setShowInviteClaim(false);
                }
                if (tab.key === 'discover') {
                  setQuery('');
                  setActiveChip(null);
                  setResults([]);
                  setSearched(false);
                  setShowAutocomplete(false);
                  setShowFilters(false);
                  setViewMode('list');
                }
                setActiveTab(tab.key);
              }}
              style={styles.navItem}
            >
              <View style={[styles.navPill, active && { backgroundColor: c.primaryBg }]}>
                <View style={{ position: 'relative' }}>
                  <Ionicons
                    name={active ? tab.icon : `${tab.icon}-outline`}
                    size={22}
                    color={active ? c.primary : c.muted}
                  />
                  {tab.key === 'profile' && loggedInTherapist && notifications.filter((n) => !dismissedNotifIds.has(n.id)).length > 0 && (
                    <View style={{ position: 'absolute', top: -3, right: -5, backgroundColor: '#E53E3E', borderRadius: 6, minWidth: 12, height: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
                      <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800', lineHeight: 12 }}>
                        {notifications.filter((n) => !dismissedNotifIds.has(n.id)).length}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.navLabel, { color: active ? c.primary : c.muted }]}>
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  appFrame: { flex: 1 },
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

  navbar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  navItem: { alignItems: 'center', gap: 4, flex: 1, paddingVertical: 10, minHeight: 44 },
  navPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 38,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: { fontSize: 18, fontWeight: '700' },
  navLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },

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
