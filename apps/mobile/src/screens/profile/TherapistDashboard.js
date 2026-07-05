import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Modal,
  ScrollView,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import {
  getLangLabel,
  languageOptions,
  RADIUS,
  resolveMediaUrl,
  SPACE,
  TYPE,
  getBaseUrl,
  TUNNEL_HEADERS,
  normalizeKassenarten,
  normalizeTherapistProfile,
  normalizeLanguageCodes,
  deleteAccountRequest,
} from '../../utils/app-utils';
import {
  ComplianceStatusStep,
  getComplianceStatusLabel,
} from '../../components/ComplianceStatusStep';
import { ProfileChecklist } from '../../components/ProfileChecklist';
import { ProfileCompletionWizard } from '../../components/ProfileCompletionWizard';
import { DeleteAccountModal } from '../../modals/DeleteAccountModal';
import { useAuth } from '../../context/AuthContext';
import { TherapistServicesScreen } from '../therapy/TherapistServicesScreen';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

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

function normalizeComplianceValue(value, allowedValues) {
  return allowedValues.includes(value) ? value : null;
}

const COMPLIANCE_STATUS_VALUES = ['yes', 'no', 'in_progress'];
const HEALTH_AUTHORITY_STATUS_VALUES = ['yes', 'no', 'in_progress', 'unknown'];

function normalizeComplianceDraft(value) {
  return {
    taxRegistrationStatus: normalizeComplianceValue(value?.taxRegistrationStatus, COMPLIANCE_STATUS_VALUES),
    healthAuthorityStatus: normalizeComplianceValue(value?.healthAuthorityStatus, HEALTH_AUTHORITY_STATUS_VALUES),
  };
}

function parseComplianceDraft(rawValue) {
  if (!rawValue) return normalizeComplianceDraft(null);
  try { return normalizeComplianceDraft(JSON.parse(rawValue)); }
  catch { return normalizeComplianceDraft(null); }
}

function normalizeGenderValue(value) {
  if (value === 'female' || value === 'male') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized.startsWith('f')) return 'female';
  if (normalized.startsWith('m')) return 'male';
  return null;
}


