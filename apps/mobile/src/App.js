import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
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
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  REG_STEPS,
  allSuggestions,
  fortbildungOptions,
  formatMissingProfileFields,
  getBaseUrl,
  TUNNEL_HEADERS,
  getLangLabel,
  getPracticeInitials,
  getPrimaryPractice,
  haversine,
  languageOptions,
  mapApiTherapist,
  normalizeLanguageCodes,
  normalizeTherapistProfile,
  regSpecOptions,
  tabs,
} from './mobile-utils';
import { DiscoverScreen } from './mobile-discover-screen';
import { ManagerDashboardContent } from './mobile-manager-dashboard';
import {
  PracticeProfileScreen,
  TherapistProfileScreen,
} from './mobile-public-profiles';
import {
  CreatePracticeScreen,
  InvitePageScreen,
  LoginScreen,
  PracticeSearchScreen,
  TherapistLandingScreen,
} from './mobile-therapist-screens';
import {
  PracticeAdminScreen,
  TherapistDashboardScreen,
} from './mobile-therapist-dashboard';
import { translations } from './mobile-translations';

// ─── Palette ─────────────────────────────────────────────────────────────────
// Old Rose #d88c9a · Soft Apricot #f2d0a9 · Almond Cream #f1e3d3 · Muted Teal #99c1b9

const palette = {
  light: {
    background: '#F7F9FA',
    text: '#1F2A30',
    primary: '#4F6D7A',
    accent: '#7FAE9F',
    card: '#FFFFFF',
    border: '#D0DBE0',
    muted: '#A7B6BE',
    mutedBg: '#EDF2F4',
    nav: '#FFFFFF',
    success: '#7FAE9F',
    successBg: '#EAF3F0'
  },
  dark: {
    background: '#111A1F',
    text: '#E8EEF1',
    primary: '#6B8FA0',
    accent: '#7FAE9F',
    card: '#1A2630',
    border: '#2A3A44',
    muted: '#7A9099',
    mutedBg: '#1E2E38',
    nav: '#151F26',
    success: '#7FAE9F',
    successBg: '#1A2E2A'
  }
};

const webWindow = typeof globalThis !== 'undefined' ? globalThis.window : undefined;
const webNavigator = typeof globalThis !== 'undefined' ? globalThis.navigator : undefined;

function showWebAlert(message) {
  webWindow?.alert?.(message);
}

