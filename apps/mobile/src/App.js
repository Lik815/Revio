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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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
  REG_STEPS,
  SHADOW,
  SPACE,
  TYPE,
  fortbildungOptions,
  formatMissingProfileFields,
  getBaseUrl,
  TUNNEL_HEADERS,
  getLangLabel,
  getPracticeInitials,
  haversine,
  languageOptions,
  mapApiTherapist,
  normalizeLanguageCodes,
  normalizeTherapistProfile,
  regSpecOptions,
  resolveMediaUrl,
  softenErrorMessage,
  tabs,
  GERMAN_CITIES,
} from './mobile-utils';
import { DiscoverScreen } from './mobile-discover-screen';
import {
  PracticeProfileScreen,
  TherapistProfileScreen,
} from './mobile-public-profiles';
import {
  LoginScreen,
  TherapistLandingScreen,
} from './mobile-therapist-screens';
import {
  TherapistDashboardScreen,
} from './mobile-therapist-dashboard';
import {
  ComplianceStatusStep,
  getComplianceStatusLabel,
} from './mobile-compliance-step';
import { translations } from './mobile-translations';

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

const ICON_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const REVIEW_NOTIFICATION_TYPES = new Set([
  'PROFILE_APPROVED',
  'PROFILE_CHANGES_REQUESTED',
  'PROFILE_REJECTED',
  'PROFILE_SUSPENDED',
]);
const REGISTRATION_COMPLIANCE_DRAFT_KEY = 'revio_registration_compliance_draft';
const COMPLIANCE_STATUS_VALUES = ['yes', 'no', 'in_progress'];
const HEALTH_AUTHORITY_STATUS_VALUES = ['yes', 'no', 'in_progress', 'unknown'];

function normalizeComplianceValue(value, allowedValues) {
  return allowedValues.includes(value) ? value : null;
}

function normalizeComplianceDraft(value) {
  return {
    taxRegistrationStatus: normalizeComplianceValue(value?.taxRegistrationStatus, COMPLIANCE_STATUS_VALUES),
    healthAuthorityStatus: normalizeComplianceValue(value?.healthAuthorityStatus, HEALTH_AUTHORITY_STATUS_VALUES),
  };
}

function parseComplianceDraft(rawValue) {
  if (!rawValue) return normalizeComplianceDraft(null);

  try {
    return normalizeComplianceDraft(JSON.parse(rawValue));
  } catch {
    return normalizeComplianceDraft(null);
  }
}

function getTherapistComplianceDraftKey(therapistId) {
  return `revio_therapist_compliance_draft_${therapistId}`;
}

function formatDocumentSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function validateDocumentSize(asset, t) {
  if (!asset?.size || asset.size <= 0) return true;
  if (asset.size <= MAX_DOCUMENT_BYTES) return true;

  Alert.alert(
    t('alertDocumentTooLargeTitle'),
    t('alertDocumentTooLargeBody')
      .replace('{max}', formatDocumentSize(MAX_DOCUMENT_BYTES))
      .replace('{name}', asset.name || t('documentFallback')),
  );
  return false;
}

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

  const [appLanguage, setAppLanguage] = useState('de'); // 'de' | 'en'
  const t = (key) => translations[appLanguage]?.[key] ?? translations['de'][key];

  const [activeTab, setActiveTab] = useState('discover');
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [selectedPracticeTherapists, setSelectedPracticeTherapists] = useState([]);
  const [selectedPracticeLoading, setSelectedPracticeLoading] = useState(false);
  const [selectedPracticeError, setSelectedPracticeError] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState(null);

  // Favorites — stored locally on device only
  const [favorites, setFavorites] = useState([]);
  useEffect(() => {
    AsyncStorage.getItem('revio_favorites').then(val => {
      if (!val) return;
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) setFavorites(parsed);
      } catch {}
    });
  }, []);
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

  const toggleFavorite = (therapist) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.id === therapist.id);
      const next = exists ? prev.filter(f => f.id !== therapist.id) : [...prev, therapist];
      AsyncStorage.setItem('revio_favorites', JSON.stringify(next));
      if (!exists) showToast(t('favSaved').replace('{name}', therapist.fullName));
      else showToast(`${therapist.fullName} ✕`);
      return next;
    });
  };
  const isFavorite = (id) => favorites.some(f => f.id === id);

  // Practice favorites — stored locally
  const [favoritePractices, setFavoritePractices] = useState([]);
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
  const [regStep, setRegStep] = useState(1);
  const [regSubmitted, setRegSubmitted] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regCitySearch, setRegCitySearch] = useState('');
  const [regSpecializations, setRegSpecializations] = useState([]);
  const [regLanguages, setRegLanguages] = useState(['de']);
  const [regFortbildungen, setRegFortbildungen] = useState([]);
  const regFreelance = true;
  const [regIsFreelance, setRegIsFreelance] = useState(null); // null | true | false
  const [regHomeVisit, setRegHomeVisit] = useState(false);
  const [regServiceRadius, setRegServiceRadius] = useState(null);
  const [regKassenart, setRegKassenart] = useState([]);
  const [regSpecSearch, setRegSpecSearch] = useState('');
  const [regLangSearch, setRegLangSearch] = useState('');
  const [regDocument, setRegDocument] = useState(null);
  const [regTaxRegistrationStatus, setRegTaxRegistrationStatus] = useState(null);
  const [regHealthAuthorityStatus, setRegHealthAuthorityStatus] = useState(null);
  const [regComplianceDraftReady, setRegComplianceDraftReady] = useState(false);
  const [showRegFortbildungen, setShowRegFortbildungen] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPasswordConfirm, setShowRegPasswordConfirm] = useState(false);
  const [showRegStepInfo, setShowRegStepInfo] = useState(false);

  const toggleRegSpec = (s) => setRegSpecializations(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleRegLang = (l) => setRegLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  const toggleRegFort = (f) => setRegFortbildungen(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  // Auth state
  const [authToken, setAuthToken] = useState(null);
  const [loggedInTherapist, setLoggedInTherapist] = useState(null);
  const [accountType, setAccountType] = useState(null); // 'therapist' | null
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editSpecializations, setEditSpecializations] = useState('');
  const [editLanguages, setEditLanguages] = useState([]);
  const [editHomeVisit, setEditHomeVisit] = useState(false);
  const [editServiceRadius, setEditServiceRadius] = useState(null);
  const [editKassenart, setEditKassenart] = useState('');
  const [editIsVisible, setEditIsVisible] = useState(true);
  const [editAvailability, setEditAvailability] = useState('');
  const [editTaxRegistrationStatus, setEditTaxRegistrationStatus] = useState(null);
  const [editHealthAuthorityStatus, setEditHealthAuthorityStatus] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [therapistDocuments, setTherapistDocuments] = useState([]);
  const [documentUploading, setDocumentUploading] = useState(false);


  // Invite claim flow state
  const [showInviteClaim, setShowInviteClaim] = useState(false);
  const [inviteClaimToken, setInviteClaimToken] = useState(null);
  const [inviteClaimData, setInviteClaimData] = useState(null); // { therapist, practice }
  const [inviteClaimLoading, setInviteClaimLoading] = useState(false);

  // Email verification deep-link state
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [emailVerifyStatus, setEmailVerifyStatus] = useState('idle');
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false); // 'verifying' | 'success' | 'error'
  const [emailVerifyError, setEmailVerifyError] = useState('');
  const [inviteClaimError, setInviteClaimError] = useState('');
  const [inviteClaimPassword, setInviteClaimPassword] = useState('');
  const [inviteClaimPasswordConfirm, setInviteClaimPasswordConfirm] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [showInvitePasswordConfirm, setShowInvitePasswordConfirm] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showProfileSavedModal, setShowProfileSavedModal] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(REGISTRATION_COMPLIANCE_DRAFT_KEY)
      .then((rawValue) => {
        if (!active) return;
        const draft = parseComplianceDraft(rawValue);
        setRegTaxRegistrationStatus(draft.taxRegistrationStatus);
        setRegHealthAuthorityStatus(draft.healthAuthorityStatus);
      })
      .finally(() => {
        if (active) setRegComplianceDraftReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!regComplianceDraftReady) return;

    if (!regTaxRegistrationStatus && !regHealthAuthorityStatus) {
      AsyncStorage.removeItem(REGISTRATION_COMPLIANCE_DRAFT_KEY).catch(() => {});
      return;
    }

    AsyncStorage.setItem(
      REGISTRATION_COMPLIANCE_DRAFT_KEY,
      JSON.stringify({
        taxRegistrationStatus: regTaxRegistrationStatus ?? null,
        healthAuthorityStatus: regHealthAuthorityStatus ?? null,
      }),
    ).catch(() => {});
  }, [regComplianceDraftReady, regTaxRegistrationStatus, regHealthAuthorityStatus]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('revio_auth_token'),
      AsyncStorage.getItem('revio_account_type'),
    ]).then(async ([token]) => {
      if (!token) return;
      try {
        const res = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setAuthToken(token);
          setAccountType('therapist');
          setLoggedInTherapist(normalizeTherapistProfile(await res.json()));
        } else {
          AsyncStorage.removeItem('revio_auth_token');
          AsyncStorage.removeItem('revio_account_type');
        }
      } catch {}
    });
  }, []);

  // Email verification deep-link handler (revo://verify?token=xxx)
  const handleVerifyEmailLink = async (token) => {
    setActiveTab('therapist');
    setShowLogin(false);
    setShowRegister(false);
    setEmailVerifyError('');
    setEmailVerifyStatus('verifying');
    setShowEmailVerify(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setEmailVerifyError(err.message ?? t('alertVerifyFailed'));
        setEmailVerifyStatus('error');
        return;
      }
      const data = await res.json();
      await AsyncStorage.setItem('revio_auth_token', data.token);
      await AsyncStorage.setItem('revio_account_type', 'therapist');
      setAuthToken(data.token);
      setAccountType('therapist');
      const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${data.token}`, ...TUNNEL_HEADERS },
      });
      if (profileRes.ok) {
        const profile = normalizeTherapistProfile(await profileRes.json());
        setLoggedInTherapist(profile);
        if (!profile.photo) setTimeout(() => setShowPhotoPrompt(true), 2800);
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
          setActiveTab('therapist');
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

  // Fetch therapist's uploaded documents on login/session restore
  useEffect(() => {
    if (authToken && accountType === 'therapist') {
      fetch(`${getBaseUrl()}/auth/documents`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((docs) => setTherapistDocuments(Array.isArray(docs) ? docs : []))
        .catch(() => {});
    } else {
      setTherapistDocuments([]);
    }
  }, [authToken, accountType]);

  // Poll notifications every 30s when logged in
  useEffect(() => {
    if (notificationPollRef.current) clearInterval(notificationPollRef.current);
    if (!authToken) {
      setNotifications([]);
      setReviewNotification(null);
      setShowReviewNotificationModal(false);
      return;
    }
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/notifications`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          let nextNotifications = Array.isArray(data.notifications) ? data.notifications : [];
          const nextReviewNotification = nextNotifications.find(
            (item) => REVIEW_NOTIFICATION_TYPES.has(item.type) && item.reviewStatus && item.therapistId,
          );

          if (accountType === 'therapist' && nextReviewNotification?.therapistId) {
            const seenStatus = await AsyncStorage.getItem(
              getReviewNotificationSeenKey(nextReviewNotification.therapistId),
            );

            if (seenStatus === nextReviewNotification.reviewStatus) {
              nextNotifications = nextNotifications.filter((item) => item.id !== nextReviewNotification.id);
            } else {
              setReviewNotification((prev) =>
                prev?.id === nextReviewNotification.id ? prev : nextReviewNotification,
              );
              setShowReviewNotificationModal(true);
            }

            setLoggedInTherapist((prev) => (
              prev?.id === nextReviewNotification.therapistId && prev.reviewStatus !== nextReviewNotification.reviewStatus
                ? { ...prev, reviewStatus: nextReviewNotification.reviewStatus }
                : prev
            ));
          }

          setNotifications(nextNotifications);
        }
      } catch {}
    };
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
      const nextType = 'therapist';
      await AsyncStorage.setItem('revio_auth_token', data.token);
      await AsyncStorage.setItem('revio_account_type', nextType);
      setAuthToken(data.token);
      setAccountType(nextType);

      const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (profileRes.ok) {
        const profile = normalizeTherapistProfile(await profileRes.json());
        setLoggedInTherapist(profile);
        registerPushToken(data.token);
        if (!profile.photo) {
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
    setAccountType(null);
  };

  const deleteAccountConfirmed = async () => {
    try {
      await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch {}
    await AsyncStorage.removeItem('revio_auth_token');
    setAuthToken(null);
    setLoggedInTherapist(null);
  };

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState('');

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

  const handleSaveProfile = async () => {
    if (!authToken || !loggedInTherapist?.id) return;
    setProfileSaving(true);

    const complianceDraftKey = getTherapistComplianceDraftKey(loggedInTherapist.id);
    const compliancePayload = {
      taxRegistrationStatus: editTaxRegistrationStatus ?? null,
      healthAuthorityStatus: editHealthAuthorityStatus ?? null,
    };

    try {
      await AsyncStorage.setItem(complianceDraftKey, JSON.stringify(compliancePayload));

      const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          bio: editBio,
          specializations: editSpecializations.split(',').map(s => s.trim()).filter(Boolean),
          languages: editLanguages.map(l => l.toLowerCase()),
          homeVisit: editHomeVisit,
          serviceRadiusKm: editHomeVisit ? (editServiceRadius ?? null) : null,
          kassenart: editKassenart,
          isVisible: editIsVisible,
          availability: editAvailability,
        }),
      });

      const profileData = await profileRes.json().catch(() => ({}));

      const complianceRes = await fetch(`${getBaseUrl()}/auth/me/compliance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(compliancePayload),
      });
      const complianceData = await complianceRes.json().catch(() => ({}));

      if (complianceRes.ok) {
        await AsyncStorage.removeItem(complianceDraftKey);
      }

      if (profileRes.ok || complianceRes.ok) {
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (profileRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await profileRes.json()));
      }

      if (profileRes.ok && complianceRes.ok) {
        setEditMode(false);
        setShowProfileSavedModal(true);
      } else if (profileRes.ok) {
        Alert.alert(t('alertHint'), t('profileSavedCompliancePendingBody'));
      } else if (complianceRes.ok) {
        Alert.alert(t('alertHint'), profileData.message ?? t('complianceOnlySavedBody'));
      } else {
        Alert.alert(
          t('alertError'),
          profileData.message ?? complianceData.message ?? t('alertProfileSaveFail'),
        );
      }
    } catch {
      Alert.alert(t('alertConnectionError'), t('alertConnectionErrorBody'));
    }
    setProfileSaving(false);
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    const filename = uri.split('/').pop() || 'photo.jpg';
    const mimeType = asset.mimeType || 'image/jpeg';
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri,
        name: filename,
        type: mimeType,
      });
      const uploadRes = await fetch(`${getBaseUrl()}/upload/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      if (uploadRes.ok) {
        await uploadRes.json();
        setLoggedInTherapist(prev => ({ ...prev, photo: uri }));
        Alert.alert(t('alertSuccess'), t('alertAvatarSaved'));
      } else {
        const status = uploadRes.status;
        Alert.alert(t('alertError'), t('alertPhotoUploadFail') + ` (${status})`);
      }
    } catch {
      Alert.alert(t('alertConnectionError'), t('alertConnectionErrorBody'));
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!validateDocumentSize(asset, t)) return;

      const formData = new FormData();
      formData.append('document', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      });

      setDocumentUploading(true);
      const res = await fetch(`${getBaseUrl()}/upload/document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (res.ok) {
        const { id, originalName } = await res.json();
        setTherapistDocuments((prev) => [{ id, originalName, mimetype: asset.mimeType }, ...prev]);
        Alert.alert(t('alertUploaded'), t('alertUploadedBody').replace('{name}', originalName));
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert(t('alertError'), errData.message ?? t('alertDocUploadFail'));
      }
    } catch {
      Alert.alert(t('alertConnectionError'), t('alertConnectionErrorBody'));
    } finally {
      setDocumentUploading(false);
    }
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
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationPollRef = React.useRef(null);
  const [showReviewNotificationModal, setShowReviewNotificationModal] = useState(false);
  const [reviewNotification, setReviewNotification] = useState(null);
  const [locationLabel, setLocationLabel] = useState(''); // display: "Hauptstraße 5, München"
  const [showLocationSheet, setShowLocationSheet] = useState(false);
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

  const activeFilterCount = (homeVisit ? 1 : 0) + (kassenart ? 1 : 0) + fortbildungen.length;
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
  }, [homeVisit, kassenart, fortbildungen]);

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

      // If the current radius leaves the user with no visible results, fall back
      // to city-wide matches so the seeded dataset still feels searchable in dev.
      if (origin && filtered.length === 0) {
        const cityOnlyMapped = await fetchSearchResults(q, effectiveCity, null);
        const cityOnlyFiltered = applyFilters(cityOnlyMapped, null);
        if (cityOnlyFiltered.length > 0) {
          filtered = cityOnlyFiltered;
          sourceList = cityOnlyMapped;
        }
      }

      if (filtered.length === 0 && withDist.length > 0) {
        Alert.alert(t('alertRadiusTooSmall'), t('alertRadiusTooSmallBody').replace('{n}', withDist.length).replace('{radius}', searchRadius));
      }
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
    if (pendingQuery !== null || searchedRef.current) {
      runSearchWith(pendingQuery ?? query, coords, resolvedCity, coords ?? null);
    }
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
          confirmLocationAndSearch(input, null, input);
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
          // Fallback: use input as-is (last word as city heuristic)
          confirmLocationAndSearch(input, null, input);
        }
      }
    } catch {
      confirmLocationAndSearch(input, null, input);
    }
    setLocationLoading(false);
  };

  // Load saved city + label + language from AsyncStorage on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('savedCity'),
      AsyncStorage.getItem('savedLocationLabel'),
      AsyncStorage.getItem('appLanguage'),
      AsyncStorage.getItem('savedCoords'),
      AsyncStorage.getItem('themeMode'),
    ]).then(([savedCity, savedLabel, savedLang, savedCoords, savedThemeMode]) => {
      if (savedCity) setCity(savedCity);
      if (savedLabel) setLocationLabel(savedLabel);
      if (savedLang === 'de' || savedLang === 'en') setAppLanguage(savedLang);
      if (savedThemeMode === 'light' || savedThemeMode === 'dark') setThemeMode(savedThemeMode);
      if (savedCoords) {
        try { setUserCoords(JSON.parse(savedCoords)); } catch {}
      }
    });
  }, []);



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
        setSelectedPracticeTherapists((data.therapists ?? []).map(th => ({
          ...th,
          photo: th.photo
            ? (th.photo.startsWith('http') ? th.photo : `${getBaseUrl()}${th.photo}`)
            : `https://i.pravatar.cc/96?u=${th.id}`,
          specializations: Array.isArray(th.specializations) ? th.specializations : [],
        })));
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

  const openTherapistById = (id) => {
    const th = results.find(x => x.id === id)
      || favorites.find(x => x.id === id)
      || selectedPracticeTherapists.find(x => x.id === id);
    if (th) setSelectedTherapist(th);
  };

  // ── Discover tab ──────────────────────────────────────────────────────────

  const mapTherapists = React.useMemo(
    () => results.filter((th) => th.homeVisit && th.homeLat && th.homeLng && th.serviceRadiusKm),
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
    const avgLat = mapTherapists.reduce((s, th) => s + th.homeLat, 0) / mapTherapists.length;
    const avgLng = mapTherapists.reduce((s, th) => s + th.homeLng, 0) / mapTherapists.length;
    const latSpan = Math.max(...mapTherapists.map((th) => Math.abs(th.homeLat - avgLat))) * 2.2 || 0.08;
    const lngSpan = Math.max(...mapTherapists.map((th) => Math.abs(th.homeLng - avgLng))) * 2.2 || 0.08;
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
      />
    );
  };

  // ── Login screen ──────────────────────────────────────────────────────────

  const renderLogin = () => (
    <LoginScreen
      c={c}
      handleLogin={handleLogin}
      loginEmail={loginEmail}
      loginError={loginError}
      loginLoading={loginLoading}
      loginPassword={loginPassword}
      setLoginEmail={setLoginEmail}
      setLoginPassword={setLoginPassword}
      setShowLogin={setShowLogin}
      styles={styles}
      t={t}
    />
  );

  // ── Therapist dashboard (logged in) ───────────────��───────────────────────

  const renderTherapistDashboard = () => {
    const th = loggedInTherapist;

    const enterEdit = async () => {
      const draft = th?.id
        ? parseComplianceDraft(await AsyncStorage.getItem(getTherapistComplianceDraftKey(th.id)))
        : normalizeComplianceDraft(null);
      const nextCompliance = draft.taxRegistrationStatus || draft.healthAuthorityStatus
        ? draft
        : normalizeComplianceDraft(th?.compliance);

      setEditBio(th.bio ?? '');
      setEditSpecializations((th.specializations ?? []).join(', '));
      setEditLanguages(normalizeLanguageCodes(th.languages));
      setEditHomeVisit(th.homeVisit ?? false);
      setEditServiceRadius(th.serviceRadiusKm ?? null);
      setEditKassenart(th.kassenart ?? '');
      setEditIsVisible(th.isVisible ?? true);
      setEditAvailability(th.availability ?? '');
      setEditTaxRegistrationStatus(nextCompliance.taxRegistrationStatus);
      setEditHealthAuthorityStatus(nextCompliance.healthAuthorityStatus);
      setEditMode(true);
    };

    return (
      <TherapistDashboardScreen
        authToken={authToken}
        c={c}
        editAvailability={editAvailability}
        editBio={editBio}
        editHealthAuthorityStatus={editHealthAuthorityStatus}
        editHomeVisit={editHomeVisit}
        editIsVisible={editIsVisible}
        editKassenart={editKassenart}
        editLanguages={editLanguages}
        editMode={editMode}
        editServiceRadius={editServiceRadius}
        editSpecializations={editSpecializations}
        editTaxRegistrationStatus={editTaxRegistrationStatus}
        documentUploading={documentUploading}
        handlePickDocument={handlePickDocument}
        handlePickPhoto={handlePickPhoto}
        handleSaveProfile={handleSaveProfile}
        therapistDocuments={therapistDocuments}
        loggedInTherapist={loggedInTherapist}
        onEnterEdit={enterEdit}
        profileSaving={profileSaving}
        setEditAvailability={setEditAvailability}
        setEditBio={setEditBio}
        setEditHomeVisit={setEditHomeVisit}
        setEditIsVisible={setEditIsVisible}
        setEditKassenart={setEditKassenart}
        setEditHealthAuthorityStatus={setEditHealthAuthorityStatus}
        setEditLanguages={setEditLanguages}
        setEditMode={setEditMode}
        setEditServiceRadius={setEditServiceRadius}
        setEditSpecializations={setEditSpecializations}
        setEditTaxRegistrationStatus={setEditTaxRegistrationStatus}
        styles={styles}
        t={t}
      />
    );
  };

  // ── Therapist tab ─────────────────────────────────────────────────────────

  const renderTherapist = () => (
    <TherapistLandingScreen
      __DEV__={__DEV__}
      c={c}
      setRegStep={setRegStep}
      setRegSubmitted={setRegSubmitted}
      setShowLogin={setShowLogin}
      setShowRegister={setShowRegister}
      styles={styles}
      t={t}
    />
  );

  // ── Optionen tab ──────────────────────────────────────────────────────────

  const renderOptions = () => {
    const SectionHeader = ({ title }) => (
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 6, paddingHorizontal: 4 }}>{title}</Text>
    );
    const OptionRow = ({ label, value, onPress, icon, valueColor, last }) => (
      <Pressable
        onPress={onPress}
        style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border, marginBottom: last ? 0 : 1, borderRadius: 0 }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {icon ? <Ionicons name={icon} size={18} color={c.muted} /> : null}
          <Text style={[styles.optionLabel, { color: c.text }]}>{label}</Text>
        </View>
        <Text style={[styles.optionValue, { color: valueColor ?? c.muted }]}>{value} ›</Text>
      </Pressable>
    );
    const OptionGroup = ({ children }) => (
      <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>{children}</View>
    );

    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
          <View style={[styles.header, { marginBottom: 0 }]}>
            <Image source={require('../assets/icon.png')} style={styles.logoMark} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: c.text }]}>{t('optionsTitle')}</Text>
              <Text style={[styles.headerSub, { color: c.muted }]}>{t('optionsSubtitle')}</Text>
            </View>
          </View>
        </View>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: SPACE.sm }]} showsVerticalScrollIndicator={false}>

          {/* ── Mein Profil ── */}
          {loggedInTherapist && (
            <>
              <SectionHeader title="Mein Profil" />
              <OptionGroup>
                <Pressable onPress={() => setActiveTab('therapist')} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: c.mutedBg, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                      {loggedInTherapist.photo
                        ? <Image source={{ uri: loggedInTherapist.photo.startsWith('http') ? loggedInTherapist.photo : `${getBaseUrl()}${loggedInTherapist.photo}` }} style={{ width: 44, height: 44, borderRadius: 999 }} />
                        : <Text style={{ fontSize: 18, fontWeight: '700', color: c.muted }}>{(loggedInTherapist.fullName ?? '?')[0].toUpperCase()}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{loggedInTherapist.fullName ?? '—'}</Text>
                      <Text style={{ fontSize: 12, color: loggedInTherapist.isVisible && loggedInTherapist.reviewStatus === 'APPROVED' ? c.success : c.muted }}>
                        {loggedInTherapist.isVisible && loggedInTherapist.reviewStatus === 'APPROVED' ? t('publiclyVisible') : t('notYetPublic')}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.muted} />
                </Pressable>
              </OptionGroup>
            </>
          )}

          {!loggedInTherapist && (
            <>
              <SectionHeader title="Mein Profil" />
              <OptionGroup>
                <Pressable onPress={() => { setActiveTab('therapist'); setShowLogin(true); }} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
                  <Text style={[styles.optionLabel, { color: c.muted }]}>{t('notLoggedIn')}</Text>
                  <Text style={[styles.optionValue, { color: c.primary }]}>{t('loginAction')} ›</Text>
                </Pressable>
              </OptionGroup>
            </>
          )}

          {/* ── App-Einstellungen ── */}
          <SectionHeader title="App-Einstellungen" />
          <OptionGroup>
            <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="language-outline" size={18} color={c.muted} />
                <Text style={[styles.optionLabel, { color: c.text }]}>{t('languageOption')}</Text>
              </View>
              <View style={styles.themeToggleRow}>
                {[{ key: 'de', label: 'DE' }, { key: 'en', label: 'EN' }].map(({ key, label }) => (
                  <Pressable key={key} onPress={() => { setAppLanguage(key); AsyncStorage.setItem('appLanguage', key); }}
                    style={[styles.themeBtn, appLanguage === key ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                    <Text style={[styles.themeBtnText, { color: appLanguage === key ? '#FFFFFF' : c.muted }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable onPress={() => setShowNotifications(true)} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="notifications-outline" size={18} color={c.muted} />
                <Text style={[styles.optionLabel, { color: c.text }]}>{t('notificationsOption')}</Text>
              </View>
              <Text style={[styles.optionValue, { color: notifications.length > 0 ? c.primary : c.muted }]}>
                {notifications.length > 0 ? `${notifications.length} ›` : '›'}
              </Text>
            </Pressable>
            <Pressable onPress={() => Linking.openSettings()} style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="phone-portrait-outline" size={18} color={c.muted} />
                <Text style={[styles.optionLabel, { color: c.text }]}>{t('deviceSettings')}</Text>
              </View>
              <Text style={[styles.optionValue, { color: c.muted }]}>›</Text>
            </Pressable>
            <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="contrast-outline" size={18} color={c.muted} />
                <Text style={[styles.optionLabel, { color: c.text }]}>{t('appearanceOption')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                <Text style={[styles.optionValue, { color: c.muted }]}>{themeMode === 'dark' ? t('themeDark') : t('themeLight')}</Text>
                <Switch value={themeMode === 'dark'} onValueChange={(v) => { const m = v ? 'dark' : 'light'; setThemeMode(m); AsyncStorage.setItem('themeMode', m); }}
                  trackColor={{ false: c.border, true: c.primary }} ios_backgroundColor={c.border} thumbColor="#FFFFFF" />
              </View>
            </View>
          </OptionGroup>

          {/* ── Hilfe & Support ── */}
          <SectionHeader title={t('helpSupportSection')} />
          <OptionGroup>
            <Pressable style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="help-circle-outline" size={18} color={c.muted} />
                <Text style={[styles.optionLabel, { color: c.text }]}>{t('faqOption')}</Text>
              </View>
              <Text style={[styles.optionValue, { color: c.muted }]}>{t('comingSoon')} ›</Text>
            </Pressable>
            <Pressable style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="chatbubble-outline" size={18} color={c.muted} />
                <Text style={[styles.optionLabel, { color: c.text }]}>{t('appFeedback')}</Text>
              </View>
              <Text style={[styles.optionValue, { color: c.muted }]}>{t('comingSoon')} ›</Text>
            </Pressable>
          </OptionGroup>

          {/* ── Rechtliches ── */}
          <SectionHeader title={t('legalSection')} />
          <OptionGroup>
            <Pressable style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="document-text-outline" size={18} color={c.muted} />
                <Text style={[styles.optionLabel, { color: c.text }]}>{t('termsLabel')}</Text>
              </View>
              <Text style={[styles.optionValue, { color: c.muted }]}>›</Text>
            </Pressable>
            <Pressable style={[styles.optionRow, { backgroundColor: c.card, borderColor: 'transparent', borderTopWidth: 1, borderTopColor: c.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="shield-outline" size={18} color={c.muted} />
                <Text style={[styles.optionLabel, { color: c.text }]}>{t('privacyLabel')}</Text>
              </View>
              <Text style={[styles.optionValue, { color: c.muted }]}>›</Text>
            </Pressable>
          </OptionGroup>

          {/* ── App-Version & Logout ── */}
          <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center', marginTop: 20 }}>Version 0.1.0 MVP</Text>

          {loggedInTherapist && (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Pressable onPress={handleLogout}
                style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{t('logoutBtn')}</Text>
              </Pressable>
              <Pressable onPress={handleDeleteAccount} style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: c.muted, fontSize: 14 }}>{t('deleteAccount')}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };


  const renderFavorites = () => (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
        <View style={[styles.header, { marginBottom: 0 }]}>
          <Image source={require('../assets/icon.png')} style={styles.logoMark} />
          <Text style={[styles.headerTitle, { color: c.text }]}>{t('favoritesTitle')}</Text>
        </View>
      </View>
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20, paddingTop: SPACE.sm }]} showsVerticalScrollIndicator={false}>

      <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border, marginBottom: 4 }]}>
        <View style={styles.lockBadge}>
          <Ionicons name="bookmark-outline" size={16} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.noticeBody, { color: c.muted, flex: 0 }]}>{t('favoritesHint')}</Text>
        </View>
      </View>

      {favorites.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.emptyIcon}>♡</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('favoritesEmpty')}</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>{t('favoritesEmptyBody')}</Text>
        </View>
      ) : null}

      {favorites.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: c.text }]}>{t('favoritesTherapists')}</Text>
          {favorites.map((fav) => (
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
          ))}
        </>
      )}
    </ScrollView>
    </View>
  );

  // ── Register flow ──────────────────────────────────────────────────────────

  const renderRegister = () => {
    if (regSubmitted) {
      return (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
          <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center', paddingVertical: 40 }]}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
            <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center' }]}>{t('regCompleteTitle')}</Text>
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>
              {__DEV__
                ? t('registrationInfoBodyDev')
                : t('regCompleteBody')}
            </Text>
            <Pressable
              style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 24, paddingHorizontal: 32 }]}
              onPress={() => {
                Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:').catch(() => {});
              }}
            >
              <Text style={styles.registerBtnText}>{t('verifyEmailBtn')}</Text>
            </Pressable>
            <Pressable onPress={() => { setShowRegister(false); setRegSubmitted(false); setRegStep(1); setRegIsFreelance(null); setRegSpecSearch(''); setRegLangSearch(''); setShowRegFortbildungen(false); setRegDocument(null); }} style={{ marginTop: 12 }}>
              <Text style={{ color: c.muted, fontSize: 13 }}>{t('laterBtn')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    const renderProgress = () => (
      <View style={styles.regProgressRow}>
        {Array.from({ length: REG_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[styles.regProgressBar, { backgroundColor: i < regStep ? c.primary : c.border }]}
          />
        ))}
      </View>
    );

    const canProceed = () => {
      switch (regStep) {
        case 1:
          return regEmail.length > 3 && regPassword.length >= 6 && regPassword === regPasswordConfirm;
        case 2:
          return regFirstName.trim().length > 0 && regLastName.trim().length > 0 && regCity.trim().length > 0;
        case 3:
          return regIsFreelance === true;
        case 6:
          return Boolean(regDocument);
        default:
          return true;
      }
    };

    const renderStepContent = () => {
      switch (regStep) {
        case 1:
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={[styles.regStepTitle, { color: c.text, marginBottom: 0 }]}>{t('createAccountTitle')}</Text>
                <Pressable onPress={() => setShowRegStepInfo(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={{ fontSize: 12, color: c.muted }}>{t('infoLabel')}</Text>
                  <Ionicons name={showRegStepInfo ? 'chevron-up' : 'chevron-down'} size={13} color={c.muted} />
                </Pressable>
              </View>
              {showRegStepInfo && (
                <View style={{ backgroundColor: c.mutedBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{REG_STEP_INFO[1]}</Text>
                </View>
              )}
              <TextInput value={regEmail} onChangeText={setRegEmail} placeholder={t('emailLabel')} placeholderTextColor={c.muted} keyboardType="email-address" autoCapitalize="none" style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <View style={{ position: 'relative' }}>
                <TextInput value={regPassword} onChangeText={setRegPassword} placeholder={t('passwordPlaceholder')} placeholderTextColor={c.muted} secureTextEntry={!showRegPassword} textContentType="newPassword" autoComplete="new-password" style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text, paddingRight: 44 }]} />
                <Pressable onPress={() => setShowRegPassword(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <Ionicons name={showRegPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
                </Pressable>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput value={regPasswordConfirm} onChangeText={setRegPasswordConfirm} placeholder={t('passwordConfirmPlaceholder')} placeholderTextColor={c.muted} secureTextEntry={!showRegPasswordConfirm} textContentType="newPassword" autoComplete="new-password" style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text, paddingRight: 44 }]} />
                <Pressable onPress={() => setShowRegPasswordConfirm(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <Ionicons name={showRegPasswordConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
                </Pressable>
              </View>
              {regPasswordConfirm.length > 0 && regPassword !== regPasswordConfirm && (
                <Text style={{ color: c.saved, fontSize: 13, marginTop: -6 }}>{t('passwordsMismatch')}</Text>
              )}
            </>
          );
        case 2:
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={[styles.regStepTitle, { color: c.text, marginBottom: 0 }]}>{t('personalDetailsTitle')}</Text>
                <Pressable onPress={() => setShowRegStepInfo(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={{ fontSize: 12, color: c.muted }}>{t('infoLabel')}</Text>
                  <Ionicons name={showRegStepInfo ? 'chevron-up' : 'chevron-down'} size={13} color={c.muted} />
                </Pressable>
              </View>
              {showRegStepInfo && (
                <View style={{ backgroundColor: c.mutedBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{REG_STEP_INFO[2]}</Text>
                </View>
              )}
              <TextInput value={regFirstName} onChangeText={setRegFirstName} placeholder={t('firstNamePlaceholder')} placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: regFirstName.length > 0 && regFirstName.trim().length === 0 ? c.saved : c.border, color: c.text }]} />
              {regFirstName.length > 0 && regFirstName.trim().length === 0 && (
                <Text style={{ color: c.saved, fontSize: 13, marginTop: -6 }}>{t('firstNameRequired')}</Text>
              )}
              <TextInput value={regLastName} onChangeText={setRegLastName} placeholder={t('lastNamePlaceholder')} placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: regLastName.length > 0 && regLastName.trim().length === 0 ? c.saved : c.border, color: c.text }]} />
              {regLastName.length > 0 && regLastName.trim().length === 0 && (
                <Text style={{ color: c.saved, fontSize: 13, marginTop: -6 }}>{t('lastNameRequired')}</Text>
              )}
              {regCity ? (
                <View style={[styles.tagRow, { marginBottom: 8 }]}>
                  <Pressable onPress={() => { setRegCity(''); setRegCitySearch(''); }} style={[styles.chip, { backgroundColor: c.primary, borderColor: c.primary }]}>
                    <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{regCity} ×</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput
                    value={regCitySearch}
                    onChangeText={setRegCitySearch}
                    placeholder={t('searchCityPlaceholder')}
                    placeholderTextColor={c.muted}
                    style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
                  />
                  {regCitySearch.length > 0 && (() => {
                    const citySuggestions = GERMAN_CITIES.filter(ci => ci.toLowerCase().includes(regCitySearch.toLowerCase())).slice(0, 6);
                    return citySuggestions.length > 0 ? (
                      <View style={{ backgroundColor: c.card, borderRadius: 8, borderWidth: 1, borderColor: c.border, marginTop: -8, marginBottom: 8 }}>
                        {citySuggestions.map((ci) => (
                          <Pressable
                            key={ci}
                            onPress={() => { setRegCity(ci); setRegCitySearch(''); }}
                            style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}
                          >
                            <Text style={{ color: c.text, fontSize: 14 }}>{ci}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null;
                  })()}
                </>
              )}
            </>
          );
        case 3:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>{t('freelanceCheckTitle')}</Text>
              <Text style={{ fontSize: 14, color: c.muted, marginBottom: SPACE.lg, lineHeight: 20 }}>
                {t('freelanceCheckBody')}
              </Text>
              <View style={{ gap: 12 }}>
                <Pressable
                  onPress={() => setRegIsFreelance(true)}
                  style={[styles.optionRow, {
                    backgroundColor: regIsFreelance === true ? c.primaryBg : c.card,
                    borderColor: regIsFreelance === true ? c.primary : c.border,
                  }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: c.text }]}>{t('yesLabel')}</Text>
                    <Text style={[styles.optionValue, { color: c.muted, fontSize: 12 }]}>{t('freelanceCheckYesSub')}</Text>
                  </View>
                  {regIsFreelance === true && <Ionicons name="checkmark-circle" size={22} color={c.primary} />}
                </Pressable>
                <Pressable
                  onPress={() => setRegIsFreelance(false)}
                  style={[styles.optionRow, {
                    backgroundColor: regIsFreelance === false ? '#FEF2F2' : c.card,
                    borderColor: regIsFreelance === false ? c.error : c.border,
                  }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: c.text }]}>{t('noLabel')}</Text>
                    <Text style={[styles.optionValue, { color: c.muted, fontSize: 12 }]}>{t('freelanceCheckNoSub')}</Text>
                  </View>
                  {regIsFreelance === false && <Ionicons name="close-circle" size={22} color={c.error} />}
                </Pressable>
              </View>
              {regIsFreelance === false && (
                <View style={[styles.noticeBox, { backgroundColor: '#FEF2F2', borderColor: c.error, marginTop: SPACE.md }]}>
                  <Text style={styles.noticeIcon}>⚠️</Text>
                  <Text style={[styles.noticeBody, { color: c.error }]}>{t('freelanceCheckBlockedMsg')}</Text>
                </View>
              )}
            </>
          );
        case 4: {
          const langSuggestions4 = regLangSearch.length > 0
            ? languageOptions.filter(l => getLangLabel(l).toLowerCase().includes(regLangSearch.toLowerCase()) && !regLanguages.includes(l)).slice(0, 6)
            : [];
          const specSuggestions4 = regSpecSearch.length > 0
            ? regSpecOptions.filter(s => s.toLowerCase().includes(regSpecSearch.toLowerCase()) && !regSpecializations.includes(s)).slice(0, 6)
            : [];
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={[styles.regStepTitle, { color: c.text, marginBottom: 0 }]}>{t('langAndSpecTitle')}</Text>
                <Pressable onPress={() => setShowRegStepInfo(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={{ fontSize: 12, color: c.muted }}>{t('infoLabel')}</Text>
                  <Ionicons name={showRegStepInfo ? 'chevron-up' : 'chevron-down'} size={13} color={c.muted} />
                </Pressable>
              </View>
              {showRegStepInfo && (
                <View style={{ backgroundColor: c.mutedBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border, marginBottom: SPACE.sm }}>
                  <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{REG_STEP_INFO[4]}</Text>
                </View>
              )}

              <View style={styles.sectionBadgeRow}>
                <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 0 }]}>{t('languagesLabel')}</Text>
                <View style={[styles.inlineMetaPill, { backgroundColor: c.primaryBg }]}>
                  <Text style={[styles.inlineMetaPillText, { color: c.primary }]}>{t('requiredBadge')}</Text>
                </View>
              </View>
              <Text style={[styles.metaNote, { color: c.textMuted, marginBottom: 8 }]}>{t('germanPreselected')}</Text>
              {regLanguages.length > 0 && (
                <View style={[styles.tagRow, { marginBottom: 8 }]}>
                  {regLanguages.map(l => (
                    <Pressable key={l} onPress={() => toggleRegLang(l)} style={[styles.chip, { backgroundColor: c.primary, borderColor: c.primary }]}>
                      <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{getLangLabel(l)} ×</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {langSuggestions4.length > 0 && (
                <View style={{ borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, marginBottom: 4, overflow: 'hidden', backgroundColor: c.card }}>
                  {langSuggestions4.map((l, i) => (
                    <Pressable key={l} onPress={() => { toggleRegLang(l); setRegLangSearch(''); }}
                      style={{ padding: SPACE.md, borderTopWidth: i > 0 ? 1 : 0, borderColor: c.border }}>
                      <Text style={{ ...TYPE.body, color: c.text }}>{getLangLabel(l)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <TextInput
                value={regLangSearch}
                onChangeText={setRegLangSearch}
                placeholder={t('addLangPlaceholder')}
                placeholderTextColor={c.muted}
                style={[styles.regInput, { backgroundColor: c.card, borderColor: regLanguages.length > 0 ? c.primary : c.border, color: c.text }]}
              />

              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>
                {t('specializationsOptional')} <Text style={styles.optionalInlineLabel}>{t('optionalHint')}</Text>
              </Text>
              <TextInput
                value={regSpecSearch}
                onChangeText={setRegSpecSearch}
                placeholder={t('searchSpecPlaceholder')}
                placeholderTextColor={c.muted}
                style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
              />
              {specSuggestions4.length > 0 && (
                <View style={{ borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, marginTop: -8, marginBottom: 8, overflow: 'hidden', backgroundColor: c.card }}>
                  {specSuggestions4.map((s, i) => (
                    <Pressable
                      key={s}
                      onPress={() => { toggleRegSpec(s); setRegSpecSearch(''); }}
                      style={{ padding: SPACE.md, borderTopWidth: i > 0 ? 1 : 0, borderColor: c.border }}
                    >
                      <Text style={{ ...TYPE.body, color: c.text }}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {regSpecializations.length > 0 && (
                <View style={[styles.tagRow, { marginBottom: 8 }]}>
                  {regSpecializations.map((s) => (
                    <Pressable key={s} onPress={() => toggleRegSpec(s)} style={[styles.chip, { backgroundColor: c.primary, borderColor: c.primary }]}>
                      <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{s} ×</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Pressable
                onPress={() => setShowRegFortbildungen((value) => !value)}
                style={[styles.collapseToggle, { backgroundColor: c.card, borderColor: c.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 2 }]}>{t('certificationsLabel')}</Text>
                  <Text style={[styles.metaNote, { color: c.textMuted }]}>{t('optionalBadge')}</Text>
                </View>
                <Ionicons name={showRegFortbildungen ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={c.textMuted} />
              </Pressable>
              {showRegFortbildungen && certificationOptions.map((opt) => {
                const checked = regFortbildungen.includes(opt.key);
                return (
                  <Pressable key={opt.key} onPress={() => toggleRegFort(opt.key)} style={styles.checkRow}>
                    <View style={[styles.checkbox, { borderColor: checked ? c.primary : c.border, backgroundColor: checked ? c.primary : 'transparent' }]}>
                      {checked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.checkLabel, { color: c.text }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </>
          );
        }
        case 5:
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={[styles.regStepTitle, { color: c.text, marginBottom: 0 }]}>{t('complianceSectionTitle')}</Text>
                <Pressable onPress={() => setShowRegStepInfo(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={{ fontSize: 12, color: c.muted }}>{t('infoLabel')}</Text>
                  <Ionicons name={showRegStepInfo ? 'chevron-up' : 'chevron-down'} size={13} color={c.muted} />
                </Pressable>
              </View>
              {showRegStepInfo && (
                <View style={{ backgroundColor: c.mutedBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border, marginBottom: SPACE.sm }}>
                  <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{REG_STEP_INFO[5]}</Text>
                </View>
              )}
              <ComplianceStatusStep
                c={c}
                healthAuthorityStatus={regHealthAuthorityStatus}
                onChangeHealthAuthorityStatus={setRegHealthAuthorityStatus}
                onChangeTaxRegistrationStatus={setRegTaxRegistrationStatus}
                t={t}
                taxRegistrationStatus={regTaxRegistrationStatus}
              />
            </>
          );
        case 6:
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={[styles.regStepTitle, { color: c.text, marginBottom: 0 }]}>{t('registrationDocumentTitle')}</Text>
                <Pressable onPress={() => setShowRegStepInfo(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={{ fontSize: 12, color: c.muted }}>{t('infoLabel')}</Text>
                  <Ionicons name={showRegStepInfo ? 'chevron-up' : 'chevron-down'} size={13} color={c.muted} />
                </Pressable>
              </View>
              {showRegStepInfo && (
                <View style={{ backgroundColor: c.mutedBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border, marginBottom: SPACE.sm }}>
                  <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{REG_STEP_INFO[6]}</Text>
                </View>
              )}

              <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border, marginBottom: SPACE.sm }]}>
                <Text style={styles.noticeIcon}>📄</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.noticeBody, { color: c.muted }]}>{t('registrationDocumentBody')}</Text>
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('registrationDocumentSizeHint')}</Text>
                </View>
              </View>

              <Pressable
                onPress={handlePickRegistrationDocument}
                style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border, marginBottom: SPACE.sm }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="document-attach-outline" size={18} color={c.primary} />
                  <Text style={[styles.optionLabel, { color: c.text }]}>
                    {regDocument ? t('registrationDocumentReplaceBtn') : t('registrationDocumentUploadBtn')}
                  </Text>
                </View>
                <Text style={[styles.optionValue, { color: c.primary }]}>›</Text>
              </Pressable>

              {regDocument ? (
                <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
                  <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 8 }]}>{t('registrationDocumentSelected')}</Text>
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{regDocument.name || 'Dokument'}</Text>
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
                    {[
                      regDocument.mimeType || 'application/octet-stream',
                      formatDocumentSize(regDocument.size),
                    ].filter(Boolean).join(' • ')}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: c.saved, fontSize: 13 }}>{t('registrationDocumentMissing')}</Text>
              )}
            </>
          );
        case 7:
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={[styles.regStepTitle, { color: c.text, marginBottom: 0 }]}>{t('previewSubmitTitle')}</Text>
                <Pressable onPress={() => setShowRegStepInfo(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={{ fontSize: 12, color: c.muted }}>{t('infoLabel')}</Text>
                  <Ionicons name={showRegStepInfo ? 'chevron-up' : 'chevron-down'} size={13} color={c.muted} />
                </Pressable>
              </View>
              {showRegStepInfo && (
                <View style={{ backgroundColor: c.mutedBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{REG_STEP_INFO[7]}</Text>
                </View>
              )}
              {[
                { label: t('nameLabel'), value: `${regFirstName} ${regLastName}`.trim() || '—' },
                { label: t('emailLabel'), value: regEmail || '—' },
                { label: t('cityLabel'), value: regCity || '—' },
                { label: t('activityLabel'), value: t('freelanceLabel') },
                { label: t('specsLabel'), value: regSpecializations.join(', ') || '—' },
                { label: t('languagesLabel'), value: regLanguages.map(getLangLabel).join(', ') || '—' },
                { label: t('certificationsShort'), value: regFortbildungen.map(getCertificationLabel).join(', ') || '—' },
                { label: t('taxRegistrationLabel'), value: getComplianceStatusLabel(regTaxRegistrationStatus, t) },
                { label: t('healthAuthorityLabel'), value: getComplianceStatusLabel(regHealthAuthorityStatus, t) },
                { label: t('documentLabel'), value: regDocument?.name || '—' },
              ].map(row => (
                <View key={row.label} style={[styles.previewRow, { borderBottomColor: c.border }]}>
                  <Text style={[styles.previewLabel, { color: c.muted }]}>{row.label}</Text>
                  <Text style={[styles.previewValue, { color: c.text }]}>{row.value}</Text>
                </View>
              ))}
              <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                <Text style={styles.noticeIcon}>ℹ️</Text>
                <Text style={[styles.noticeBody, { color: c.muted }]}>
                  {t('profileReviewNotice')}
                </Text>
              </View>
            </>
          );
        default:
          return null;
      }
    };

    const REG_STEP_INFO = {
      1: t('regStepInfoText1'),
      2: t('regStepInfoText2'),
      4: t('regStepInfoText4'),
      5: t('regStepInfoText5'),
      6: t('regStepInfoText6'),
      7: t('regStepInfoText7'),
    };

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 20, paddingBottom: 20, gap: SPACE.sm }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => {
            if (regStep === 1) {
              setShowRegister(false);
              setShowRegFortbildungen(false);
              setRegDocument(null);
            } else {
              setRegStep(s => s - 1);
              setShowRegStepInfo(false);
            }
          }}
          style={styles.backBtn}
        >
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {regStep === 1 ? t('cancelBtn') : t('backBtn')}</Text>
        </Pressable>

        {/* Header */}
        <View style={{ marginBottom: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{t('registrationTitle')}</Text>
          <Text style={{ fontSize: 11, color: c.muted }}>Schritt {regStep} von {REG_STEPS}</Text>
        </View>

        {renderProgress()}

        {renderStepContent()}

        <Pressable
          style={[styles.registerBtn, { backgroundColor: canProceed() ? c.primary : c.border, marginTop: 8 }]}
          onPress={async () => {
            if (!canProceed()) return;
            if (regStep < REG_STEPS) {
              setRegStep(s => s + 1);
              setShowRegStepInfo(false);
            } else {
              try {
                const res = await fetch(`${getBaseUrl()}/register/therapist`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: regEmail,
                    password: regPassword,
                    fullName: `${regFirstName} ${regLastName}`.trim(),
                    city: regCity || undefined,
                    specializations: regSpecializations,
                    languages: regLanguages.map(l => l.toLowerCase()),
                    certifications: regFortbildungen,
                    homeVisit: regHomeVisit === true,
                    serviceRadiusKm: regHomeVisit === true ? (regServiceRadius ?? null) : null,
                    kassenart: regKassenart.length ? regKassenart.join(',') : undefined,
                    compliance: {
                      taxRegistrationStatus: regTaxRegistrationStatus ?? undefined,
                      healthAuthorityStatus: regHealthAuthorityStatus ?? undefined,
                    },
                  }),
                });
                const resData = await res.json().catch(() => ({}));
                if (!res.ok) {
                  const msg = typeof resData.message === 'string' ? resData.message : (resData.error ?? `Fehler ${res.status}`);
                  showWebAlert(msg);
                  return;
                }
                if (resData.token) {
                  await AsyncStorage.setItem('revio_auth_token', resData.token);
                  await AsyncStorage.setItem('revio_account_type', 'therapist');
                  setAuthToken(resData.token);
                  setAccountType('therapist');

                  if (regDocument?.uri) {
                    try {
                      setDocumentUploading(true);
                      const formData = new FormData();
                      formData.append('document', {
                        uri: regDocument.uri,
                        name: regDocument.name || 'nachweis',
                        type: regDocument.mimeType || 'application/octet-stream',
                      });

                      const uploadRes = await fetch(`${getBaseUrl()}/upload/document`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${resData.token}` },
                        body: formData,
                      });

                      if (uploadRes.ok) {
                        const { id, originalName } = await uploadRes.json();
                        setTherapistDocuments((prev) => [{ id, originalName, mimetype: regDocument.mimeType }, ...prev]);
                      } else {
                        Alert.alert(t('registrationDocumentUploadFailedTitle'), t('registrationDocumentUploadFailedBody'));
                      }
                    } catch {
                      Alert.alert(t('registrationDocumentUploadFailedTitle'), t('registrationDocumentUploadFailedBody'));
                    } finally {
                      setDocumentUploading(false);
                    }
                  }

                  const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
                    headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${resData.token}` },
                  });
                  if (profileRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await profileRes.json()));
                  await AsyncStorage.removeItem(REGISTRATION_COMPLIANCE_DRAFT_KEY);
                  setShowRegister(false);
                  setRegStep(1);
                  setRegSpecSearch('');
                  setRegLangSearch('');
                  setShowRegFortbildungen(false);
                  setRegDocument(null);
                  setRegTaxRegistrationStatus(null);
                  setRegHealthAuthorityStatus(null);
                  return;
                }
              } catch {
                showWebAlert(`${t('alertConnectionError')}. ${t('alertConnectionErrorBody')}`);
                return;
              }
              setRegSubmitted(true);
            }
          }}
        >
          <Text style={styles.registerBtnText}>
            {regStep < REG_STEPS ? 'Weiter →' : 'Profil einreichen'}
          </Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    );
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
              [{ text: t('editProfileAction'), onPress: () => setActiveTab('therapist') }, { text: t('laterBtn'), style: 'cancel' }]
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
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center', paddingVertical: 48 }]}>
        {emailVerifyStatus === 'verifying' && (
          <>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>⏳</Text>
            <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center' }]}>{t('emailBeingVerified')}</Text>
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>{t('pleaseWait')}</Text>
          </>
        )}
        {emailVerifyStatus === 'success' && (
          <>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>✅</Text>
            <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center' }]}>{t('emailVerified')}</Text>
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>{t('autoLogin')}</Text>
          </>
        )}
        {emailVerifyStatus === 'error' && (
          <>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>❌</Text>
            <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center' }]}>{t('confirmFailed')}</Text>
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>{softenErrorMessage(emailVerifyError)}</Text>
            <Pressable
              style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 24, paddingHorizontal: 32 }]}
              onPress={() => { setShowEmailVerify(false); setEmailVerifyStatus('idle'); }}
            >
              <Text style={styles.registerBtnText}>{t('backBtn')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );

  const renderInviteClaimScreen = () => {
    if (inviteClaimLoading && !inviteClaimData) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background }}>
          <Text style={{ color: c.muted, fontSize: 15 }}>{t('inviteChecking')}</Text>
        </View>
      );
    }

    if (inviteClaimError && !inviteClaimData) {
      return (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}>
          <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, marginTop: 40 }]}>
            <Ionicons name="alert-circle-outline" size={40} color={c.error} style={{ alignSelf: 'center' }} />
            <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center' }]}>{t('inviteCheckFailed')}</Text>
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center' }]}>{softenErrorMessage(inviteClaimError)}</Text>
            <Pressable
              style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 8 }]}
              onPress={() => { setShowInviteClaim(false); setInviteClaimError(''); }}
            >
              <Text style={styles.registerBtnText}>{t('toAppBtn')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    if (!inviteClaimData) return null;

    const { therapist: inviteTherapist, practice: invitePractice } = inviteClaimData;

    const handleClaim = async () => {
      if (!inviteClaimPassword || inviteClaimPassword.length < 6) {
        setInviteClaimError(t('passwordMinLength'));
        return;
      }
      if (inviteClaimPassword !== inviteClaimPasswordConfirm) {
        setInviteClaimError(t('passwordsMismatch'));
        return;
      }
      setInviteClaimLoading(true);
      setInviteClaimError('');
      try {
        const res = await fetch(`${getBaseUrl()}/invite/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: inviteClaimToken, password: inviteClaimPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setInviteClaimError(data.message ?? t('accountActivationError'));
          return;
        }
        // Store token and load profile
        await AsyncStorage.setItem('revio_auth_token', data.token);
        setAuthToken(data.token);
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        if (profileRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await profileRes.json()));
        setShowInviteClaim(false);
        setInviteClaimToken(null);
        setInviteClaimData(null);
        setInviteClaimPassword('');
        setInviteClaimPasswordConfirm('');
        // Show visibility modal
        setShowVisibilityModal(true);
      } catch {
        setInviteClaimError(t('connectionErrorRetry'));
      } finally {
        setInviteClaimLoading(false);
      }
    };

    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, marginTop: 20, alignItems: 'center' }]}>
          <Image source={require('../assets/icon.png')} style={{ width: 56, height: 56, borderRadius: 16 }} />
          <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center', marginTop: 8 }]}>{t('youWereInvited')}</Text>
          <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center' }]}>
            {t('inviteSetPasswordInfo').replace('{name}', invitePractice.name)}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('yourProfile')}</Text>
          <Text style={[styles.detailInfoValue, { color: c.text, fontWeight: '700', fontSize: 17 }]}>{inviteTherapist.fullName}</Text>
          <Text style={[styles.detailInfoValue, { color: c.muted }]}>{inviteTherapist.professionalTitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Ionicons name="business-outline" size={14} color={c.muted} />
            <Text style={[styles.detailInfoValue, { color: c.muted }]}>{invitePractice.name}, {invitePractice.city}</Text>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('setPassword')}</Text>
          <View style={{ position: 'relative', marginTop: 6 }}>
            <TextInput
              style={[styles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginTop: 0, paddingRight: 44 }]}
              value={inviteClaimPassword}
              onChangeText={setInviteClaimPassword}
              placeholder={t('passwordPlaceholder')}
              placeholderTextColor={c.muted}
              secureTextEntry={!showInvitePassword}
              autoCapitalize="none"
            />
              <Pressable onPress={() => setShowInvitePassword(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
              <Ionicons name={showInvitePassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
            </Pressable>
          </View>
          <View style={{ position: 'relative', marginTop: 10 }}>
            <TextInput
              style={[styles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginTop: 0, paddingRight: 44 }]}
              value={inviteClaimPasswordConfirm}
              onChangeText={setInviteClaimPasswordConfirm}
              placeholder={t('passwordConfirmPlaceholder')}
              placeholderTextColor={c.muted}
              secureTextEntry={!showInvitePasswordConfirm}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowInvitePasswordConfirm(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
              <Ionicons name={showInvitePasswordConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
            </Pressable>
          </View>
          {!!inviteClaimError && (
            <Text style={{ color: c.error, fontSize: 13, marginTop: 8 }}>{softenErrorMessage(inviteClaimError)}</Text>
          )}
          <Pressable
            style={[styles.registerBtn, { backgroundColor: inviteClaimLoading ? c.border : c.primary, marginTop: 16 }]}
            onPress={handleClaim}
            disabled={inviteClaimLoading}
          >
            <Text style={styles.registerBtnText}>{inviteClaimLoading ? 'Aktivieren…' : 'Konto aktivieren'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  const renderTab = () => {
    if (selectedTherapist) return renderTherapistProfile(selectedTherapist);
    if (activeTab === 'favorites') return renderFavorites();
    if (activeTab === 'therapist') {
      if (showEmailVerify) return renderEmailVerifyScreen();
      if (loggedInTherapist) return renderTherapistDashboard();
      return (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: c.background }}>
            <View style={[styles.header, { marginBottom: 0 }]}>
              <Image source={require('../assets/icon.png')} style={styles.logoMark} />
              <Text style={[styles.authBrandWordmark, { color: c.text }]}>evio</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            {showLogin ? renderLogin() : showRegister ? renderRegister() : renderTherapist()}
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
      <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowNotifications(false)} />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, minHeight: 200 }}>
          <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 16 }}>{t('notificationsTitle')}</Text>
          {notifications.length === 0 ? (
            <Text style={{ color: c.muted, textAlign: 'center', marginTop: 24 }}>{t('noNotifications')}</Text>
          ) : (
            notifications.map((n) => (
              <View key={n.id} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.error, marginTop: 5 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>{n.message}</Text>
                  <Text style={{ color: c.muted, fontSize: 11, marginTop: 3 }}>
                    {new Date(n.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))
          )}
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
      <Modal visible={showProfileSavedModal} transparent animationType="fade" onRequestClose={() => setShowProfileSavedModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={() => setShowProfileSavedModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
              <View style={{ alignItems: 'center', gap: 10 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-circle" size={34} color={c.primary} />
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                  {t('profileSavedModalTitle')}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 21 }}>
                {t('profileSavedModalBody')}
              </Text>
              <Pressable
                style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                onPress={() => setShowProfileSavedModal(false)}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('doneBtn')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Location Sheet ─────────────────────────────────────────────────── */}
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
                style={{ backgroundColor: locationSheetCity.trim() ? c.primary : c.mutedBg, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' }}
              >
                <Text style={{ color: locationSheetCity.trim() ? '#fff' : c.muted, fontSize: 15, fontWeight: '600' }}>{t('confirmLocation')}</Text>
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
                setActiveTab('therapist');
                setTimeout(() => handlePickPhoto(), 300);
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

      {/* ── Konto löschen Modal ──────────────────────────────────────────────── */}
      <Modal visible={showDeleteAccountModal} transparent animationType="fade" onRequestClose={() => setShowDeleteAccountModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={() => setShowDeleteAccountModal(false)}>
          <Pressable style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }} onPress={() => {}}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: c.error, textAlign: 'center' }}>{t('deleteAccountConfirmTitle')}</Text>
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
              {t('deleteAccountConfirmMsg')}
            </Text>
            <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: c.error }}>
              <Text style={{ fontSize: 13, color: c.error, marginBottom: 10 }}>
                {t('enterLastNameConfirm')}
              </Text>
              <TextInput
                value={deleteNameInput}
                onChangeText={setDeleteNameInput}
                placeholder={loggedInTherapist?.fullName?.split(' ').slice(-1)[0] ?? t('lastNameFallback')}
                placeholderTextColor={c.muted}
                autoCapitalize="words"
                style={{ backgroundColor: c.background, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.error, color: c.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 }}
              />
            </View>
            <Pressable
              onPress={async () => { setShowDeleteAccountModal(false); await deleteAccountConfirmed(); }}
              disabled={deleteNameInput.trim().toLowerCase() !== (loggedInTherapist?.fullName?.split(' ').slice(-1)[0] ?? '').toLowerCase()}
              style={({ pressed }) => ({ backgroundColor: c.error, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', opacity: deleteNameInput.trim().toLowerCase() === (loggedInTherapist?.fullName?.split(' ').slice(-1)[0] ?? '').toLowerCase() ? (pressed ? 0.7 : 1) : 0.35 })}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('deleteAccountFinal')}</Text>
            </Pressable>
            <Pressable onPress={() => setShowDeleteAccountModal(false)} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: c.muted, fontSize: 14 }}>{t('cancelBtn')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.appFrame}>
        {renderTab()}
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
                if (tab.key !== 'therapist') {
                  setShowLogin(false);
                  setShowRegister(false);
                  setShowRegFortbildungen(false);
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
                  {tab.key === 'therapist' && loggedInTherapist && notifications.length > 0 && (
                    <View style={{ position: 'absolute', top: -3, right: -5, backgroundColor: '#E53E3E', borderRadius: 6, minWidth: 12, height: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
                      <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800', lineHeight: 12 }}>
                        {notifications.length}
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
  searchInput: { flex: 1, ...TYPE.body },
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
    ...TYPE.body,
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