function StatusMiniCard({ icon, label, value, color, c }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '45%',
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: RADIUS.md,
        padding: SPACE.md,
        gap: SPACE.xs,
        backgroundColor: c.card,
      }}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={{ ...TYPE.label, color: c.textMuted ?? c.muted }}>{label}</Text>
      <Text style={{ ...TYPE.meta, color, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

export function TherapistDashboardScreen({ c, t, styles, certificationOptions, specializationOptions, heilmittelOptions, onOpenTherapyTab, onAddSlot, onProfileSaved, onAccountDeleted }) {
  const { authToken, loggedInTherapist, setLoggedInTherapist } = useAuth();

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editHouseNumber, setEditHouseNumber] = useState('');
  const [editLocationPrecision, setEditLocationPrecision] = useState('approximate');
  const [editSpecializations, setEditSpecializations] = useState('');
  const [editLanguages, setEditLanguages] = useState([]);
  const [editHomeVisit, setEditHomeVisit] = useState(false);
  const [editServiceRadius, setEditServiceRadius] = useState(null);
  const [editKassenarten, setEditKassenarten] = useState([]);
  const [editGender, setEditGender] = useState(null);
  const [editIsVisible, setEditIsVisible] = useState(true);
  const [editBookingMode, setEditBookingMode] = useState('DIRECTORY_ONLY');
  const [editAvailability, setEditAvailability] = useState('');
  const [editTaxRegistrationStatus, setEditTaxRegistrationStatus] = useState(null);
  const [editHealthAuthorityStatus, setEditHealthAuthorityStatus] = useState(null);
  const [editCertifications, setEditCertifications] = useState([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [showServicesScreen, setShowServicesScreen] = useState(false);
  const [therapistDocuments, setTherapistDocuments] = useState([]);
  const [documentUploading, setDocumentUploading] = useState(false);

  const [photoError, setPhotoError] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Load documents on mount / token change
  useEffect(() => {
    if (!authToken) { setTherapistDocuments([]); return; }
    fetch(`${getBaseUrl()}/auth/documents`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : [])
      .then(docs => setTherapistDocuments(Array.isArray(docs) ? docs : []))
      .catch(() => {});
  }, [authToken]);

  useEffect(() => {
    if (loggedInTherapist?.reviewStatus === 'APPROVED') {
      setShowWizard(false);
    }
  }, [loggedInTherapist?.reviewStatus]);

  const enterEdit = async () => {
    const th = loggedInTherapist;
    if (!th) return;
    const draft = th.id
      ? parseComplianceDraft(await AsyncStorage.getItem(getTherapistComplianceDraftKey(th.id)))
      : normalizeComplianceDraft(null);
    const nextCompliance = draft.taxRegistrationStatus || draft.healthAuthorityStatus
      ? draft : normalizeComplianceDraft(th?.compliance);
    setEditBio(th.bio ?? '');
    setEditPhone(th.phone ?? '');
    setEditCity(th.city ?? '');
    setEditPostalCode(th.postalCode ?? '');
    setEditStreet(th.street ?? '');
    setEditHouseNumber(th.houseNumber ?? '');
    setEditLocationPrecision(th.locationPrecision ?? 'approximate');
    setEditSpecializations((th.specializations ?? []).join(', '));
    setEditLanguages(normalizeLanguageCodes(th.languages));
    setEditHomeVisit(th.homeVisit ?? false);
    setEditServiceRadius(th.serviceRadiusKm ?? null);
    setEditKassenarten(normalizeKassenarten(th.kassenarten ?? th.kassenart));
    setEditGender(normalizeGenderValue(th.gender));
    setEditIsVisible(th.isVisible ?? true);
    setEditBookingMode(th.bookingMode ?? 'DIRECTORY_ONLY');
    setEditAvailability(th.availability ?? '');
    setEditTaxRegistrationStatus(nextCompliance.taxRegistrationStatus);
    setEditHealthAuthorityStatus(nextCompliance.healthAuthorityStatus);
    setEditCertifications(Array.isArray(th.certifications) ? th.certifications : []);
    setEditMode(true);
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
      const patchBody = {
        bio: editBio, phone: editPhone.trim() || null,
        specializations: editSpecializations.split(',').map(s => s.trim()).filter(Boolean),
        languages: editLanguages.map(l => l.toLowerCase()),
        certifications: editCertifications,
        homeVisit: editHomeVisit,
        serviceRadiusKm: editHomeVisit ? (editServiceRadius ?? null) : null,
        kassenarten: editKassenarten, gender: editGender,
        isVisible: editIsVisible, availability: editAvailability,
        bookingMode: editBookingMode,
        city: editCity.trim() || undefined, postalCode: editPostalCode.trim() || null,
        street: editStreet.trim() || null, houseNumber: editHouseNumber.trim() || null,
        locationPrecision: editLocationPrecision,
      };
      const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(patchBody),
      });
      const profileData = await profileRes.json().catch(() => ({}));
      const complianceRes = await fetch(`${getBaseUrl()}/auth/me/compliance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(compliancePayload),
      });
      const complianceData = await complianceRes.json().catch(() => ({}));
      if (complianceRes.ok) await AsyncStorage.removeItem(complianceDraftKey);
      if (profileRes.ok || complianceRes.ok) {
        const refreshRes = await fetch(`${getBaseUrl()}/auth/me`, { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` } });
        if (refreshRes.ok) setLoggedInTherapist(normalizeTherapistProfile(await refreshRes.json()));
      }
      if (profileRes.ok && complianceRes.ok) {
        setEditMode(false);
        onProfileSaved(t('profileSavedModalTitle'), t('profileSavedModalBody'));
      } else if (profileRes.ok) {
        setEditMode(false);
        onProfileSaved(t('alertHint'), t('profileSavedCompliancePendingBody'));
      } else if (complianceRes.ok) {
        setEditMode(false);
        onProfileSaved(t('alertHint'), profileData.message ?? t('complianceOnlySavedBody'));
      } else {
        Alert.alert(t('alertError'), profileData.message ?? complianceData.message ?? t('alertProfileSaveFail'));
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
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    try {
      const formData = new FormData();
      formData.append('photo', { uri: asset.uri, name: asset.uri.split('/').pop() || 'photo.jpg', type: asset.mimeType || 'image/jpeg' });
      const uploadRes = await fetch(`${getBaseUrl()}/upload/photo`, {
        method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData,
      });
      if (uploadRes.ok) {
        const { url } = await uploadRes.json();
        setLoggedInTherapist(prev => ({ ...prev, photo: url }));
        await refreshProfile();
        Alert.alert(t('alertSuccess'), t('alertAvatarSaved'));
      } else {
        Alert.alert(t('alertError'), `${t('alertPhotoUploadFail')} (${uploadRes.status})`);
      }
    } catch { Alert.alert(t('alertConnectionError'), t('alertConnectionErrorBody')); }
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
      formData.append('document', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' });
      setDocumentUploading(true);
      const res = await fetch(`${getBaseUrl()}/upload/document`, {
        method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData,
      });
      if (res.ok) {
        const { id, originalName } = await res.json();
        setTherapistDocuments(prev => [{ id, originalName, mimetype: asset.mimeType }, ...prev]);
        await refreshProfile();
        Alert.alert(t('alertUploaded'), t('alertUploadedBody').replace('{name}', originalName));
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert(t('alertError'), errData.message ?? t('alertDocUploadFail'));
      }
    } catch { Alert.alert(t('alertConnectionError'), t('alertConnectionErrorBody')); }
    finally { setDocumentUploading(false); }
  };

  const refreshProfile = async () => {
    try {
      const refreshRes = await fetch(`${getBaseUrl()}/auth/me`, { headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` } });
      if (refreshRes.ok) {
        const next = normalizeTherapistProfile(await refreshRes.json());
        setLoggedInTherapist(next);
        return next;
      }
    } catch {}
    return null;
  };

  const handleProfileSubmittedForReview = async () => {
    await refreshProfile();
    onProfileSaved(t('alertHint') ?? 'Eingereicht', 'Dein Profil wurde zur Prüfung eingereicht.');
  };

  const handleDeleteAccountConfirmed = async () => {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      const result = await deleteAccountRequest(authToken);
      if (!result.ok) {
        Alert.alert('Konto konnte nicht gelöscht werden', result.message);
        return;
      }
      onAccountDeleted?.();
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const th = loggedInTherapist;
  if (!th) return null;
  const fullName = typeof th.fullName === 'string' && th.fullName.trim() ? th.fullName.trim() : 'Profil';
  const initials = fullName.split(/\s+/).map((name) => name[0]).join('').slice(0, 2).toUpperCase();
  const isApproved = th.reviewStatus === 'APPROVED';
  const docCount = (therapistDocuments ?? []).length;
  const docTotal = 1;
  const canActivateBookingRequests = th.reviewStatus === 'APPROVED';

  const statusChips = [
    { icon: 'shield-checkmark-outline', label: isApproved ? t('statusApproved') : t('statusInReview'), color: isApproved ? c.success : c.muted },
    { icon: 'eye-outline', label: `Sichtbar: ${th.isVisible ? 'Ja' : 'Nein'}`, color: th.isVisible ? c.success : c.muted },
    ...(th.homeVisit ? [{ icon: 'home-outline', label: t('homeVisitLabel'), color: c.success }] : []),
    { icon: 'document-outline', label: docCount > 0 ? t('existsLabel') : t('missingLabel'), color: docCount > 0 ? c.success : c.warning ?? '#d97706' },
  ];

  if (showServicesScreen) {
    return <TherapistServicesScreen c={c} authToken={authToken} onBack={() => setShowServicesScreen(false)} />;
  }

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40, paddingTop: 12 }]}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
          <Pressable onPress={handlePickPhoto} style={{ position: 'relative' }}>
            {th.photo && !photoError ? (
              <Image source={{ uri: th.photo }} style={{ width: 72, height: 72, borderRadius: 36 }} onError={() => setPhotoError(true)} />
            ) : (
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>{initials}</Text>
              </View>
            )}
            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: c.accent ?? c.primary, borderRadius: 10, padding: 3 }}>
              <Ionicons name="camera-outline" size={12} color="#fff" />
            </View>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{fullName}</Text>
            <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{th.professionalTitle ?? ''}</Text>
          </View>

          <Pressable
            onPress={editMode ? () => setEditMode(false) : enterEdit}
            style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
            hitSlop={8}
          >
            <Ionicons name={editMode ? 'close-outline' : 'pencil-outline'} size={16} color={c.text} />
          </Pressable>
        </View>

        {/* Status chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACE.md }}>
          {statusChips.map((chip) => (
            <View key={chip.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: chip.color + '55', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: chip.color + '15' }}>
              <Ionicons name={chip.icon} size={12} color={chip.color} />
              <Text style={{ fontSize: 12, fontWeight: '500', color: chip.color }}>{chip.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {!editMode && (
        <ProfileChecklist
          th={th}
          authToken={authToken}
          onSubmitted={handleProfileSubmittedForReview}
          onOpenWizard={() => setShowWizard(true)}
          c={c} t={t} styles={styles}
        />
      )}

      <ProfileCompletionWizard
        visible={showWizard}
        onClose={() => setShowWizard(false)}
        th={th}
        authToken={authToken}
        certificationOptions={certificationOptions}
        specializationOptions={specializationOptions}
        onRefresh={refreshProfile}
        c={c} t={t} styles={styles}
      />

      <DeleteAccountModal
        visible={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        onConfirmed={handleDeleteAccountConfirmed}
        loggedInTherapist={th}
        c={c} t={t}
      />

      {editMode ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('phoneLabel') ?? 'Telefon'}</Text>
          <TextInput
            style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
            value={editPhone}
            onChangeText={setEditPhone}
            placeholder={t('phonePlaceholder') ?? '+49 …'}
            placeholderTextColor={c.muted}
            keyboardType="phone-pad"
          />
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>{t('aboutLabel')}</Text>
          <TextInput
            style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, minHeight: 80, textAlignVertical: 'top' }]}
            value={editBio}
            onChangeText={setEditBio}
            placeholder={t('bioShortPlaceholder')}
            placeholderTextColor={c.muted}
            multiline
          />
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>{t('specsCommaSeparated')}</Text>
          <TextInput
            style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
            value={editSpecializations}
            onChangeText={setEditSpecializations}
            placeholder={t('specsExamplePlaceholder')}
            placeholderTextColor={c.muted}
          />
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>{t('languagesLabel')}</Text>
          <LangMultiselect editLanguages={editLanguages} setEditLanguages={setEditLanguages} c={c} styles={styles} t={t} />
          <View style={[styles.detailInfoRow, { marginTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailInfoLabel, { color: c.text }]}>{t('homeVisitOffer')}</Text>
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{t('homeVisitOfferSub')}</Text>
            </View>
            <Switch value={editHomeVisit} onValueChange={setEditHomeVisit} trackColor={{ true: c.success }} />
          </View>
          {editHomeVisit && (
            <View style={{ marginTop: 10 }}>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('serviceAreaQuestion')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {[5, 10, 15, 20, 30, 50].map((km) => (
                  <Pressable
                    key={km}
                    onPress={() => setEditServiceRadius(km)}
                    style={[styles.kassenartBtn, {
                      backgroundColor: editServiceRadius === km ? c.success : c.mutedBg,
                      borderColor: editServiceRadius === km ? c.success : c.border,
                    }]}
                  >
                    <Text style={[styles.kassenartText, { color: editServiceRadius === km ? '#fff' : c.text }]}>
                      {km} km
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Geschlecht</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 12 }}>
            {[{ key: 'female', label: 'Therapeutin' }, { key: 'male', label: 'Therapeut' }].map((opt) => {
              const active = editGender === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setEditGender(active ? null : opt.key)}
                  style={[styles.kassenartBtn, {
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: active ? c.primary : c.mutedBg,
                    borderColor: active ? c.primary : c.border,
                  }]}
                >
                  <Ionicons name={opt.key === 'female' ? 'female-outline' : 'male-outline'} size={13} color={active ? '#fff' : c.muted} />
                  <Text style={[styles.kassenartText, { color: active ? '#fff' : c.text }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>{t('kassenartLabel')}</Text>
          <View style={[styles.kassenartToggleGrid, { marginTop: 6 }]}>
            {[
              { key: 'gesetzlich', label: t('kasseGesetzlich') },
              { key: 'privat', label: t('kassePrivat') },
              { key: 'selbstzahler', label: t('kasseSelbstzahler') },
            ].map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setEditKassenarten((prev) =>
                  prev.includes(option.key) ? prev.filter((value) => value !== option.key) : [...prev, option.key]
                )}
                style={[styles.kassenartToggleCard, {
                  backgroundColor: editKassenarten.includes(option.key) ? c.primaryBg : c.mutedBg,
                  borderColor: editKassenarten.includes(option.key) ? c.primary : c.border,
                }]}
              >
                <Text style={[styles.kassenartToggleText, { color: editKassenarten.includes(option.key) ? c.primary : c.text }]}>
                  {option.label}
                </Text>
                <Ionicons
                  name={editKassenarten.includes(option.key) ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={editKassenarten.includes(option.key) ? c.primary : c.muted}
                />
              </Pressable>
            ))}
          </View>
          <View style={[styles.detailInfoRow, { marginTop: 12 }]}>
            <Text style={[styles.detailInfoLabel, { color: c.text, flex: 1 }]}>{t('searchVisibleLabel')}</Text>
            <Switch
              value={editIsVisible}
              onValueChange={setEditIsVisible}
              trackColor={{ true: c.primary }}
              disabled={loggedInTherapist?.reviewStatus !== 'APPROVED'}
            />
          </View>
          <View style={[styles.detailInfoRow, { marginTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailInfoLabel, { color: c.text }]}>{t('bookingModeLabel') ?? 'Terminanfragen aktivieren'}</Text>
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{t('bookingModeSub') ?? 'Patienten können direkt einen Termin anfragen.'}</Text>
            </View>
            <Switch
              value={editBookingMode === 'FIRST_APPOINTMENT_REQUEST'}
              onValueChange={(val) => {
                setEditBookingMode(val ? 'FIRST_APPOINTMENT_REQUEST' : 'DIRECTORY_ONLY');
              }}
              trackColor={{ true: c.primary }}
              disabled={!canActivateBookingRequests}
            />
          </View>
          {!canActivateBookingRequests && (
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 4, marginBottom: 4 }}>
              Terminanfragen werden nach der Profilprüfung freigeschaltet.
            </Text>
          )}
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.detailInfoLabel, { color: c.muted, marginBottom: 6 }]}>Leistungen</Text>
            <Pressable
              onPress={() => setShowServicesScreen(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.sm, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}
            >
              <Ionicons name="medical-outline" size={16} color={c.primary} />
              <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600', flex: 1 }}>Leistungen verwalten</Text>
              <Ionicons name="chevron-forward" size={14} color={c.muted} />
            </Pressable>
          </View>
          <Text style={[styles.detailInfoLabel, { color: c.muted, marginTop: 14, marginBottom: 4 }]}>{t('availabilityLabel')}</Text>
          <TextInput
            style={[styles.registerInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
            value={editAvailability}
            onChangeText={setEditAvailability}
            placeholder={t('availabilityPlaceholder')}
            placeholderTextColor={c.muted}
          />
          <View style={{ marginTop: 14 }}>
            <ComplianceStatusStep
              c={c}
              healthAuthorityStatus={editHealthAuthorityStatus}
              onChangeHealthAuthorityStatus={setEditHealthAuthorityStatus}
              onChangeTaxRegistrationStatus={setEditTaxRegistrationStatus}
              t={t}
              taxRegistrationStatus={editTaxRegistrationStatus}
            />
          </View>
          {Array.isArray(certificationOptions) && certificationOptions.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles.detailInfoLabel, { color: c.muted, marginBottom: 8 }]}>{t('certificationsLabel') ?? 'Fortbildungen'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {certificationOptions.map((opt) => {
                  const active = (editCertifications ?? []).includes(opt.key);
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setEditCertifications(prev =>
                        prev.includes(opt.key) ? prev.filter(k => k !== opt.key) : [...prev, opt.key]
                      )}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingVertical: 7, paddingHorizontal: 12,
                        borderRadius: 20, borderWidth: 1.5,
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.primaryBg : c.mutedBg,
                      }}
                    >
                      {active && <Ionicons name="checkmark" size={13} color={c.primary} />}
                      <Text style={{ fontSize: 13, color: active ? c.primary : c.muted, fontWeight: active ? '600' : '400' }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          {/* ── Adresse ─────────────────────────────────────────────── */}
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Adresse</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, flex: 1 }]}
              value={editStreet}
              onChangeText={setEditStreet}
              placeholder="Straße"
              placeholderTextColor={c.muted}
            />
            <TextInput
              style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, width: 80 }]}
              value={editHouseNumber}
              onChangeText={setEditHouseNumber}
              placeholder="Nr."
              placeholderTextColor={c.muted}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput
              style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, width: 100 }]}
              value={editPostalCode}
              onChangeText={setEditPostalCode}
              placeholder="PLZ"
              placeholderTextColor={c.muted}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, flex: 1 }]}
              value={editCity}
              onChangeText={setEditCity}
              placeholder="Stadt"
              placeholderTextColor={c.muted}
            />
          </View>
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Kartenposition</Text>
          <View style={{ gap: 8 }}>
            {[
              { value: 'approximate', label: 'Nur ungefähre Umgebung', sub: 'Deine genaue Adresse bleibt privat' },
              { value: 'exact', label: 'Exakte Adresse', sub: 'Dein genauer Standort wird öffentlich angezeigt' },
            ].map((opt) => {
              const active = editLocationPrecision === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setEditLocationPrecision(opt.value)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : c.mutedBg }}
                >
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: active ? c.primary : c.muted, alignItems: 'center', justifyContent: 'center' }}>
                    {active && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.primary }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? c.primary : c.text }}>{opt.label}</Text>
                    <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{opt.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable style={[styles.registerBtn, { flex: 1, backgroundColor: c.border, marginTop: 0 }]} onPress={() => setEditMode(false)}>
              <Text style={{ ...TYPE.heading, color: c.text }}>{t('cancelBtn')}</Text>
            </Pressable>
            <Pressable style={[styles.registerBtn, { flex: 1, backgroundColor: profileSaving ? c.border : c.primary, marginTop: 0 }]} onPress={handleSaveProfile} disabled={profileSaving}>
              <Text style={styles.registerBtnText}>{profileSaving ? t('savingBtn') : t('saveBtn')}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setShowDeleteAccount(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 16, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.error }}
          >
            <Ionicons name="trash-outline" size={16} color={c.error} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.error }}>{t('deleteAccount')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* ── Kontakt ──────────────────────────────────────────────── */}
          <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: SPACE.md }}>Kontakt</Text>

            {/* Telefon */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
              <Ionicons name="call-outline" size={18} color={c.muted} />
              <Text style={{ flex: 1, fontSize: 15, color: th.phone ? c.text : c.muted }}>
                {th.phone ?? (t('phonePlaceholder') ?? '+49 …')}
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: c.border, marginVertical: SPACE.md }} />

            {/* E-Mail */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
              <Ionicons name="mail-outline" size={18} color={c.muted} />
              <Text style={{ flex: 1, fontSize: 15, color: c.text }}>{th.email}</Text>
            </View>

            {/* Adresse */}
            {(th.street || th.city) && (
              <>
                <View style={{ height: 1, backgroundColor: c.border, marginVertical: SPACE.md }} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md }}>
                  <Ionicons name="location-outline" size={18} color={c.muted} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    {th.street && (
                      <Text style={{ fontSize: 15, color: c.text }}>
                        {[th.street, th.houseNumber].filter(Boolean).join(' ')}
                      </Text>
                    )}
                    {th.city && (
                      <Text style={{ fontSize: 15, color: th.street ? c.muted : c.text }}>
                        {[th.postalCode, th.city].filter(Boolean).join(' ')}
                      </Text>
                    )}
                    <Text style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
                      {th.locationPrecision === 'exact' ? 'Exakte Adresse' : 'Ungefähre Umgebung'}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* ── Leistungen ───────────────────────────────────────────── */}
          <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Array.isArray(th.heilmittel) && th.heilmittel.length > 0 ? SPACE.md : 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Leistungen</Text>
              <Pressable onPress={() => setShowServicesScreen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>Verwalten</Text>
                <Ionicons name="chevron-forward" size={14} color={c.primary} />
              </Pressable>
            </View>
            {Array.isArray(th.heilmittel) && th.heilmittel.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {th.heilmittel.map((item) => (
                  <View key={item} style={{ backgroundColor: c.primary, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 }}>
                    <Text style={{ fontSize: 13, color: '#fff', fontWeight: '500' }}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: c.muted }}>Noch keine Leistungen konfiguriert.</Text>
            )}
          </View>

          {/* ── Spezialisierungen ────────────────────────────────────── */}
          {(th.specializations ?? []).length > 0 && (
            <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: SPACE.md }}>{t('specsLabel')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(th.specializations ?? []).map((s) => (
                  <View key={s} style={{ borderWidth: 1, borderColor: c.primary + '80', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 }}>
                    <Text style={{ fontSize: 13, color: c.primary, fontWeight: '500' }}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Sprachen ─────────────────────────────────────────────── */}
          {(th.languages ?? []).length > 0 && (
            <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: SPACE.sm }}>{t('languagesLabel')}</Text>
              <Text style={{ fontSize: 14, color: c.text, lineHeight: 22 }}>
                {(th.languages ?? []).map((code) => getLangLabel(code)).join('  ·  ')}
              </Text>
            </View>
          )}

          {/* ── Fortbildungen ────────────────────────────────────────── */}
          {Array.isArray(th.certifications) && th.certifications.length > 0 && (
            <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: SPACE.md }}>{t('certificationsLabel') ?? 'Fortbildungen'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {th.certifications.map((cert) => (
                  <View key={cert} style={{ borderWidth: 1, borderColor: c.success, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12, backgroundColor: (c.successBg ?? '#f0fdf4') }}>
                    <Text style={{ fontSize: 13, color: c.success, fontWeight: '500' }}>{cert}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Hausbesuche ──────────────────────────────────────────── */}
          {th.homeVisit && (
            <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: c.text }}>{t('homeVisitLabel')}</Text>
              {th.serviceRadiusKm ? (
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.success ?? '#22c55e' }}>Bis {th.serviceRadiusKm} km</Text>
              ) : (
                <Text style={{ fontSize: 14, color: c.success ?? '#22c55e' }}>{t('yesLabel')}</Text>
              )}
            </View>
          )}

          {/* ── Administrative Angaben (collapsible) ─────────────────── */}
          <Pressable
            onPress={() => setAdminExpanded((v) => !v)}
            style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md, flexDirection: 'row', alignItems: 'center' }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{t('complianceSectionTitle') ?? 'Administrative Angaben'}</Text>
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>Finanzamt, Gesundheitsamt & weitere</Text>
            </View>
            <Ionicons name={adminExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
          </Pressable>
          {adminExpanded && (
            <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md, marginTop: -SPACE.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, color: c.muted, flex: 1 }}>{t('taxRegistrationLabel')}</Text>
                <Text style={{ fontSize: 13, color: c.text, fontWeight: '500' }}>{getComplianceStatusLabel(th.compliance?.taxRegistrationStatus, t)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: c.muted, flex: 1 }}>{t('healthAuthorityLabel')}</Text>
                <Text style={{ fontSize: 13, color: c.text, fontWeight: '500' }}>{getComplianceStatusLabel(th.compliance?.healthAuthorityStatus, t)}</Text>
              </View>
              {th.availability ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <Text style={{ fontSize: 13, color: c.muted, flex: 1 }}>{t('availabilityLabel')}</Text>
                  <Text style={{ fontSize: 13, color: c.text, fontWeight: '500' }}>{th.availability}</Text>
                </View>
              ) : null}
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 12, lineHeight: 18 }}>{t('complianceDisclaimer')}</Text>
            </View>
          )}

          {/* ── Nachweise & Dokumente ────────────────────────────────── */}
          <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, marginBottom: SPACE.sm }}>
              <Ionicons name="document-text-outline" size={20} color={c.muted} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{t('documentsTitle')}</Text>
                <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>
                  {docCount} von {docTotal} Dokumenten hochgeladen
                </Text>
              </View>
            </View>

            {(therapistDocuments ?? []).length > 0 && (
              <View style={{ marginBottom: SPACE.sm }}>
                {(therapistDocuments ?? []).map((doc) => (
                  <View key={doc.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.border }}>
                    <Ionicons name={doc.mimetype === 'application/pdf' ? 'document-outline' : 'image-outline'} size={16} color={c.muted} />
                    <Text style={{ flex: 1, fontSize: 13, color: c.text }} numberOfLines={1}>{doc.originalName}</Text>
                  </View>
                ))}
              </View>
            )}

            {docCount < docTotal && (
              <View style={{ backgroundColor: c.mutedBg ?? '#f9fafb', borderRadius: RADIUS.sm, padding: SPACE.md, marginTop: SPACE.xs }}>
                <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>
                  Lade deine Nachweise hoch, um dein Profil zu verifizieren.
                </Text>
                <Pressable onPress={handlePickDocument} disabled={documentUploading} style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>
                    {documentUploading ? t('uploadingDoc') : `${t('uploadDocBtn') ?? 'Jetzt hochladen'} ›`}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Über mich ────────────────────────────────────────────── */}
          {th.bio ? (
            <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md, flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginBottom: SPACE.sm }}>{t('aboutLabel')}</Text>
                <Text style={{ fontSize: 14, color: c.text, lineHeight: 21 }}>{th.bio}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} style={{ marginTop: 2 }} />
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

// PracticeAdminScreen removed — freelancer-only MVP


function LangMultiselect({ editLanguages, setEditLanguages, c, styles, t }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const selectedLanguages = Array.isArray(editLanguages) ? editLanguages : [];
  const suggestions = q.length === 0 ? [] : languageOptions.filter((code) => {
    if (selectedLanguages.includes(code)) return false;
    return code.toLowerCase().includes(q) || getLangLabel(code).toLowerCase().includes(q);
  }).slice(0, 8);

  return (
    <View>
      {selectedLanguages.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selectedLanguages.map((code) => (
            <Pressable
              key={code}
              onPress={() => setEditLanguages((prev) => prev.filter((l) => l !== code))}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.primaryBg, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 9, minHeight: 36, gap: 4 }}
            >
              <Text style={{ color: c.primary, fontSize: 13 }}>{getLangLabel(code)}</Text>
              <Text style={{ color: c.primary, fontSize: 13 }}>×</Text>
            </Pressable>
          ))}
        </View>
      )}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('searchLanguagePlaceholder')}
        placeholderTextColor={c.muted}
        style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
      />
      {suggestions.length > 0 && (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, marginTop: 4, overflow: 'hidden' }}>
          {suggestions.map((code) => (
            <Pressable
              key={code}
              onPress={() => { setEditLanguages((prev) => [...prev, code]); setSearch(''); }}
              style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}
            >
              <Text style={{ color: c.text, fontSize: 14 }}>{getLangLabel(code)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