function showWebConfirm(message) {
  return webWindow?.confirm?.(message) ?? false;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function callPhone(phone) {
  if (!phone) {
    Alert.alert('Keine Nummer', 'Für diesen Therapeuten ist keine Telefonnummer hinterlegt.');
    return;
  }
  Alert.alert(phone, 'Jetzt anrufen?', [
    { text: 'Anrufen', onPress: () => Linking.openURL(`tel:${phone}`) },
    { text: 'Abbrechen', style: 'cancel' },
  ]);
}

function HeartButton({
  isSaved,
  onToggle,
  size = 22,
  savedColor = '#E05A77',
  unsavedColor = '#9ca3af',
  hitSlop = 8,
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

export default function App() {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system'); // 'light' | 'dark' | 'system'
  const scheme = themeMode === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : themeMode;
  const c = palette[scheme];

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
      if (val) setFavorites(JSON.parse(val));
    });
  }, []);
  const toggleFavorite = (therapist) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.id === therapist.id);
      const next = exists ? prev.filter(f => f.id !== therapist.id) : [...prev, therapist];
      AsyncStorage.setItem('revio_favorites', JSON.stringify(next));
      return next;
    });
  };
  const isFavorite = (id) => favorites.some(f => f.id === id);

  // Practice favorites — stored locally
  const [favoritePractices, setFavoritePractices] = useState([]);
  useEffect(() => {
    AsyncStorage.getItem('revio_fav_practices').then(val => {
      if (val) setFavoritePractices(JSON.parse(val));
    });
  }, []);
  const toggleFavoritePractice = (practice) => {
    // Store only practice metadata — therapists are always fetched live via openPractice()
    const { therapists: _drop, ...practiceData } = practice;
    setFavoritePractices(prev => {
      const exists = prev.some(f => f.id === practice.id);
      const next = exists ? prev.filter(f => f.id !== practice.id) : [...prev, practiceData];
      AsyncStorage.setItem('revio_fav_practices', JSON.stringify(next));
      return next;
    });
  };
  const isPracticeFavorite = (id) => favoritePractices.some(f => f.id === id);

  // Registration state
  const [showRegister, setShowRegister] = useState(false);
  // Manager registration state
  const [showManagerReg, setShowManagerReg] = useState(false);
  const [mgrRegStep, setMgrRegStep] = useState(1);
  const [mgrEmail, setMgrEmail] = useState('');
  const [mgrPassword, setMgrPassword] = useState('');
  const [mgrPasswordConfirm, setMgrPasswordConfirm] = useState('');
  const [mgrPracticeName, setMgrPracticeName] = useState('');
  const [mgrPracticeCity, setMgrPracticeCity] = useState('');
  const [mgrPracticeAddress, setMgrPracticeAddress] = useState('');
  const [mgrPracticePhone, setMgrPracticePhone] = useState('');
  const [mgrIsTherapist, setMgrIsTherapist] = useState(false);
  const [mgrFullName, setMgrFullName] = useState('');
  const [mgrProfTitle, setMgrProfTitle] = useState('');
  const [mgrRegLoading, setMgrRegLoading] = useState(false);
  const [mgrRegError, setMgrRegError] = useState('');
  // Manager login tab
  // Manager dashboard edit state
  const [mgrEditMode, setMgrEditMode] = useState(false);
  const [mgrEditName, setMgrEditName] = useState('');
  const [mgrEditCity, setMgrEditCity] = useState('');
  const [mgrEditAddress, setMgrEditAddress] = useState('');
  const [mgrEditPhone, setMgrEditPhone] = useState('');
  const [mgrEditHours, setMgrEditHours] = useState('');
  const [mgrEditDescription, setMgrEditDescription] = useState('');
  const [mgrEditHomeVisit, setMgrEditHomeVisit] = useState(false);
  const [mgrEditLogo, setMgrEditLogo] = useState(null);
  const [mgrEditPhotos, setMgrEditPhotos] = useState([]);
  const [mgrEditSaving, setMgrEditSaving] = useState(false);
  const [removingTherapistId, setRemovingTherapistId] = useState(null);
  const [activePracticeId, setActivePracticeId] = useState(null);
  const [showAddPracticeForm, setShowAddPracticeForm] = useState(false);
  const [mgrNewPracticeName, setMgrNewPracticeName] = useState('');
  const [mgrNewPracticeCity, setMgrNewPracticeCity] = useState('');
  const [mgrNewPracticeAddress, setMgrNewPracticeAddress] = useState('');
  const [mgrNewPracticePhone, setMgrNewPracticePhone] = useState('');
  const [mgrNewPracticeLoading, setMgrNewPracticeLoading] = useState(false);
  const [mgrProfileEditMode, setMgrProfileEditMode] = useState(false);
  const [mgrProfileFullName, setMgrProfileFullName] = useState('');
  const [mgrProfileTitle, setMgrProfileTitle] = useState('');
  const [mgrProfileBio, setMgrProfileBio] = useState('');
  const [mgrProfileSpecializations, setMgrProfileSpecializations] = useState('');
  const [mgrProfileLanguages, setMgrProfileLanguages] = useState('');
  const [mgrProfileIsVisible, setMgrProfileIsVisible] = useState(false);
  const [mgrProfileSaving, setMgrProfileSaving] = useState(false);
  const [mgrProfilePublishLoading, setMgrProfilePublishLoading] = useState(false);
  const [showAddTherapistForm, setShowAddTherapistForm] = useState(false);
  const [addTherapistQuery, setAddTherapistQuery] = useState('');
  const [addTherapistResults, setAddTherapistResults] = useState([]);
  const [addTherapistLoading, setAddTherapistLoading] = useState(false);
  const [addingTherapistId, setAddingTherapistId] = useState(null);
  const [regStep, setRegStep] = useState(1);
  const [regSubmitted, setRegSubmitted] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regBio, setRegBio] = useState('');
  const [regSpecializations, setRegSpecializations] = useState([]);
  const [regLanguages, setRegLanguages] = useState([]);
  const [regHomeVisit, setRegHomeVisit] = useState(false);
  const [regFortbildungen, setRegFortbildungen] = useState([]);
  const [regPracticeName, setRegPracticeName] = useState('');
  const [regPracticeAddress, setRegPracticeAddress] = useState('');
  const [regPracticeCity, setRegPracticeCity] = useState('');
  const [regPracticePhone, setRegPracticePhone] = useState('');

  const toggleRegSpec = (s) => setRegSpecializations(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleRegLang = (l) => setRegLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  const toggleRegFort = (f) => setRegFortbildungen(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  const [regPracticeMode, setRegPracticeMode] = useState('new'); // 'new' | 'existing' | 'skip'
  const [regExistingPracticeName, setRegExistingPracticeName] = useState('');
  const [regExistingPracticeId, setRegExistingPracticeId] = useState(null);
  const [regPracticeSearchResults, setRegPracticeSearchResults] = useState([]);
  const [regPracticeSearching, setRegPracticeSearching] = useState(false);

  // Auth state
  const [authToken, setAuthToken] = useState(null);
  const [loggedInTherapist, setLoggedInTherapist] = useState(null);
  const [loggedInManager, setLoggedInManager] = useState(null);
  const [accountType, setAccountType] = useState(null); // 'therapist' | 'manager' | null
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
  const [editIsVisible, setEditIsVisible] = useState(true);
  const [editAvailability, setEditAvailability] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Practice management state
  const [showCreatePractice, setShowCreatePractice] = useState(false);
  const [showPracticeSearch, setShowPracticeSearch] = useState(false);
  const [showPracticeAdmin, setShowPracticeAdmin] = useState(false);
  const [scrollToInvite, setScrollToInvite] = useState(false);
  const practiceAdminScrollRef = React.useRef(null);
  const inviteSectionY = React.useRef(0);
  const [showInvitePage, setShowInvitePage] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState([]);
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [inviteTokenLoading, setInviteTokenLoading] = useState(false);
  // therapistId → linkId for pending (PROPOSED) invites
  const [pendingInvites, setPendingInvites] = useState({});
  // Full therapist data for displaying the pending list
  const [pendingTherapistsList, setPendingTherapistsList] = useState([]);
  const inviteSearchDebounce = React.useRef(null);
  const [adminPracticeDetail, setAdminPracticeDetail] = useState(null);
  const [createPracticeName, setCreatePracticeName] = useState('');
  const [createPracticeCity, setCreatePracticeCity] = useState('');
  const [createPracticeAddress, setCreatePracticeAddress] = useState('');
  const [createPracticePhone, setCreatePracticePhone] = useState('');
  const [createPracticeHours, setCreatePracticeHours] = useState('');
  const [createPracticeLoading, setCreatePracticeLoading] = useState(false);
  const [practiceSearchQuery, setPracticeSearchQuery] = useState('');
  const [practiceSearchResults, setPracticeSearchResults] = useState([]);
  const [practiceSearchLoading, setPracticeSearchLoading] = useState(false);
  const [editPracticeName, setEditPracticeName] = useState('');
  const [editPracticeCity, setEditPracticeCity] = useState('');
  const [editPracticeAddress, setEditPracticeAddress] = useState('');
  const [editPracticePhone, setEditPracticePhone] = useState('');
  const [editPracticeHours, setEditPracticeHours] = useState('');
  const [editPracticeDescription, setEditPracticeDescription] = useState('');
  const [editPracticeHomeVisit, setEditPracticeHomeVisit] = useState(false);
  const [practiceEditSaving, setPracticeEditSaving] = useState(false);
  const [editPracticeLogo, setEditPracticeLogo] = useState(null);
  const [editPracticePhotos, setEditPracticePhotos] = useState([]);

  // Create-therapist-profile form state (practice admin)
  const [invitePageTab, setInvitePageTab] = useState('link'); // 'new' | 'link'
  const [createTherapistName, setCreateTherapistName] = useState('');
  const [createTherapistEmail, setCreateTherapistEmail] = useState('');
  const [createTherapistTitle, setCreateTherapistTitle] = useState('');
  const [createTherapistCity, setCreateTherapistCity] = useState('');
  const [createTherapistBio, setCreateTherapistBio] = useState('');
  const [createTherapistSpecs, setCreateTherapistSpecs] = useState([]);
  const [createTherapistLangs, setCreateTherapistLangs] = useState([]);
  const [createTherapistKassenart, setCreateTherapistKassenart] = useState('');
  const [createTherapistHomeVisit, setCreateTherapistHomeVisit] = useState(false);
  const [createTherapistAvailability, setCreateTherapistAvailability] = useState('');
  const [createTherapistLoading, setCreateTherapistLoading] = useState(false);
  const [createTherapistError, setCreateTherapistError] = useState('');

  // Invite claim flow state
  const [showInviteClaim, setShowInviteClaim] = useState(false);
  const [inviteClaimToken, setInviteClaimToken] = useState(null);
  const [inviteClaimData, setInviteClaimData] = useState(null); // { therapist, practice }
  const [inviteClaimLoading, setInviteClaimLoading] = useState(false);
  const [inviteClaimError, setInviteClaimError] = useState('');
  const [inviteClaimPassword, setInviteClaimPassword] = useState('');
  const [inviteClaimPasswordConfirm, setInviteClaimPasswordConfirm] = useState('');
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('revio_auth_token'),
      AsyncStorage.getItem('revio_account_type'),
    ]).then(async ([token, storedAccountType]) => {
      if (!token) return;
      try {
        if (storedAccountType === 'manager') {
          const res = await fetch(`${getBaseUrl()}/manager/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const mgrData = await res.json();
            setAuthToken(token);
            setAccountType('manager');
            setLoggedInManager(mgrData);
            setActivePracticeId(mgrData.practices?.[0]?.id ?? null);
          } else {
            AsyncStorage.removeItem('revio_auth_token');
            AsyncStorage.removeItem('revio_account_type');
          }
        } else {
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
        }
      } catch {}
    });
  }, []);

  // Deep-link / initial URL handling for invite token
  useEffect(() => {
    const handleUrl = async (url) => {
      if (!url) return;
      try {
        const match = url.match(/[?&]token=([^&]+)/);
        if (!match) return;
        const token = decodeURIComponent(match[1]);
        setInviteClaimLoading(true);
        setInviteClaimError('');
        try {
          const res = await fetch(`${getBaseUrl()}/invite/validate?token=${encodeURIComponent(token)}`);
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setInviteClaimError(err.message ?? 'Ungültige Einladung');
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
          setInviteClaimError('Verbindungsfehler beim Validieren der Einladung.');
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

  // Poll notifications every 30s when logged in
  useEffect(() => {
    if (notificationPollRef.current) clearInterval(notificationPollRef.current);
    if (!authToken) { setNotifications([]); return; }
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/notifications`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications ?? []);
        }
      } catch {}
    };
    fetchNotifications();
    notificationPollRef.current = setInterval(fetchNotifications, 30000);
    return () => clearInterval(notificationPollRef.current);
  }, [authToken]);

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
        setLoginError(err.message ?? 'Ungültige Zugangsdaten');
        return;
      }
      const data = await res.json();
      const nextType = data.accountType === 'manager' ? 'manager' : 'therapist';
      await AsyncStorage.setItem('revio_auth_token', data.token);
      await AsyncStorage.setItem('revio_account_type', nextType);
      setAuthToken(data.token);
      setAccountType(nextType);

      if (nextType === 'manager') {
        const meRes = await fetch(`${getBaseUrl()}/manager/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        if (meRes.ok) {
          const mgrData = await meRes.json();
          setLoggedInManager(mgrData);
          setActivePracticeId(mgrData.practices?.[0]?.id ?? null);
        }
      } else {
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        if (profileRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await profileRes.json()));
      }
      setShowLogin(false);
      setLoginEmail('');
      setLoginPassword('');
    } catch {
      setLoginError('Verbindungsfehler. Bitte prüfe deine Internetverbindung.');
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
    setLoggedInManager(null);
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

  const handleDeleteAccount = () => {
    if (loggedInTherapist?.adminPractice) {
      const msg = `Du bist Admin von „${loggedInTherapist.adminPractice.name}". Bitte lösche zuerst die Praxis, bevor du dein Konto löschst.`;
      if (Platform.OS === 'web') { showWebAlert(`Praxis zuerst löschen\n\n${msg}`); }
      else { Alert.alert('Praxis zuerst löschen', msg, [{ text: 'OK' }]); }
      return;
    }
    const msg = t('deleteAccountConfirmMsg');
    if (Platform.OS === 'web') {
      if (showWebConfirm(`${t('deleteAccountConfirmTitle')}\n\n${msg}`)) deleteAccountConfirmed();
    } else {
      Alert.alert(t('deleteAccountConfirmTitle'), msg, [
        { text: t('cancelBtn') ?? 'Abbrechen', style: 'cancel' },
        { text: t('deleteAccountConfirmBtn'), style: 'destructive', onPress: deleteAccountConfirmed },
      ]);
    }
  };

  const [deletionFlowStep, setDeletionFlowStep] = useState(null); // null | 'reason' | 'confirm'
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionReasonDetail, setDeletionReasonDetail] = useState('');
  const [deletionLoading, setDeletionLoading] = useState(false);
  const [deletionPracticeId, setDeletionPracticeId] = useState(null); // null = therapist flow, string = manager flow

  const DELETION_REASONS = [
    'Ich habe die Praxis versehentlich erstellt',
    'Doppelter Eintrag',
    'Ich verwalte diese Praxis nicht mehr',
    'Die Praxis ist geschlossen',
    'Ich möchte sie durch eine andere ersetzen',
    'Sonstiges',
  ];

  const deletePracticeConfirmed = async () => {
    setDeletionLoading(true);
    try {
      const isManagerFlow = deletionPracticeId !== null;
      const url = isManagerFlow ? `${getBaseUrl()}/manager/practice` : `${getBaseUrl()}/my/practice`;
      const body = isManagerFlow
        ? { practiceId: deletionPracticeId, reason: deletionReason, reasonDetail: deletionReason === 'Sonstiges' ? deletionReasonDetail : undefined }
        : { reason: deletionReason, reasonDetail: deletionReason === 'Sonstiges' ? deletionReasonDetail : undefined };

      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}`, ...TUNNEL_HEADERS },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDeletionFlowStep(null);
        setDeletionReason('');
        setDeletionReasonDetail('');
        setDeletionPracticeId(null);
        if (isManagerFlow) {
          const meRes = await fetch(`${getBaseUrl()}/manager/me`, { headers: { Authorization: `Bearer ${authToken}`, ...TUNNEL_HEADERS } });
          if (meRes.ok) setLoggedInManager(await meRes.json());
        } else {
          setShowPracticeAdmin(false);
          setAdminPracticeDetail(null);
          const meRes = await fetch(`${getBaseUrl()}/auth/me`, { headers: { Authorization: `Bearer ${authToken}`, ...TUNNEL_HEADERS } });
          if (meRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await meRes.json()));
        }
      } else {
        Alert.alert('Fehler', 'Praxis konnte nicht gelöscht werden.');
      }
    } catch {
      Alert.alert('Fehler', 'Verbindungsfehler beim Löschen.');
    } finally {
      setDeletionLoading(false);
    }
  };

  const handleDeletePractice = () => {
    setDeletionReason('');
    setDeletionReasonDetail('');
    setDeletionPracticeId(null);
    setDeletionFlowStep('reason');
  };

  const handleDeleteManagerPractice = (practiceId) => {
    setDeletionReason('');
    setDeletionReasonDetail('');
    setDeletionPracticeId(practiceId);
    setDeletionFlowStep('reason');
  };

  const handleSaveProfile = async () => {
    if (!authToken) return;
    setProfileSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          bio: editBio,
          specializations: editSpecializations.split(',').map(s => s.trim()).filter(Boolean),
          languages: editLanguages.map(l => l.toLowerCase()),
          homeVisit: editHomeVisit,
          isVisible: editIsVisible,
          availability: editAvailability,
        }),
      });
      if (res.ok) {
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (profileRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await profileRes.json()));
        setEditMode(false);
        Alert.alert('Gespeichert', 'Dein Profil wurde erfolgreich aktualisiert.');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Profil konnte nicht gespeichert werden.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
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
        const { url } = await uploadRes.json();
        const fullUrl = `${getBaseUrl()}${url}`;
        setLoggedInTherapist(prev => ({ ...prev, photo: fullUrl }));
        Alert.alert('Erfolg', 'Profilbild gespeichert.');
      } else {
        const status = uploadRes.status;
        Alert.alert('Fehler', `Foto konnte nicht hochgeladen werden (${status}).`);
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    }
  };

  // Practice: create new practice
  const handleCreatePractice = async () => {
    if (!authToken || !createPracticeName.trim() || !createPracticeCity.trim()) {
      Alert.alert('Fehlende Angaben', 'Name und Stadt sind Pflichtfelder.');
      return;
    }
    setCreatePracticeLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: createPracticeName.trim(),
          city: createPracticeCity.trim(),
          address: createPracticeAddress.trim() || undefined,
          phone: createPracticePhone.trim() || undefined,
          hours: createPracticeHours.trim() || undefined,
        }),
      });
      if (res.ok) {
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (profileRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await profileRes.json()));
        setCreatePracticeName(''); setCreatePracticeCity('');
        setCreatePracticeAddress(''); setCreatePracticePhone(''); setCreatePracticeHours('');
        setShowCreatePractice(false);
        Alert.alert('Praxis erstellt', 'Deine Praxis wurde erfolgreich erstellt.');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Praxis konnte nicht erstellt werden.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    } finally {
      setCreatePracticeLoading(false);
    }
  };

  // Practice: search practices
  const handleSearchPractices = async () => {
    setPracticeSearchLoading(true);
    try {
      const res = await fetch(
        `${getBaseUrl()}/practice/search?q=${encodeURIComponent(practiceSearchQuery)}`,
        { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
      );
      if (res.ok) setPracticeSearchResults((await res.json()).practices ?? []);
    } catch {}
    finally { setPracticeSearchLoading(false); }
  };

  // Practice: send connection request
  const handleConnectToPractice = async (practiceId) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${getBaseUrl()}/practice/${practiceId}/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        Alert.alert('Anfrage gesendet', 'Deine Verbindungsanfrage wurde gesendet. Die Praxis muss sie bestätigen.');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Hinweis', err.message ?? 'Anfrage konnte nicht gesendet werden.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    }
  };

  // Practice: load full admin practice detail
  const openTherapistById = async (therapistId) => {
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/${therapistId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTherapist(mapApiTherapist(data.therapist));
        return;
      }
      Alert.alert('Therapeut konnte nicht geladen werden', 'Bitte pruefe, ob die API erreichbar ist und versuche es erneut.');
    } catch {
      Alert.alert('Verbindungsfehler', 'Die Therapeuten-Details konnten nicht geladen werden. Bitte pruefe die API-Verbindung der Expo-App.');
    }
  };

  const loadAdminPracticeDetail = async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setAdminPracticeDetail((await res.json()).practice);
    } catch {}
  };

  // Practice: accept/reject connection request
  const handleLinkAction = async (linkId, action) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice/links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ action }),
      });
      if (res.ok) await loadAdminPracticeDetail();
    } catch {}
  };

  // Practice: create new therapist profile and send invitation
  const handleCreateTherapist = async () => {
    if (!createTherapistName.trim() || !createTherapistEmail.trim() || !createTherapistTitle.trim()) {
      setCreateTherapistError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setCreateTherapistLoading(true);
    setCreateTherapistError('');
    try {
      const isManager = accountType === 'manager';
      const url = isManager
        ? `${getBaseUrl()}/manager/practice/create-therapist`
        : `${getBaseUrl()}/my/practice/create-therapist`;
      const commonBody = {
        fullName: createTherapistName.trim(),
        email: createTherapistEmail.trim(),
        professionalTitle: createTherapistTitle.trim(),
        city: createTherapistCity.trim() || undefined,
        bio: createTherapistBio.trim() || undefined,
        specializations: createTherapistSpecs,
        languages: createTherapistLangs,
        kassenart: createTherapistKassenart || undefined,
        homeVisit: createTherapistHomeVisit,
        availability: createTherapistAvailability.trim() || undefined,
      };
      const body = isManager ? { ...commonBody, practiceId: activePracticeId } : commonBody;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCreateTherapistName(''); setCreateTherapistEmail(''); setCreateTherapistTitle('');
        setCreateTherapistCity(''); setCreateTherapistBio(''); setCreateTherapistSpecs([]);
        setCreateTherapistLangs([]); setCreateTherapistKassenart(''); setCreateTherapistHomeVisit(false);
        setCreateTherapistAvailability(''); setCreateTherapistError('');
        Alert.alert('Profil erstellt', 'Eine Einladungs-E-Mail wurde verschickt.');
        if (isManager) {
          const meRes = await fetch(`${getBaseUrl()}/manager/me`, { headers: { Authorization: `Bearer ${authToken}` } });
          if (meRes.ok) setLoggedInManager(await meRes.json());
        } else {
          await loadAdminPracticeDetail();
        }
      } else {
        setCreateTherapistError(data.message ?? 'Profil konnte nicht erstellt werden.');
      }
    } catch {
      setCreateTherapistError('Verbindungsfehler. Bitte prüfe deine Internetverbindung.');
    } finally {
      setCreateTherapistLoading(false);
    }
  };

  // Practice: resend invitation to an invited therapist
  const handleResendInvite = async (therapistId) => {
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice/resend-invite/${therapistId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        Alert.alert('Einladung erneut gesendet', 'Eine neue Einladungs-E-Mail wurde verschickt.');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Einladung konnte nicht erneut gesendet werden.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    }
  };

  // Invite page: search therapists
  const handleInviteSearch = (text) => {
    setInviteSearchQuery(text);
    setInviteSearchResults([]);
    if (inviteSearchDebounce.current) clearTimeout(inviteSearchDebounce.current);
    if (text.length < 2) return;
    inviteSearchDebounce.current = setTimeout(async () => {
      setInviteSearchLoading(true);
      try {
        const res = await fetch(`${getBaseUrl()}/therapists/search?q=${encodeURIComponent(text)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        setInviteSearchResults(data.therapists ?? []);
      } catch {}
      setInviteSearchLoading(false);
    }, 350);
  };

  const handleInviteBySearch = async (therapist) => {
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ email: therapist.email }),
      });
      if (res.ok || res.status === 409) {
        const data = res.ok ? await res.json() : {};
        const linkId = data.link?.id ?? true;
        setPendingInvites(prev => ({ ...prev, [therapist.id]: linkId }));
        setPendingTherapistsList(prev =>
          prev.find(t => t.id === therapist.id) ? prev : [...prev, { ...therapist, linkId }]
        );
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Einladung fehlgeschlagen.');
      }
    } catch {
      Alert.alert('Verbindungsfehler');
    }
  };

  const handleCancelInvite = (therapistId, therapistName) => {
    const doCancel = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/my/practice/invite/${therapistId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          setPendingInvites(prev => {
            const next = { ...prev };
            delete next[therapistId];
            return next;
          });
          setPendingTherapistsList(prev => prev.filter(t => t.id !== therapistId));
        } else {
          Alert.alert('Fehler', 'Einladung konnte nicht zurückgezogen werden.');
        }
      } catch {
        Alert.alert('Verbindungsfehler');
      }
    };

    if (Platform.OS === 'web') {
      if (showWebConfirm(`Einladung an ${therapistName} zurückziehen?`)) doCancel();
    } else {
      Alert.alert(
        'Einladung zurückziehen',
        `Möchtest du die Einladung an ${therapistName} zurückziehen?`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Zurückziehen', style: 'destructive', onPress: doCancel },
        ]
      );
    }
  };

  const handleLoadInviteToken = async () => {
    setInviteTokenLoading(true);
    try {
      const url = accountType === 'manager'
        ? `${getBaseUrl()}/manager/practice/invite-token?practiceId=${activePracticeId}`
        : `${getBaseUrl()}/my/practice/invite-token`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setInviteToken(data);
    } catch {}
    setInviteTokenLoading(false);
  };

  const handleShareInviteLink = async () => {
    const link = `https://revio.app/join/${inviteToken.token}`;
    const message = `Du wurdest eingeladen, der Praxis „${inviteToken.practiceName}" auf Revio beizutreten:\n${link}`;
    try {
      await Share.share({ message, url: link, title: 'Revio – Einladung' });
    } catch {}
  };

  // Practice: save edited practice data
  const handleSavePractice = async () => {
    if (!authToken) return;
    setPracticeEditSaving(true);
    try {
      const body = {};
      if (editPracticeName.trim()) body.name = editPracticeName.trim();
      if (editPracticeCity.trim()) body.city = editPracticeCity.trim();
      if (editPracticeAddress.trim() !== undefined) body.address = editPracticeAddress.trim();
      if (editPracticePhone.trim() !== undefined) body.phone = editPracticePhone.trim();
      if (editPracticeHours.trim() !== undefined) body.hours = editPracticeHours.trim();
      body.description = editPracticeDescription.trim();
      body.homeVisit = editPracticeHomeVisit;
      if (editPracticeLogo !== null) body.logo = editPracticeLogo;
      if (editPracticePhotos.length > 0) body.photos = JSON.stringify(editPracticePhotos);

      const res = await fetch(`${getBaseUrl()}/my/practice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        Alert.alert('Gespeichert', 'Praxisdaten wurden aktualisiert.');
        await loadAdminPracticeDetail();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Speichern fehlgeschlagen.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    } finally {
      setPracticeEditSaving(false);
    }
  };

  // Practice: pick logo
  const handlePickPracticeLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Kein Zugriff', 'Bitte Fotobibliothek erlauben.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setEditPracticeLogo(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // Practice: add a photo
  const handleAddPracticePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Kein Zugriff', 'Bitte Fotobibliothek erlauben.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.4, base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setEditPracticePhotos(prev => [...prev, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  // GPS: request on demand only
  const handleGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Standort nicht verfügbar', 'Bitte erlaube den Standortzugriff in den Einstellungen.');
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
      Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
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
  const [locationLabel, setLocationLabel] = useState(''); // display: "Hauptstraße 5, München"
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);
  const [locationSheetCity, setLocationSheetCity] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const locationDebounceRef = React.useRef(null);
  const pendingGPSResult = React.useRef(null); // stores { city, coords, label } from GPS detection

  // Autocomplete: suggestions matching current input
  const acSuggestions = query.length >= 2
    ? allSuggestions.filter(s => s.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  const activeFilterCount = (homeVisit ? 1 : 0) + (kassenart ? 1 : 0) + fortbildungen.length;

  const toggleFortbildung = (key) => {
    setFortbildungen(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

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
    const origin = coords ?? userCoords;
    return list.filter(t => {
      if (homeVisit && !t.homeVisit) return false;
      if (kassenart && t.kassenart && t.kassenart !== kassenart) return false;
      if (fortbildungen.length > 0) {
        const certs = t.fortbildungen ?? t.certifications ?? [];
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
    if (!coords) return list;
    return list
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

  const runSearchWith = async (q, coords, cityOverride, originOverride) => {
    const effectiveCity = cityOverride ?? city;
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
      const response = await fetch(`${getBaseUrl()}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
        body: JSON.stringify({
          query: q || 'physiotherapie',
          city: effectiveCity,
          origin: effectiveOrigin ? {
            lat: effectiveOrigin.lat,
            lng: effectiveOrigin.lng,
          } : undefined,
          radiusKm: effectiveOrigin ? searchRadius : undefined,
          homeVisit: homeVisit || undefined,
          kassenart: kassenart || undefined,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const mapped = (payload.therapists ?? []).map(mapApiTherapist);
      const origin = effectiveOrigin;
      const withDist = withDistances(mapped, origin);
      const filtered = applyFilters(withDist, origin);
      if (filtered.length === 0 && withDist.length > 0) {
        Alert.alert('Radius zu klein', `${withDist.length} Therapeut:innen gefunden, aber alle außerhalb von ${searchRadius} km. Radius erhöhen?`);
      }
      setResults(filtered);
      setAllApiTherapists(withDist);
    } catch (err) {
      const message = String(err?.message ?? 'Unbekannter Fehler');
      const usingLocalTunnel = getBaseUrl().includes('.loca.lt');
      const tunnelHint = usingLocalTunnel
        ? '\n\nHinweis: Deine API-URL zeigt auf einen localtunnel-Link. Prüfe, ob der Tunnel noch aktiv ist oder nutze lokal besser die LAN-IP deines Rechners.'
        : '';
      Alert.alert('Verbindungsfehler', `Suche fehlgeschlagen: ${message}\n\nAPI-URL: ${getBaseUrl()}${tunnelHint}`);
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
    setQuery(suggestion);
    runSearchWith(suggestion, userCoords);
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
        setLocationSuggestions(data.map(item => ({
          label: item.display_name.split(',').slice(0, 3).join(',').trim(),
          city: item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || '',
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        })).filter(s => s.city));
      } catch {}
    }, 350);
  };

  const selectLocationSuggestion = (suggestion) => {
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
        Alert.alert('Fehler', 'Standortzugriff wird in diesem Browser nicht unterstützt.');
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
              Alert.alert('Fehler', 'Stadt konnte nicht erkannt werden. Bitte manuell eingeben.');
              setLocationLoading(false);
              return;
            }
            const streetParts = [addr.road, addr.house_number].filter(Boolean).join(' ');
            const label = streetParts ? `${streetParts}, ${detectedCity}` : detectedCity;
            pendingGPSResult.current = { city: detectedCity, coords: { lat: latitude, lng: longitude }, label };
            setLocationSheetCity(label);
          } catch {
            Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
          }
          setLocationLoading(false);
        },
        () => {
          Alert.alert('Kein Zugriff', 'Bitte erlaube den Standortzugriff im Browser.');
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Kein Zugriff', 'Bitte erlaube den Standortzugriff in den Einstellungen.');
        setLocationLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      const detectedCity = geo?.city || '';
      if (!detectedCity) {
        Alert.alert('Fehler', 'Stadt konnte nicht erkannt werden. Bitte manuell eingeben.');
        setLocationLoading(false);
        return;
      }
      // Build display label: "Straße Hausnr., Stadt"
      const streetParts = [geo.street, geo.streetNumber].filter(Boolean).join(' ');
      const label = streetParts ? `${streetParts}, ${detectedCity}` : detectedCity;
      pendingGPSResult.current = { city: detectedCity, coords: { lat: loc.coords.latitude, lng: loc.coords.longitude }, label };
      setLocationSheetCity(label);
    } catch {
      Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
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
    ]).then(([savedCity, savedLabel, savedLang, savedCoords]) => {
      if (savedCity) setCity(savedCity);
      if (savedLabel) setLocationLabel(savedLabel);
      if (savedLang === 'de' || savedLang === 'en') setAppLanguage(savedLang);
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
        setSelectedPracticeError(`Fehler ${res.status}: ${body.message ?? 'Therapeuten konnten nicht geladen werden.'}`);
      }
    } catch {
      setSelectedPracticeError('Verbindungsfehler beim Laden der Therapeuten.');
    } finally {
      setSelectedPracticeLoading(false);
    }
  };

  // ── Discover tab ──────────────────────────────────────────────────────────

  // Deduplicated practices with valid coordinates for map markers
  const mapPractices = React.useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const th of results) {
      for (const p of th.practices ?? []) {
        if (!seen.has(p.id) && p.lat !== 0 && p.lng !== 0) {
          seen.add(p.id);
          out.push(p);
        }
      }
    }
    return out;
  }, [results]);

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
    // No origin: fit to practice markers or fall back to Germany
    if (mapPractices.length === 0)
      return { latitude: 51.1657, longitude: 10.4515, latitudeDelta: 5.0, longitudeDelta: 5.0 };
    const avgLat = mapPractices.reduce((s, p) => s + p.lat, 0) / mapPractices.length;
    const avgLng = mapPractices.reduce((s, p) => s + p.lng, 0) / mapPractices.length;
    const latSpan = Math.max(...mapPractices.map(p => Math.abs(p.lat - avgLat))) * 2.2 || 0.08;
    const lngSpan = Math.max(...mapPractices.map(p => Math.abs(p.lng - avgLng))) * 2.2 || 0.08;
    return {
      latitude: avgLat, longitude: avgLng,
      latitudeDelta: Math.max(latSpan, 0.05),
      longitudeDelta: Math.max(lngSpan, 0.05),
    };
  }, [mapPractices, userCoords, searchRadius]);

  const getMapRegion = () => mapRegion;

  const renderDiscover = () => (
    <DiscoverScreen
      HeartButton={HeartButton}
      acSuggestions={acSuggestions}
      activeChip={activeChip}
      activeFilterCount={activeFilterCount}
      authToken={authToken}
      c={c}
      callPhone={callPhone}
      city={city}
      discoverScrollRef={discoverScrollRef}
      fortbildungen={fortbildungen}
      getMapRegion={getMapRegion}
      homeVisit={homeVisit}
      isFavorite={isFavorite}
      kassenart={kassenart}
      locationLabel={locationLabel}
      mapPractices={mapPractices}
      mapScrollEnabled={mapScrollEnabled}
      notifications={notifications}
      openPractice={openPractice}
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
        callPhone={callPhone}
        isPracticeFavorite={isPracticeFavorite}
        openPractice={openPractice}
        practice={practice}
        selectedPracticeError={selectedPracticeError}
        selectedPracticeLoading={selectedPracticeLoading}
        selectedPracticeTherapists={selectedPracticeTherapists}
        setSelectedPractice={setSelectedPractice}
        setSelectedTherapist={setSelectedTherapist}
        styles={styles}
        t={t}
        toggleFavoritePractice={toggleFavoritePractice}
      />
    );
  };

  const renderTherapistProfile = (th) => {
    return (
      <TherapistProfileScreen
        HeartButton={HeartButton}
        c={c}
        callPhone={callPhone}
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

  // ── Therapist dashboard (logged in) ───────────────────────────────────────

  const renderTherapistDashboard = () => {
    const th = loggedInTherapist;

    const enterEdit = () => {
      setEditBio(th.bio ?? '');
      setEditSpecializations((th.specializations ?? []).join(', '));
      setEditLanguages(normalizeLanguageCodes(th.languages));
      setEditHomeVisit(th.homeVisit ?? false);
      setEditIsVisible(th.isVisible ?? true);
      setEditAvailability(th.availability ?? '');
      setEditMode(true);
    };

    return (
      <TherapistDashboardScreen
        authToken={authToken}
        c={c}
        editAvailability={editAvailability}
        editBio={editBio}
        editHomeVisit={editHomeVisit}
        editIsVisible={editIsVisible}
        editLanguages={editLanguages}
        editMode={editMode}
        editSpecializations={editSpecializations}
        handleLoadInviteToken={handleLoadInviteToken}
        handlePickPhoto={handlePickPhoto}
        handleSaveProfile={handleSaveProfile}
        inviteToken={inviteToken}
        loadAdminPracticeDetail={loadAdminPracticeDetail}
        loggedInTherapist={loggedInTherapist}
        onEnterEdit={enterEdit}
        openPractice={openPractice}
        profileSaving={profileSaving}
        setAdminPracticeDetail={setAdminPracticeDetail}
        setEditAvailability={setEditAvailability}
        setEditBio={setEditBio}
        setEditHomeVisit={setEditHomeVisit}
        setEditIsVisible={setEditIsVisible}
        setEditLanguages={setEditLanguages}
        setEditMode={setEditMode}
        setEditSpecializations={setEditSpecializations}
        setInvitePageTab={setInvitePageTab}
        setPracticeSearchQuery={setPracticeSearchQuery}
        setPracticeSearchResults={setPracticeSearchResults}
        setShowCreatePractice={setShowCreatePractice}
        setShowInvitePage={setShowInvitePage}
        setShowPracticeAdmin={setShowPracticeAdmin}
        setShowPracticeSearch={setShowPracticeSearch}
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
    />
  );

  // ── Optionen tab ──────────────────────────────────────────────────────────

  const renderOptions = () => (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>{t('optionsTitle')}</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>{t('optionsSubtitle')}</Text>
          </View>
        </View>

        {[
          { label: t('privacyOption'), value: t('comingSoon') },
          { label: t('imprintOption'), value: t('comingSoon') },
          { label: t('appVersionOption'), value: '0.1.0 MVP' }
        ].map((item) => (
          <Pressable key={item.label} style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.optionLabel, { color: c.text }]}>{item.label}</Text>
            <Text style={[styles.optionValue, { color: c.muted }]}>{item.value} ›</Text>
          </Pressable>
        ))}

        {/* Sprache toggle */}
        <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.optionLabel, { color: c.text }]}>{t('languageOption')}</Text>
          <View style={styles.themeToggleRow}>
            {[
              { key: 'de', label: 'DE' },
              { key: 'en', label: 'EN' },
            ].map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => {
                  setAppLanguage(key);
                  AsyncStorage.setItem('appLanguage', key);
                }}
                style={[
                  styles.themeBtn,
                  appLanguage === key
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: c.mutedBg, borderColor: c.border }
                ]}
              >
                <Text style={[styles.themeBtnText, { color: appLanguage === key ? '#FFFFFF' : c.muted }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Erscheinungsbild toggle */}
        <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.optionLabel, { color: c.text }]}>{t('appearanceOption')}</Text>
          <View style={styles.themeToggleRow}>
            {[
              { key: 'light',  label: t('themeLight') },
              { key: 'dark',   label: t('themeDark') },
              { key: 'system', label: t('themeSystem') }
            ].map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => setThemeMode(key)}
                style={[
                  styles.themeBtn,
                  themeMode === key
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: c.mutedBg, borderColor: c.border }
                ]}
              >
                <Text style={[styles.themeBtnText, { color: themeMode === key ? '#FFFFFF' : c.muted }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loggedInTherapist && (
          <>
            <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>{t('myPractice')}</Text>
            {loggedInTherapist.adminPractice ? (
              <Pressable
                onPress={() => { setAdminPracticeDetail(null); loadAdminPracticeDetail(); setShowPracticeAdmin(true); }}
                style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
              >
                <View>
                  <Text style={[styles.optionLabel, { color: c.text }]}>{loggedInTherapist.adminPractice.name}</Text>
                  <Text style={[{ fontSize: 12, color: c.muted }]}>{loggedInTherapist.adminPractice.city}</Text>
                </View>
                <Text style={[styles.optionValue, { color: c.primary }]}>{t('managePractice')} ›</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => setShowCreatePractice(true)}
                  style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
                >
                  <Text style={[styles.optionLabel, { color: c.text }]}>{t('newPractice')}</Text>
                  <Text style={[styles.optionValue, { color: c.primary }]}>＋</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setPracticeSearchQuery(''); setPracticeSearchResults([]); setShowPracticeSearch(true); }}
                  style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
                >
                  <Text style={[styles.optionLabel, { color: c.text }]}>{t('linkPractice')}</Text>
                  <Text style={[styles.optionValue, { color: c.primary }]}>🔗</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {!loggedInTherapist && accountType !== 'manager' && (
          <Pressable
            onPress={() => { setActiveTab('therapist'); setShowLogin(true); }}
            style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <Text style={[styles.optionLabel, { color: c.muted }]}>{t('notLoggedIn')}</Text>
            <Text style={[styles.optionValue, { color: c.primary }]}>{t('loginAction')} ›</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Abmelden + Konto löschen — fixed am unteren Rand */}
      {(loggedInTherapist || accountType === 'manager') && (
        <View style={{ marginHorizontal: 16, marginBottom: 16, gap: 10 }}>
          <Pressable
            onPress={accountType === 'manager' ? handleManagerLogout : handleLogout}
            style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#E74C3C' }}
          >
            <Text style={{ color: '#E74C3C', fontSize: 16, fontWeight: '600' }}>{t('logoutBtn')}</Text>
          </Pressable>
          {loggedInTherapist && (
            <Pressable
              onPress={handleDeleteAccount}
              style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: c.muted, fontSize: 14 }}>{t('deleteAccount')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  // ── Neue Praxis erstellen ─────────────────────────────────────────────────

  const renderCreatePractice = () => (
    <CreatePracticeScreen
      c={c}
      createPracticeAddress={createPracticeAddress}
      createPracticeCity={createPracticeCity}
      createPracticeHours={createPracticeHours}
      createPracticeLoading={createPracticeLoading}
      createPracticeName={createPracticeName}
      createPracticePhone={createPracticePhone}
      handleCreatePractice={handleCreatePractice}
      setCreatePracticeAddress={setCreatePracticeAddress}
      setCreatePracticeCity={setCreatePracticeCity}
      setCreatePracticeHours={setCreatePracticeHours}
      setCreatePracticeName={setCreatePracticeName}
      setCreatePracticePhone={setCreatePracticePhone}
      setShowCreatePractice={setShowCreatePractice}
      styles={styles}
      t={t}
    />
  );

  // ── Praxis suchen & vernetzen ─────────────────────────────────────────────

  const renderPracticeSearch = () => (
    <PracticeSearchScreen
      c={c}
      handleConnectToPractice={handleConnectToPractice}
      handleSearchPractices={handleSearchPractices}
      practiceSearchLoading={practiceSearchLoading}
      practiceSearchQuery={practiceSearchQuery}
      practiceSearchResults={practiceSearchResults}
      setPracticeSearchQuery={setPracticeSearchQuery}
      setShowPracticeSearch={setShowPracticeSearch}
      styles={styles}
      t={t}
    />
  );

  // ── Praxis-Admin Dashboard ────────────────────────────────────────────────

  const renderInvitePage = () => (
    <InvitePageScreen
      c={c}
      createTherapistAvailability={createTherapistAvailability}
      createTherapistBio={createTherapistBio}
      createTherapistCity={createTherapistCity}
      createTherapistEmail={createTherapistEmail}
      createTherapistError={createTherapistError}
      createTherapistHomeVisit={createTherapistHomeVisit}
      createTherapistKassenart={createTherapistKassenart}
      createTherapistLangs={createTherapistLangs}
      createTherapistLoading={createTherapistLoading}
      createTherapistName={createTherapistName}
      createTherapistSpecs={createTherapistSpecs}
      createTherapistTitle={createTherapistTitle}
      getInviteLink={(token) => `https://revio.app/join/${token}`}
      handleCreateTherapist={handleCreateTherapist}
      handleLoadInviteToken={handleLoadInviteToken}
      handleShareInviteLink={handleShareInviteLink}
      invitePageTab={invitePageTab}
      inviteToken={inviteToken}
      inviteTokenLoading={inviteTokenLoading}
      setCreateTherapistAvailability={setCreateTherapistAvailability}
      setCreateTherapistBio={setCreateTherapistBio}
      setCreateTherapistCity={setCreateTherapistCity}
      setCreateTherapistEmail={setCreateTherapistEmail}
      setCreateTherapistHomeVisit={setCreateTherapistHomeVisit}
      setCreateTherapistKassenart={setCreateTherapistKassenart}
      setCreateTherapistLangs={setCreateTherapistLangs}
      setCreateTherapistName={setCreateTherapistName}
      setCreateTherapistSpecs={setCreateTherapistSpecs}
      setCreateTherapistTitle={setCreateTherapistTitle}
      setInvitePageTab={setInvitePageTab}
      setShowInvitePage={setShowInvitePage}
      styles={styles}
      t={t}
    />
  );

  const renderPracticeAdmin = () => {
    const p = adminPracticeDetail;
    if (editPracticeName === '' && p.name) {
      setEditPracticeName(p.name);
      setEditPracticeCity(p.city ?? '');
      setEditPracticeAddress(p.address ?? '');
      setEditPracticePhone(p.phone ?? '');
      setEditPracticeHours(p.hours ?? '');
      setEditPracticeDescription(p.description ?? '');
      setEditPracticeHomeVisit(p.homeVisit ?? false);
      if (p.logo) setEditPracticeLogo(p.logo);
      if (p.photos) {
        try { setEditPracticePhotos(JSON.parse(p.photos)); } catch {}
      }
    }

    return (
      <PracticeAdminScreen
        adminPracticeDetail={adminPracticeDetail}
        c={c}
        editPracticeAddress={editPracticeAddress}
        editPracticeCity={editPracticeCity}
        editPracticeDescription={editPracticeDescription}
        editPracticeHomeVisit={editPracticeHomeVisit}
        editPracticeHours={editPracticeHours}
        editPracticeLogo={editPracticeLogo}
        editPracticeName={editPracticeName}
        editPracticePhone={editPracticePhone}
        editPracticePhotos={editPracticePhotos}
        handleAddPracticePhoto={handleAddPracticePhoto}
        handleDeletePractice={handleDeletePractice}
        handleLinkAction={handleLinkAction}
        handleLoadInviteToken={handleLoadInviteToken}
        handlePickPracticeLogo={handlePickPracticeLogo}
        handleResendInvite={handleResendInvite}
        handleSavePractice={handleSavePractice}
        inviteSectionY={inviteSectionY}
        inviteToken={inviteToken}
        openTherapistById={openTherapistById}
        practiceAdminScrollRef={practiceAdminScrollRef}
        practiceEditSaving={practiceEditSaving}
        scrollToInvite={scrollToInvite}
        setEditPracticeAddress={setEditPracticeAddress}
        setEditPracticeCity={setEditPracticeCity}
        setEditPracticeDescription={setEditPracticeDescription}
        setEditPracticeHomeVisit={setEditPracticeHomeVisit}
        setEditPracticeHours={setEditPracticeHours}
        setEditPracticeLogo={setEditPracticeLogo}
        setEditPracticeName={setEditPracticeName}
        setEditPracticePhone={setEditPracticePhone}
        setEditPracticePhotos={setEditPracticePhotos}
        setInvitePageTab={setInvitePageTab}
        setScrollToInvite={setScrollToInvite}
        setShowInvitePage={setShowInvitePage}
        setShowPracticeAdmin={setShowPracticeAdmin}
        styles={styles}
        t={t}
      />
    );
  };

  // ── Favorites tab ─────────────────────────────────────────────────────────

  const renderFavorites = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
        <Text style={[styles.headerTitle, { color: c.text }]}>{t('favoritesTitle')}</Text>
      </View>

      <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border, marginBottom: 4 }]}>
        <View style={styles.lockBadge}>
          <Ionicons name="accessibility" size={16} color="#6b8fa0" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.noticeBody, { color: c.muted, flex: 0 }]}>{t('favoritesHint')}</Text>
        </View>
      </View>

      {favorites.length === 0 && favoritePractices.length === 0 ? (
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
                <HeartButton isSaved={true} onToggle={() => toggleFavorite(fav)} hitSlop={10} />
              </View>
              {fav.practices?.length > 0 && (
                <Pressable
                  onPress={() => openPractice(fav.practices[0])}
                  style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}
                >
                  <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                    <Text style={[styles.practiceInitialText, { color: c.muted }]}>{fav.practices[0].name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.practiceName, { color: c.text }]}>{fav.practices[0].name}</Text>
                    <Text style={[styles.practiceCity, { color: c.muted }]}>{fav.practices[0].city}</Text>
                  </View>
                  <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.ctaBtn, { backgroundColor: c.accent }]}
                onPress={() => callPhone(fav.practices?.[0]?.phone)}
              >
                <Text style={styles.ctaBtnText}>{t('callPractice')}</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      {favoritePractices.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: c.text, marginTop: favorites.length > 0 ? 8 : 0 }]}>{t('favoritesPractices')}</Text>
          {favoritePractices.map((p) => {
            return (
            <View key={p.id} style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Pressable onPress={() => openPractice(p)} style={styles.cardTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  {p.logo ? (
                    <Image source={{ uri: p.logo }} style={[styles.avatar, { borderRadius: 10 }]} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: c.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                        {p.name.split(' ').filter(w => w.length > 2).map(w => w[0]).join('').toUpperCase().slice(0, 2) || p.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: c.text }]}>{p.name}</Text>
                    <Text style={[styles.cardTitle, { color: c.muted }]}>{p.city}</Text>
                  </View>
                  <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
                </View>
                <Pressable onPress={(e) => { e.stopPropagation(); toggleFavoritePractice(p); }} hitSlop={10}>
                  <Ionicons name="heart" size={22} color="#E05A77" />
                </Pressable>
              </Pressable>
              {p.phone && (
                <Pressable
                  style={[styles.ctaBtn, { backgroundColor: c.accent }]}
                  onPress={() => callPhone(p.phone)}
                >
                  <Text style={styles.ctaBtnText}>{t('callPractice')}</Text>
                </Pressable>
              )}
            </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );

  // ── Register flow ──────────────────────────────────────────────────────────

  const renderRegister = () => {
    if (regSubmitted) {
      return (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
          <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center', paddingVertical: 40 }]}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
            <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center' }]}>Eingereicht!</Text>
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>
              {__DEV__
                ? 'Entwicklungsmodus: Dein Profil wurde automatisch freigegeben und ist sofort in der Suche sichtbar.'
                : 'Dein Profil wird innerhalb von 48 Stunden manuell geprüft. Den Status kannst du jederzeit in der App unter „Für Therapeuten" einsehen.'}
            </Text>
            <Pressable
              style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 24, paddingHorizontal: 32 }]}
              onPress={() => { setShowRegister(false); setRegSubmitted(false); setRegStep(1); }}
            >
              <Text style={styles.registerBtnText}>Zurück zur App</Text>
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
          return regLanguages.length > 0;
        case 4:
          if (regPracticeMode === 'new') return regPracticeName.trim().length > 0 && regPracticeCity.trim().length > 0;
          if (regPracticeMode === 'existing') return !!regExistingPracticeId;
          return true; // skip
        default:
          return true;
      }
    };

    const renderStepContent = () => {
      switch (regStep) {
        case 1:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Account erstellen</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>Erstelle dein Revio-Konto</Text>
              <TextInput value={regEmail} onChangeText={setRegEmail} placeholder="E-Mail-Adresse" placeholderTextColor={c.muted} keyboardType="email-address" autoCapitalize="none" style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regPassword} onChangeText={setRegPassword} placeholder="Passwort (mind. 6 Zeichen)" placeholderTextColor={c.muted} secureTextEntry style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regPasswordConfirm} onChangeText={setRegPasswordConfirm} placeholder="Passwort bestätigen" placeholderTextColor={c.muted} secureTextEntry style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              {regPasswordConfirm.length > 0 && regPassword !== regPasswordConfirm && (
                <Text style={{ color: '#E05A77', fontSize: 13, marginTop: -6 }}>Passwörter stimmen nicht überein</Text>
              )}
            </>
          );
        case 2:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Persönliche Angaben</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>Erzähl uns etwas über dich</Text>
              <TextInput value={regFirstName} onChangeText={setRegFirstName} placeholder="Vorname" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regLastName} onChangeText={setRegLastName} placeholder="Nachname" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regCity} onChangeText={setRegCity} placeholder="Stadt (z. B. Köln)" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regBio} onChangeText={setRegBio} placeholder="Kurze Vorstellung…" placeholderTextColor={c.muted} multiline numberOfLines={4} style={[styles.regInput, styles.regTextarea, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            </>
          );
        case 3:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Fachliches Profil</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>Spezialisierungen, Sprachen & mehr</Text>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Spezialisierungen <Text style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(optional)</Text></Text>
              <View style={styles.tagRow}>
                {regSpecOptions.map(s => {
                  const active = regSpecializations.includes(s);
                  return (
                    <Pressable key={s} onPress={() => toggleRegSpec(s)} style={[styles.chip, active ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.card, borderColor: c.border }]}>
                      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : c.text }]}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 14 }]}>Sprachen</Text>
              <View>
                {languageOptions.map(l => {
                  const checked = regLanguages.includes(l);
                  return (
                    <Pressable key={l} onPress={() => toggleRegLang(l)} style={styles.checkRow}>
                      <View style={[styles.checkbox, { borderColor: checked ? c.primary : c.border, backgroundColor: checked ? c.primary : 'transparent' }]}>
                        {checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.checkLabel, { color: c.text }]}>{getLangLabel(l)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 14 }]}>Fortbildungen <Text style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(Checkliste)</Text></Text>
              {fortbildungOptions.map(opt => {
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
              <View style={[styles.switchRow, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchTitle, { color: c.text }]}>Hausbesuche</Text>
                  <Text style={[styles.switchLabel, { color: c.muted }]}>Du bist bereit, Patienten zu Hause zu behandeln</Text>
                </View>
                <Switch value={regHomeVisit} onValueChange={setRegHomeVisit} trackColor={{ true: c.success }} />
              </View>
            </>
          );
        case 4:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Praxis verbinden</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>In welcher Praxis arbeitest du? (optional)</Text>

              <View style={styles.kassenartRow}>
                {[
                  { key: 'new', label: '＋ Neue Praxis' },
                  { key: 'existing', label: '🔗 Bestehende' },
                  { key: 'skip', label: 'Überspringen' },
                ].map(opt => {
                  const active = regPracticeMode === opt.key;
                  return (
                    <Pressable key={opt.key} onPress={() => setRegPracticeMode(opt.key)}
                      style={[styles.kassenartBtn, active ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                      <Text style={[styles.kassenartText, { color: active ? '#FFFFFF' : c.text }]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {regPracticeMode === 'new' && (
                <>
                  <TextInput value={regPracticeName} onChangeText={setRegPracticeName} placeholder="Praxisname" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
                  <TextInput value={regPracticeAddress} onChangeText={setRegPracticeAddress} placeholder="Straße und Hausnummer" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
                  <TextInput value={regPracticeCity} onChangeText={setRegPracticeCity} placeholder="Stadt (z. B. Köln)" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
                  <TextInput value={regPracticePhone} onChangeText={setRegPracticePhone} placeholder="Telefonnummer" placeholderTextColor={c.muted} keyboardType="phone-pad" style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
                </>
              )}

              {regPracticeMode === 'existing' && (
                <>
                  <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                    <Text style={styles.noticeIcon}>ℹ️</Text>
                    <Text style={[styles.noticeBody, { color: c.muted }]}>
                      Suche nach der Praxis. Der Praxis-Admin muss deine Anfrage anschließend bestätigen.
                    </Text>
                  </View>
                  <TextInput
                    value={regExistingPracticeName}
                    onChangeText={async (text) => {
                      setRegExistingPracticeName(text);
                      setRegExistingPracticeId(null);
                      if (text.length < 2) { setRegPracticeSearchResults([]); return; }
                      setRegPracticeSearching(true);
                      try {
                        const res = await fetch(`${getBaseUrl()}/practices/search?q=${encodeURIComponent(text)}`);
                        if (res.ok) { const d = await res.json(); setRegPracticeSearchResults(d.practices ?? []); }
                      } catch { /* ignore */ } finally { setRegPracticeSearching(false); }
                    }}
                    placeholder="Praxisname oder Stadt suchen…"
                    placeholderTextColor={c.muted}
                    style={[styles.regInput, { backgroundColor: c.card, borderColor: regExistingPracticeId ? c.primary : c.border, color: c.text }]}
                  />
                  {regPracticeSearching && <Text style={[styles.regStepSub, { color: c.muted }]}>Suche…</Text>}
                  {regPracticeSearchResults.length > 0 && !regExistingPracticeId && (
                    <View style={[{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: c.border, marginTop: 4 }]}>
                      {regPracticeSearchResults.map((p, i) => (
                        <Pressable
                          key={p.id}
                          onPress={() => { setRegExistingPracticeId(p.id); setRegExistingPracticeName(`${p.name} – ${p.city}`); setRegPracticeSearchResults([]); }}
                          style={[{ padding: 12, backgroundColor: c.card, borderTopWidth: i > 0 ? 1 : 0, borderColor: c.border }]}
                        >
                          <Text style={[styles.practiceName, { color: c.text }]}>{p.name}</Text>
                          <Text style={[styles.practiceCity, { color: c.muted }]}>{p.city}{p.address ? ` · ${p.address}` : ''}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {regExistingPracticeId && (
                    <View style={[styles.noticeBox, { backgroundColor: c.successBg, borderColor: c.success }]}>
                      <Text style={styles.noticeIcon}>✅</Text>
                      <Text style={[styles.noticeBody, { color: c.success }]}>Praxis ausgewählt. Anfrage wird nach Registrierung gestellt.</Text>
                    </View>
                  )}
                </>
              )}

              {regPracticeMode === 'skip' && (
                <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                  <Text style={styles.noticeIcon}>✓</Text>
                  <Text style={[styles.noticeBody, { color: c.muted }]}>
                    Du kannst eine Praxis später in deinen Profileinstellungen hinzufügen.
                  </Text>
                </View>
              )}
            </>
          );
        case 5:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Vorschau & Einreichen</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>Überprüfe deine Angaben vor dem Einreichen</Text>
              {[
                { label: 'Name', value: `${regFirstName} ${regLastName}`.trim() || '—' },
                { label: 'E-Mail', value: regEmail || '—' },
                { label: 'Stadt', value: regCity || '—' },
                { label: 'Spezialisierungen', value: regSpecializations.join(', ') || '—' },
                { label: 'Sprachen', value: regLanguages.map(getLangLabel).join(', ') || '—' },
                { label: 'Hausbesuche', value: regHomeVisit ? 'Ja' : 'Nein' },
                { label: 'Praxis', value: regPracticeMode === 'new' ? (regPracticeName || '—') : regPracticeMode === 'existing' ? (regExistingPracticeName || '—') : 'Keine Praxis' },
                ...(regPracticeMode === 'new' ? [{ label: 'Adresse', value: [regPracticeAddress, regPracticeCity].filter(Boolean).join(', ') || '—' }] : []),
              ].map(row => (
                <View key={row.label} style={[styles.previewRow, { borderBottomColor: c.border }]}>
                  <Text style={[styles.previewLabel, { color: c.muted }]}>{row.label}</Text>
                  <Text style={[styles.previewValue, { color: c.text }]}>{row.value}</Text>
                </View>
              ))}
              {regBio ? (
                <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, marginTop: 4 }]}>
                  <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Über mich</Text>
                  <Text style={[styles.infoBody, { color: c.text, fontSize: 14 }]}>{regBio}</Text>
                </View>
              ) : null}
              <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                <Text style={styles.noticeIcon}>ℹ️</Text>
                <Text style={[styles.noticeBody, { color: c.muted }]}>
                  Dein Profil wird nach dem Einreichen manuell geprüft. Den Status kannst du jederzeit in der App einsehen.
                </Text>
              </View>
            </>
          );
        default:
          return null;
      }
    };

    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => { if (regStep === 1) setShowRegister(false); else setRegStep(s => s - 1); }}
          style={styles.backBtn}
        >
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {regStep === 1 ? 'Abbrechen' : t('backBtn')}</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>Registrierung</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>Schritt {regStep} von {REG_STEPS}</Text>
          </View>
        </View>

        {renderProgress()}

        {renderStepContent()}

        <Pressable
          style={[styles.registerBtn, { backgroundColor: canProceed() ? c.primary : c.border, marginTop: 8 }]}
          onPress={async () => {
            if (regStep < REG_STEPS) {
              setRegStep(s => s + 1);
            } else {
              try {
                const res = await fetch(`${getBaseUrl()}/register/therapist`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: regEmail,
                    password: regPassword,
                    fullName: `${regFirstName} ${regLastName}`.trim(),
                    professionalTitle: 'Physiotherapeut/in',
                    city: regCity,
                    bio: regBio || undefined,
                    homeVisit: regHomeVisit,
                    specializations: regSpecializations.length > 0 ? regSpecializations : ['Physiotherapie'],
                    languages: regLanguages.length > 0 ? regLanguages.map(l => l.toLowerCase()) : ['de'],
                    certifications: regFortbildungen,
                    ...(regPracticeMode === 'new' ? {
                      practice: {
                        name: regPracticeName || 'Eigene Praxis',
                        city: regPracticeCity || regCity,
                        address: regPracticeAddress || undefined,
                        phone: regPracticePhone || undefined,
                      },
                    } : regPracticeMode === 'existing' && regExistingPracticeId ? {
                      existingPracticeId: regExistingPracticeId,
                    } : {}),
                  }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  showWebAlert(err.message ?? 'Fehler beim Einreichen. Bitte versuche es erneut.');
                  return;
                }
              } catch {
                showWebAlert('Verbindungsfehler. Bitte prüfe deine Internetverbindung.');
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
            Alert.alert('Profil sichtbar', 'Dein Profil ist jetzt öffentlich sichtbar.');
          } else if (data.missingFields && data.missingFields.length > 0) {
            const fields = data.missingFields.join(', ');
            Alert.alert(
              'Profil unvollständig',
              `Bevor dein Profil sichtbar wird, fülle bitte noch folgende Felder aus: ${fields}`,
              [{ text: 'Profil bearbeiten', onPress: () => setActiveTab('therapist') }, { text: 'Später', style: 'cancel' }]
            );
          }
        } else {
          Alert.alert('Profil versteckt', 'Dein Profil ist jetzt nicht öffentlich sichtbar.');
        }
      } else {
        Alert.alert('Fehler', data.message ?? 'Einstellung konnte nicht gespeichert werden.');
      }
    } catch {
      setShowVisibilityModal(false);
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    } finally {
      setVisibilityLoading(false);
    }
  };

  const renderInviteClaimScreen = () => {
    if (inviteClaimLoading && !inviteClaimData) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background }}>
          <Text style={{ color: c.muted, fontSize: 15 }}>Einladung wird geprüft…</Text>
        </View>
      );
    }

    if (inviteClaimError && !inviteClaimData) {
      return (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}>
          <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, marginTop: 40 }]}>
            <Ionicons name="alert-circle-outline" size={40} color="#E74C3C" style={{ alignSelf: 'center' }} />
            <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center' }]}>Ungültige Einladung</Text>
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center' }]}>{inviteClaimError}</Text>
            <Pressable
              style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 8 }]}
              onPress={() => { setShowInviteClaim(false); setInviteClaimError(''); }}
            >
              <Text style={styles.registerBtnText}>Zur App</Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    if (!inviteClaimData) return null;

    const { therapist: inviteTherapist, practice: invitePractice } = inviteClaimData;

    const handleClaim = async () => {
      if (!inviteClaimPassword || inviteClaimPassword.length < 6) {
        setInviteClaimError('Das Passwort muss mindestens 6 Zeichen lang sein.');
        return;
      }
      if (inviteClaimPassword !== inviteClaimPasswordConfirm) {
        setInviteClaimError('Die Passwörter stimmen nicht überein.');
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
          setInviteClaimError(data.message ?? 'Fehler beim Aktivieren des Kontos.');
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
        setInviteClaimError('Verbindungsfehler. Bitte prüfe deine Internetverbindung.');
      } finally {
        setInviteClaimLoading(false);
      }
    };

    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, marginTop: 20, alignItems: 'center' }]}>
          <View style={[styles.logoMark, { backgroundColor: c.primary, width: 56, height: 56, borderRadius: 16 }]}>
            <Text style={[styles.logoText, { fontSize: 24 }]}>R</Text>
          </View>
          <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center', marginTop: 8 }]}>Du wurdest eingeladen!</Text>
          <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center' }]}>
            {invitePractice.name} hat ein Profil für dich erstellt. Setze jetzt ein Passwort, um dein Konto zu aktivieren.
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>DEIN PROFIL</Text>
          <Text style={[styles.detailInfoValue, { color: c.text, fontWeight: '700', fontSize: 17 }]}>{inviteTherapist.fullName}</Text>
          <Text style={[styles.detailInfoValue, { color: c.muted }]}>{inviteTherapist.professionalTitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Ionicons name="business-outline" size={14} color={c.muted} />
            <Text style={[styles.detailInfoValue, { color: c.muted }]}>{invitePractice.name}, {invitePractice.city}</Text>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>PASSWORT SETZEN</Text>
          <TextInput
            style={[styles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginTop: 6 }]}
            value={inviteClaimPassword}
            onChangeText={setInviteClaimPassword}
            placeholder="Passwort (mind. 6 Zeichen)"
            placeholderTextColor={c.muted}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginTop: 10 }]}
            value={inviteClaimPasswordConfirm}
            onChangeText={setInviteClaimPasswordConfirm}
            placeholder="Passwort wiederholen"
            placeholderTextColor={c.muted}
            secureTextEntry
            autoCapitalize="none"
          />
          {!!inviteClaimError && (
            <Text style={{ color: '#E74C3C', fontSize: 13, marginTop: 8 }}>{inviteClaimError}</Text>
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

  // ── Manager Registration Flow ─────────────────────────────────────────────

  const MGR_REG_STEPS = mgrIsTherapist ? 5 : 4;

  const mgrRegCanProceed = () => {
    switch (mgrRegStep) {
      case 1:
        return mgrEmail.length > 3 && mgrPassword.length >= 6 && mgrPassword === mgrPasswordConfirm;
      case 2:
        return mgrPracticeName.trim().length > 0 && mgrPracticeCity.trim().length > 0;
      case 3:
        return true; // role selection always valid
      case 4:
        if (mgrIsTherapist) return mgrFullName.trim().length > 0 && mgrProfTitle.trim().length > 0;
        return true; // summary step
      default:
        return true;
    }
  };

  const handleManagerRegSubmit = async () => {
    setMgrRegLoading(true);
    setMgrRegError('');
    try {
      const body = {
        email: mgrEmail,
        password: mgrPassword,
        practiceName: mgrPracticeName,
        practiceCity: mgrPracticeCity,
        isTherapist: mgrIsTherapist,
      };
      if (mgrPracticeAddress.trim()) body.practiceAddress = mgrPracticeAddress.trim();
      if (mgrPracticePhone.trim()) body.practicePhone = mgrPracticePhone.trim();
      if (mgrIsTherapist && mgrFullName.trim()) body.fullName = mgrFullName.trim();
      if (mgrIsTherapist && mgrProfTitle.trim()) body.professionalTitle = mgrProfTitle.trim();
      const res = await fetch(`${getBaseUrl()}/manager/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMgrRegError(data.message ?? 'Registrierung fehlgeschlagen.');
        return;
      }
      await AsyncStorage.setItem('revio_auth_token', data.token);
      await AsyncStorage.setItem('revio_account_type', 'manager');
      setAuthToken(data.token);
      setAccountType('manager');
      const meRes = await fetch(`${getBaseUrl()}/manager/me`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (meRes.ok) {
        const mgrData = await meRes.json();
        setLoggedInManager(mgrData);
        setActivePracticeId(mgrData.practices?.[0]?.id ?? null);
      }
      setShowManagerReg(false);
      // Reset form
      setMgrEmail(''); setMgrPassword(''); setMgrPasswordConfirm('');
      setMgrPracticeName(''); setMgrPracticeCity(''); setMgrPracticeAddress(''); setMgrPracticePhone('');
      setMgrIsTherapist(false); setMgrFullName(''); setMgrProfTitle('');
      setMgrRegStep(1);
    } catch {
      setMgrRegError('Verbindungsfehler. Bitte prüfe deine Internetverbindung.');
    } finally {
      setMgrRegLoading(false);
    }
  };

  const renderManagerReg = () => {
    const renderProgress = () => (
      <View style={styles.regProgressRow}>
        {Array.from({ length: MGR_REG_STEPS }).map((_, i) => (
          <View key={i} style={[styles.regProgressBar, { backgroundColor: i < mgrRegStep ? c.primary : c.border }]} />
        ))}
      </View>
    );

    // Determine actual step label (step 4 is therapist profile if mgrIsTherapist, else summary)
    const isSummaryStep = mgrIsTherapist ? mgrRegStep === 5 : mgrRegStep === 4;

    const renderStepContent = () => {
      if (mgrRegStep === 1) {
        return (
          <>
            <Text style={[styles.regStepTitle, { color: c.text }]}>Zugangsdaten</Text>
            <Text style={[styles.regStepSub, { color: c.muted }]}>Erstelle deinen Praxis-Account</Text>
            <TextInput value={mgrEmail} onChangeText={setMgrEmail} placeholder="E-Mail-Adresse" placeholderTextColor={c.muted} keyboardType="email-address" autoCapitalize="none" style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            <TextInput value={mgrPassword} onChangeText={setMgrPassword} placeholder="Passwort (mind. 6 Zeichen)" placeholderTextColor={c.muted} secureTextEntry style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            <TextInput value={mgrPasswordConfirm} onChangeText={setMgrPasswordConfirm} placeholder="Passwort wiederholen" placeholderTextColor={c.muted} secureTextEntry style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            {mgrPasswordConfirm.length > 0 && mgrPassword !== mgrPasswordConfirm && (
              <Text style={{ color: '#E05A77', fontSize: 13, marginTop: -6 }}>Passwörter stimmen nicht überein</Text>
            )}
          </>
        );
      }
      if (mgrRegStep === 2) {
        return (
          <>
            <Text style={[styles.regStepTitle, { color: c.text }]}>Praxis-Daten</Text>
            <Text style={[styles.regStepSub, { color: c.muted }]}>Informationen zu deiner Praxis</Text>
            <TextInput value={mgrPracticeName} onChangeText={setMgrPracticeName} placeholder="Praxisname *" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            <TextInput value={mgrPracticeCity} onChangeText={setMgrPracticeCity} placeholder="Stadt * (z. B. Köln)" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            <TextInput value={mgrPracticeAddress} onChangeText={setMgrPracticeAddress} placeholder="Adresse (optional)" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            <TextInput value={mgrPracticePhone} onChangeText={setMgrPracticePhone} placeholder="Telefon (optional)" placeholderTextColor={c.muted} keyboardType="phone-pad" style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
          </>
        );
      }
      if (mgrRegStep === 3) {
        return (
          <>
            <Text style={[styles.regStepTitle, { color: c.text }]}>Deine Rolle</Text>
            <Text style={[styles.regStepSub, { color: c.muted }]}>Bist du selbst auch Therapeut/in?</Text>
            <Pressable
              onPress={() => setMgrIsTherapist(false)}
              style={{ backgroundColor: !mgrIsTherapist ? c.primary : c.card, borderWidth: 2, borderColor: !mgrIsTherapist ? c.primary : c.border, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 16, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Ionicons name={!mgrIsTherapist ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={!mgrIsTherapist ? '#fff' : c.muted} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: !mgrIsTherapist ? '#fff' : c.text, fontWeight: '700', fontSize: 15 }}>Nein, nur Praxismanager</Text>
                <Text style={{ color: !mgrIsTherapist ? 'rgba(255,255,255,0.8)' : c.muted, fontSize: 13, marginTop: 2 }}>Ich verwalte die Praxis, bin aber kein Therapeut</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setMgrIsTherapist(true)}
              style={{ backgroundColor: mgrIsTherapist ? c.primary : c.card, borderWidth: 2, borderColor: mgrIsTherapist ? c.primary : c.border, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Ionicons name={mgrIsTherapist ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={mgrIsTherapist ? '#fff' : c.muted} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: mgrIsTherapist ? '#fff' : c.text, fontWeight: '700', fontSize: 15 }}>Ja, ich bin auch Therapeut/in</Text>
                <Text style={{ color: mgrIsTherapist ? 'rgba(255,255,255,0.8)' : c.muted, fontSize: 13, marginTop: 2 }}>Ich behandle selbst und verwalte die Praxis</Text>
              </View>
            </Pressable>
          </>
        );
      }
      if (mgrIsTherapist && mgrRegStep === 4) {
        return (
          <>
            <Text style={[styles.regStepTitle, { color: c.text }]}>Therapeuten-Profil</Text>
            <Text style={[styles.regStepSub, { color: c.muted }]}>Deine Angaben als Therapeut/in</Text>
            <TextInput value={mgrFullName} onChangeText={setMgrFullName} placeholder="Vollständiger Name *" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            <TextInput value={mgrProfTitle} onChangeText={setMgrProfTitle} placeholder="Berufsbezeichnung * (z. B. Physiotherapeut/in)" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            <View style={{ backgroundColor: c.mutedBg, borderRadius: 10, padding: 12, marginTop: 4 }}>
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>Dein Profil wird erst veröffentlicht, wenn du es selbst freigibst.</Text>
            </View>
          </>
        );
      }
      // Summary step
      return (
        <>
          <Text style={[styles.regStepTitle, { color: c.text }]}>Übersicht</Text>
          <Text style={[styles.regStepSub, { color: c.muted }]}>Bitte überprüfe deine Angaben</Text>
          <View style={{ backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.muted, fontSize: 13 }}>E-Mail</Text>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{mgrEmail}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.muted, fontSize: 13 }}>Praxisname</Text>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{mgrPracticeName}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.muted, fontSize: 13 }}>Stadt</Text>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{mgrPracticeCity}</Text>
            </View>
            {!!mgrPracticeAddress && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.muted, fontSize: 13 }}>Adresse</Text>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }}>{mgrPracticeAddress}</Text>
              </View>
            )}
            {!!mgrPracticePhone && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.muted, fontSize: 13 }}>Telefon</Text>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{mgrPracticePhone}</Text>
              </View>
            )}
            <View style={{ height: 1, backgroundColor: c.border }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.muted, fontSize: 13 }}>Rolle</Text>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{mgrIsTherapist ? 'Praxismanager + Therapeut/in' : 'Nur Praxismanager'}</Text>
            </View>
            {mgrIsTherapist && !!mgrFullName && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.muted, fontSize: 13 }}>Name</Text>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{mgrFullName}</Text>
              </View>
            )}
            {mgrIsTherapist && !!mgrProfTitle && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.muted, fontSize: 13 }}>Berufsbezeichnung</Text>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }}>{mgrProfTitle}</Text>
              </View>
            )}
          </View>
          {!!mgrRegError && (
            <View style={{ backgroundColor: '#FDECEA', borderRadius: 10, borderWidth: 1, borderColor: '#E74C3C', padding: 12, marginTop: 8 }}>
              <Text style={{ color: '#E74C3C', fontSize: 13 }}>{mgrRegError}</Text>
            </View>
          )}
        </>
      );
    };

    const advanceStep = () => {
      // Skip step 4 (therapist profile) if not a therapist
      if (mgrRegStep === 3 && !mgrIsTherapist) {
        setMgrRegStep(4); // jump to summary (which is step 4 when !mgrIsTherapist)
      } else {
        setMgrRegStep(s => s + 1);
      }
    };

    const goBack = () => {
      if (mgrRegStep === 1) {
        setShowManagerReg(false);
        setShowLogin(true);
        return;
      }
      // If on summary step and not therapist, skip back over step 4
      if (!mgrIsTherapist && mgrRegStep === 4) {
        setMgrRegStep(3);
      } else {
        setMgrRegStep(s => s - 1);
      }
    };

    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
        </Pressable>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>Praxis registrieren</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>Schritt {mgrRegStep} von {MGR_REG_STEPS}</Text>
          </View>
        </View>
        {renderProgress()}
        <View style={{ gap: 12, marginTop: 8 }}>
          {renderStepContent()}
        </View>
        {isSummaryStep ? (
          <Pressable
            style={[styles.registerBtn, { backgroundColor: mgrRegLoading ? c.border : c.primary, marginTop: 20 }]}
            onPress={handleManagerRegSubmit}
            disabled={mgrRegLoading}
          >
            <Text style={styles.registerBtnText}>{mgrRegLoading ? 'Registrieren…' : 'Registrieren'}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.registerBtn, { backgroundColor: mgrRegCanProceed() ? c.primary : c.border, marginTop: 20 }]}
            onPress={advanceStep}
            disabled={!mgrRegCanProceed()}
          >
            <Text style={styles.registerBtnText}>Weiter</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  };

  // ── Manager Dashboard ──────────────────────────────────────────────────────

  const handleTherapistSearch = async (query) => {
    setAddTherapistQuery(query);
    if (query.trim().length < 2) { setAddTherapistResults([]); return; }
    setAddTherapistLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/manager/therapists/search?q=${encodeURIComponent(query)}&practiceId=${activePracticeId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAddTherapistResults(data.therapists ?? []);
      }
    } catch (_) {}
    finally { setAddTherapistLoading(false); }
  };

  const handleAddTherapist = async (therapistId) => {
    setAddingTherapistId(therapistId);
    try {
      const res = await fetch(`${getBaseUrl()}/manager/practice/therapists`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ therapistId, practiceId: activePracticeId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Hinzufügen fehlgeschlagen');
      }
      const meRes = await fetch(`${getBaseUrl()}/manager/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (meRes.ok) setLoggedInManager(await meRes.json());
      setShowAddTherapistForm(false);
      setAddTherapistQuery('');
      setAddTherapistResults([]);
    } catch (e) {
      Alert.alert('Fehler', e.message);
    } finally {
      setAddingTherapistId(null);
    }
  };

  const handleRemoveTherapist = async (therapistId, therapistName) => {
    const doRemove = async () => {
      setRemovingTherapistId(therapistId);
      try {
        const res = await fetch(`${getBaseUrl()}/manager/practice/therapists/${therapistId}?practiceId=${activePracticeId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? 'Entfernen fehlgeschlagen');
        }
        const data = await res.json();
        const meRes = await fetch(`${getBaseUrl()}/manager/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (meRes.ok) setLoggedInManager(await meRes.json());
        if (data.visibilityChanged) {
          Alert.alert('Hinweis', `${therapistName} wurde entfernt. Das Therapeuten-Profil ist jetzt nicht mehr öffentlich sichtbar, da keine aktive Praxis mehr verknüpft ist.`);
        }
      } catch (e) {
        Alert.alert('Fehler', e.message);
      } finally {
        setRemovingTherapistId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (showWebConfirm(`${therapistName} aus der Praxis entfernen?\n\nDas Therapeuten-Konto wird nicht gelöscht. Falls dies die letzte aktive Praxis ist, wird das Profil automatisch unsichtbar.`)) {
        doRemove();
      }
    } else {
      Alert.alert(
        'Therapeut entfernen',
        `Möchtest du ${therapistName} aus der Praxis entfernen?\n\nDas Therapeuten-Konto bleibt erhalten. Falls dies die letzte aktive Praxis ist, wird das Profil automatisch nicht mehr öffentlich sichtbar.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Entfernen', style: 'destructive', onPress: doRemove },
        ]
      );
    }
  };

  const handleManagerLogout = async () => {
    if (authToken) {
      await fetch(`${getBaseUrl()}/manager/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }
    await AsyncStorage.removeItem('revio_auth_token');
    await AsyncStorage.removeItem('revio_account_type');
    setAuthToken(null);
    setLoggedInManager(null);
    setAccountType(null);
  };

  const handleManagerPracticeSave = async () => {
    setMgrEditSaving(true);
    try {
      const body = { practiceId: activePracticeId };
      if (mgrEditName.trim()) body.name = mgrEditName.trim();
      if (mgrEditCity.trim()) body.city = mgrEditCity.trim();
      if (mgrEditAddress.trim()) body.address = mgrEditAddress.trim();
      if (mgrEditPhone.trim()) body.phone = mgrEditPhone.trim();
      if (mgrEditHours.trim()) body.hours = mgrEditHours.trim();
      if (mgrEditDescription.trim()) body.description = mgrEditDescription.trim();
      body.homeVisit = mgrEditHomeVisit;
      body.logo = mgrEditLogo || null;
      body.photos = mgrEditPhotos.length > 0 ? JSON.stringify(mgrEditPhotos) : null;
      const res = await fetch(`${getBaseUrl()}/manager/practice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const meRes = await fetch(`${getBaseUrl()}/manager/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (meRes.ok) setLoggedInManager(await meRes.json());
        setMgrEditMode(false);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Speichern fehlgeschlagen.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    } finally {
      setMgrEditSaving(false);
    }
  };

  const handleManagerProfileSave = async () => {
    setMgrProfileSaving(true);
    try {
      const body = {
        fullName: mgrProfileFullName.trim(),
        professionalTitle: mgrProfileTitle.trim(),
        bio: mgrProfileBio.trim(),
        specializations: mgrProfileSpecializations.split(',').map(s => s.trim()).filter(Boolean),
        languages: mgrProfileLanguages.split(',').map(s => s.trim()).filter(Boolean),
        isVisible: mgrProfileIsVisible,
      };
      const res = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Speichern fehlgeschlagen.');
        return;
      }
      const meRes = await fetch(`${getBaseUrl()}/manager/me`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (meRes.ok) setLoggedInManager(await meRes.json());
      setMgrProfileEditMode(false);
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    } finally {
      setMgrProfileSaving(false);
    }
  };

  const handleManagerProfilePublication = async (visibilityPreference) => {
    setMgrProfilePublishLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/invite/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ visibilityPreference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Fehler', data.message ?? 'Veröffentlichung fehlgeschlagen.');
        return;
      }
      const meRes = await fetch(`${getBaseUrl()}/manager/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (meRes.ok) setLoggedInManager(await meRes.json());

      if (visibilityPreference === 'visible' && !data.isPublished) {
        const missing = formatMissingProfileFields(data.missingFields);
        Alert.alert(
          'Profil noch nicht öffentlich',
          missing.length > 0
            ? `Bitte ergänze zuerst: ${missing.join(', ')}.`
            : 'Bitte vervollständige dein Profil vor der Veröffentlichung.'
        );
        return;
      }

      Alert.alert(
        visibilityPreference === 'visible' ? 'Profil veröffentlicht' : 'Profil verborgen',
        visibilityPreference === 'visible'
          ? 'Dein Therapeuten-Profil ist jetzt öffentlich sichtbar.'
          : 'Dein Therapeuten-Profil ist nicht mehr öffentlich sichtbar.'
      );
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    } finally {
      setMgrProfilePublishLoading(false);
    }
  };

  const handleAddNewPractice = async () => {
    if (!mgrNewPracticeName.trim() || !mgrNewPracticeCity.trim()) {
      Alert.alert('Fehler', 'Praxisname und Stadt sind erforderlich.');
      return;
    }
    setMgrNewPracticeLoading(true);
    try {
      const body = { practiceName: mgrNewPracticeName.trim(), practiceCity: mgrNewPracticeCity.trim() };
      if (mgrNewPracticeAddress.trim()) body.practiceAddress = mgrNewPracticeAddress.trim();
      if (mgrNewPracticePhone.trim()) body.practicePhone = mgrNewPracticePhone.trim();
      const res = await fetch(`${getBaseUrl()}/manager/practices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Erstellen fehlgeschlagen');
      }
      const { practiceId } = await res.json();
      const meRes = await fetch(`${getBaseUrl()}/manager/me`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (meRes.ok) setLoggedInManager(await meRes.json());
      setActivePracticeId(practiceId);
      setShowAddPracticeForm(false);
      setMgrNewPracticeName(''); setMgrNewPracticeCity('');
      setMgrNewPracticeAddress(''); setMgrNewPracticePhone('');
    } catch (e) {
      Alert.alert('Fehler', e.message);
    } finally {
      setMgrNewPracticeLoading(false);
    }
  };

  const handlePickManagerPracticeLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Kein Zugriff', 'Bitte Fotobibliothek erlauben.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setMgrEditLogo(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleAddManagerPracticePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Kein Zugriff', 'Bitte Fotobibliothek erlauben.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setMgrEditPhotos(prev => [...prev, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const renderManagerDashboard = () => {
    return (
      <ManagerDashboardContent
        activePracticeId={activePracticeId}
        c={c}
        handleAddManagerPracticePhoto={handleAddManagerPracticePhoto}
        handleAddNewPractice={handleAddNewPractice}
        handleManagerPracticeSave={handleManagerPracticeSave}
        handleManagerProfilePublication={handleManagerProfilePublication}
        handleManagerProfileSave={handleManagerProfileSave}
        handlePickManagerPracticeLogo={handlePickManagerPracticeLogo}
        handleDeleteManagerPractice={handleDeleteManagerPractice}
        handleRemoveTherapist={handleRemoveTherapist}
        loggedInManager={loggedInManager}
        mgrEditAddress={mgrEditAddress}
        mgrEditCity={mgrEditCity}
        mgrEditDescription={mgrEditDescription}
        mgrEditHomeVisit={mgrEditHomeVisit}
        mgrEditHours={mgrEditHours}
        mgrEditLogo={mgrEditLogo}
        mgrEditMode={mgrEditMode}
        mgrEditName={mgrEditName}
        mgrEditPhone={mgrEditPhone}
        mgrEditPhotos={mgrEditPhotos}
        mgrEditSaving={mgrEditSaving}
        mgrNewPracticeAddress={mgrNewPracticeAddress}
        mgrNewPracticeCity={mgrNewPracticeCity}
        mgrNewPracticeLoading={mgrNewPracticeLoading}
        mgrNewPracticeName={mgrNewPracticeName}
        mgrNewPracticePhone={mgrNewPracticePhone}
        mgrProfileBio={mgrProfileBio}
        mgrProfileEditMode={mgrProfileEditMode}
        mgrProfileFullName={mgrProfileFullName}
        mgrProfileIsVisible={mgrProfileIsVisible}
        mgrProfileLanguages={mgrProfileLanguages}
        mgrProfilePublishLoading={mgrProfilePublishLoading}
        mgrProfileSaving={mgrProfileSaving}
        mgrProfileSpecializations={mgrProfileSpecializations}
        mgrProfileTitle={mgrProfileTitle}
        removingTherapistId={removingTherapistId}
        setActivePracticeId={setActivePracticeId}
        setInvitePageTab={setInvitePageTab}
        setInviteToken={setInviteToken}
        setMgrEditAddress={setMgrEditAddress}
        setMgrEditCity={setMgrEditCity}
        setMgrEditDescription={setMgrEditDescription}
        setMgrEditHomeVisit={setMgrEditHomeVisit}
        setMgrEditHours={setMgrEditHours}
        setMgrEditLogo={setMgrEditLogo}
        setMgrEditMode={setMgrEditMode}
        setMgrEditName={setMgrEditName}
        setMgrEditPhone={setMgrEditPhone}
        setMgrEditPhotos={setMgrEditPhotos}
        setMgrNewPracticeAddress={setMgrNewPracticeAddress}
        setMgrNewPracticeCity={setMgrNewPracticeCity}
        setMgrNewPracticeName={setMgrNewPracticeName}
        setMgrNewPracticePhone={setMgrNewPracticePhone}
        setMgrProfileBio={setMgrProfileBio}
        setMgrProfileEditMode={setMgrProfileEditMode}
        setMgrProfileFullName={setMgrProfileFullName}
        setMgrProfileIsVisible={setMgrProfileIsVisible}
        setMgrProfileLanguages={setMgrProfileLanguages}
        setMgrProfileSpecializations={setMgrProfileSpecializations}
        setMgrProfileTitle={setMgrProfileTitle}
        setShowAddPracticeForm={setShowAddPracticeForm}
        setShowInvitePage={setShowInvitePage}
        showAddPracticeForm={showAddPracticeForm}
        styles={styles}
      />
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  const renderTab = () => {
    if (selectedTherapist) return renderTherapistProfile(selectedTherapist);
    if (selectedPractice) return renderPracticeProfile(selectedPractice);
    if (showCreatePractice) return renderCreatePractice();
    if (showPracticeSearch) return renderPracticeSearch();
    if (showInvitePage) return renderInvitePage();
    if (showPracticeAdmin) return renderPracticeAdmin();
    if (activeTab === 'favorites') return renderFavorites();
    if (activeTab === 'therapist') {
      if (accountType === 'manager' && loggedInManager) return renderManagerDashboard();
      if (showInviteClaim) return renderInviteClaimScreen();
      if (loggedInTherapist) return renderTherapistDashboard();
      if (showLogin) return renderLogin();
      if (showRegister) return renderRegister();
      return renderTherapist();
    }
    if (activeTab === 'options') return renderOptions();
    return renderDiscover();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      {/* ── Practice Deletion Flow ───────────────────────────────────────────── */}
      <Modal visible={deletionFlowStep === 'reason'} transparent animationType="slide" onRequestClose={() => setDeletionFlowStep(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setDeletionFlowStep(null)} />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 48 }}>
          <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 6 }}>Warum möchtest du die Praxis löschen?</Text>
          <Text style={{ fontSize: 14, color: c.muted, marginBottom: 20 }}>Dein Feedback hilft uns, Revio zu verbessern.</Text>
          {DELETION_REASONS.map((reason) => (
            <Pressable
              key={reason}
              onPress={() => setDeletionReason(reason)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: deletionReason === reason ? c.primary : c.border, backgroundColor: deletionReason === reason ? c.primary : 'transparent', marginRight: 12 }} />
              <Text style={{ fontSize: 15, color: c.text }}>{reason}</Text>
            </Pressable>
          ))}
          {deletionReason === 'Sonstiges' && (
            <TextInput
              placeholder="Kurze Beschreibung (optional)"
              placeholderTextColor={c.muted}
              value={deletionReasonDetail}
              onChangeText={setDeletionReasonDetail}
              style={{ marginTop: 12, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, color: c.text, fontSize: 14 }}
              multiline
            />
          )}
          <Pressable
            onPress={() => deletionReason ? setDeletionFlowStep('confirm') : null}
            style={{ marginTop: 20, backgroundColor: deletionReason ? '#ef4444' : c.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Weiter</Text>
          </Pressable>
          <Pressable onPress={() => setDeletionFlowStep(null)} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>Abbrechen</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={deletionFlowStep === 'confirm'} transparent animationType="slide" onRequestClose={() => setDeletionFlowStep('reason')}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setDeletionFlowStep('reason')} />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 48 }}>
          <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
          <View style={{ backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#dc2626', marginBottom: 6 }}>Diese Aktion kann nicht rückgängig gemacht werden.</Text>
            <Text style={{ fontSize: 14, color: '#7f1d1d' }}>
              {`„${loggedInTherapist?.adminPractice?.name ?? 'Diese Praxis'}" wird dauerhaft gelöscht. Alle verknüpften Therapeuten werden getrennt und verlieren ihre Praxis-Zuordnung.`}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: c.muted, marginBottom: 20 }}>
            {`Grund: ${deletionReason}${deletionReason === 'Sonstiges' && deletionReasonDetail ? ` – ${deletionReasonDetail}` : ''}`}
          </Text>
          <Pressable
            onPress={deletionLoading ? undefined : deletePracticeConfirmed}
            style={{ backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: deletionLoading ? 0.6 : 1 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              {deletionLoading ? 'Wird gelöscht…' : 'Praxis endgültig löschen'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setDeletionFlowStep('reason')} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>Zurück</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Notification Sheet ──────────────────────────────────────────────── */}
      <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowNotifications(false)} />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, minHeight: 200 }}>
          <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 16 }}>Benachrichtigungen</Text>
          {notifications.length === 0 ? (
            <Text style={{ color: c.muted, textAlign: 'center', marginTop: 24 }}>Keine neuen Benachrichtigungen</Text>
          ) : (
            notifications.map((n) => (
              <View key={n.id} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#E74C3C', marginTop: 5 }} />
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

      {/* ── Visibility Modal ───────────────────────────────────────────────── */}
      <Modal visible={showVisibilityModal} transparent animationType="fade" onRequestClose={() => setShowVisibilityModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={() => setShowVisibilityModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>Profil sichtbar machen?</Text>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
                Soll dein Profil öffentlich sichtbar sein? Du kannst das jederzeit ändern.
              </Text>
              <Pressable
                style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: visibilityLoading ? 0.6 : 1 }}
                onPress={() => handleVisibilityChoice('visible')}
                disabled={visibilityLoading}
              >
                <Ionicons name="eye-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Sichtbar</Text>
              </Pressable>
              <Pressable
                style={{ backgroundColor: c.mutedBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: c.border, opacity: visibilityLoading ? 0.6 : 1 }}
                onPress={() => handleVisibilityChoice('hidden')}
                disabled={visibilityLoading}
              >
                <Ionicons name="eye-off-outline" size={20} color={c.text} />
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>Versteckt</Text>
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
                placeholder="z.B. Hauptstraße 5, München"
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
                    <Ionicons name="navigate-sharp" size={14} color="#2b6877" />
                    <Text style={{ flex: 1, color: c.text, fontSize: 14 }} numberOfLines={2}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
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
                setShowCreatePractice(false);
                setShowPracticeSearch(false);
                setShowPracticeAdmin(false);
                setShowInvitePage(false);
                if (tab.key !== 'therapist') {
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
              <View style={[styles.navPill, active && { backgroundColor: c.primary }]}>
                <Text style={[styles.navIcon, { color: active ? '#FFFFFF' : c.muted }]}>
                  {tab.icon}
                </Text>
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
  scrollContent: { padding: 20, gap: 14 },

  // Hero
  hero: { paddingTop: 8, paddingBottom: 4, gap: 8 },
  heroTitle: { fontSize: 28, fontWeight: '800', lineHeight: 36 },
  heroSub: { fontSize: 15, lineHeight: 22 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 4 },
  logoMark: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  brandName: { fontSize: 24, fontWeight: '700', letterSpacing: 3, marginLeft: 4 },
  logoContainer: { backgroundColor: '#506d7a', padding: 10, borderRadius: 12 },
  logoImage: { width: 80, height: 80, resizeMode: 'contain' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 1 },

  // Search box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 0,
    height: 52,
    gap: 10,
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.06)',
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 16 },
  searchDivider: { width: 1, height: 24, opacity: 0.5 },
  searchFilterArea: { paddingHorizontal: 12, paddingVertical: 14, position: 'relative' },

  // Autocomplete
  autocompleteBox: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -4,
    paddingTop: 4,
    overflow: 'hidden'
  },
  acItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  acSearchIcon: { fontSize: 14 },
  acItemText: { fontSize: 15 },

  // Chips
  chipsRow: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: '500' },

  // Filter row
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cityInput: {
    flex: 1, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15
  },
  filterBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  filterBtnText: { fontSize: 14, fontWeight: '600' },
  goBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  goBtnText: { fontSize: 18, fontWeight: '700', color: '#1B1F23' },

  // Filter panel
  filterPanel: { borderWidth: 1, borderRadius: 16, padding: 16 },
  filterSectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  kassenartRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kassenartBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  kassenartText: { fontSize: 13, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  checkLabel: { fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  switchTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  switchLabel: { fontSize: 13, lineHeight: 18 },

  // Section row
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 16, fontWeight: '700' },
  approvedPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  approvedPillText: { fontSize: 12, fontWeight: '600' },
  metaPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  metaPillText: { fontSize: 12, fontWeight: '600' },

  // Result cards
  resultCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  cardName: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  cardTitle: { fontSize: 13 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 13, fontWeight: '500' },
  practiceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 10
  },
  practiceInitial: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center'
  },
  practiceInitialText: { fontSize: 16, fontWeight: '700' },
  practiceName: { fontSize: 14, fontWeight: '600' },
  practiceCity: { fontSize: 12, marginTop: 1 },
  practiceArrow: { fontSize: 18 },
  filterIconBtn: {
    width: 48, height: 48, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center'
  },
  filterIconText: { fontSize: 20 },
  filterBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center'
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  distBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6 },
  distBadgeText: { fontSize: 12, fontWeight: '700' },

  // Practice profile screen
  backBtn: { paddingVertical: 4 },
  backBtnText: { fontSize: 16, fontWeight: '600' },
  practiceHeader: { borderWidth: 1, borderRadius: 20, padding: 20, alignItems: 'center', gap: 6 },
  practiceLogoLarge: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4
  },
  practiceLogoText: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  practiceLogoCross: { position: 'absolute', top: 8, right: 8, width: 18, height: 18 },
  plusBarH: { position: 'absolute', top: '38%', left: 0, right: 0, height: 5, borderRadius: 3 },
  plusBarV: { position: 'absolute', left: '38%', top: 0, bottom: 0, width: 5, borderRadius: 3 },
  practiceHeaderName: { fontSize: 20, fontWeight: '700' },
  practiceHeaderCity: { fontSize: 14 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12
  },
  detailIcon: { fontSize: 18 },
  detailText: { fontSize: 14, flex: 1, lineHeight: 20 },
  miniCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderRadius: 16, padding: 14
  },
  miniAvatar: { width: 44, height: 44, borderRadius: 22 },

  ctaBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: '#1B1F23' },
  ctaBtnSecondary: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  ctaBtnSecondaryText: { fontSize: 15, fontWeight: '700' },

  // Empty state
  emptyState: { borderWidth: 1, borderRadius: 20, padding: 32, alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  emptyActionBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  emptyActionText: { fontSize: 13, fontWeight: '700' },
  emptyInlineState: { borderWidth: 1, borderRadius: 16, padding: 14, marginHorizontal: 16, marginTop: 8 },

  // Therapist tab
  noticeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderRadius: 16, padding: 14,
    width: '100%'
  },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F9FA',
    marginTop: 1,
  },
  noticeIcon: { fontSize: 20, marginTop: 1, width: 24, textAlign: 'center' },
  noticeTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  noticeBody: { fontSize: 13, lineHeight: 18, flex: 1, flexShrink: 1 },
  infoCard: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 8 },
  infoTitle: { fontSize: 20, fontWeight: '700' },
  infoBody: { fontSize: 15, lineHeight: 22 },
  stepRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderBottomWidth: 1, paddingBottom: 14
  },
  stepNum: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  stepTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  stepBody: { fontSize: 13, lineHeight: 18 },
  registerBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  registerBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  loginLink: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingVertical: 12 },

  // Options rows
  optionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14
  },
  optionLabel: { fontSize: 15, fontWeight: '500' },
  optionValue: { fontSize: 14 },

  // Therapist profile
  therapistAvatarLarge: { width: 80, height: 80, borderRadius: 40, marginBottom: 4 },
  therapistAvatarSmall: { width: 40, height: 40 },
  practiceHeaderInitial: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  practiceHeaderInitialText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  infoSection: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  verifiedBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { fontSize: 12, fontWeight: '700' },
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailInfoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailInfoValue: { fontSize: 14, marginTop: 1 },

  // Theme toggle
  themeToggleRow: { flexDirection: 'row', gap: 6 },
  themeBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  themeBtnText: { fontSize: 13, fontWeight: '600' },

  // Bottom nav
  navbar: {
    borderTopWidth: 1, flexDirection: 'row',
    justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: 8
  },
  navItem: { alignItems: 'center', gap: 4, flex: 1, paddingVertical: 4 },
  navPill: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 6 },
  navIcon: { fontSize: 18, fontWeight: '700' },
  navLabel: { fontSize: 11, fontWeight: '600' },

  // Registration stepper
  regProgressRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  regProgressBar: { height: 4, borderRadius: 2, flex: 1 },
  regStepTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  regStepSub: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  regInput: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15
  },
  regTextarea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },

  // Preview step
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 1, gap: 12
  },
  previewLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  previewValue: { fontSize: 13, flex: 2, textAlign: 'right' }
});
