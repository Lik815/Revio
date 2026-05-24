import React, { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform,
  Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COMPLIANCE_STATUS_VALUES, HEALTH_AUTHORITY_STATUS_VALUES,
  RADIUS, REG_STEPS, SPACE, TYPE,
  fortbildungOptions, getBaseUrl, getLangLabel, kassenartOptions,
  languageOptions, regSpecOptions, TUNNEL_HEADERS, ICON_HIT_SLOP,
} from './mobile-utils';
import { ComplianceStatusStep } from './mobile-compliance-step';

const FREELANCE_HELP_URL = 'https://my-revio.de/blog/freiberuflich-als-physiotherapeut-starten';
const REGISTRATION_COMPLIANCE_DRAFT_KEY = 'revio_registration_compliance_draft';

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

export function TherapistRegistrationFlow({
  visible,
  onClose,
  onRegistered,
  c, t, styles,
}) {
  const [regStep, setRegStep] = useState(1);
  const [regSubmitted, setRegSubmitted] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regPostalCode, setRegPostalCode] = useState('');
  const [regStreet, setRegStreet] = useState('');
  const [regHouseNumber, setRegHouseNumber] = useState('');
  const [regLocationPrecision, setRegLocationPrecision] = useState('approximate');
  const [regSpecializations, setRegSpecializations] = useState([]);
  const [regLanguages, setRegLanguages] = useState(['de']);
  const [regFortbildungen, setRegFortbildungen] = useState([]);
  const regFreelance = true;
  const [regIsFreelance, setRegIsFreelance] = useState(null);
  const [regHomeVisit, setRegHomeVisit] = useState(false);
  const [regServiceRadius, setRegServiceRadius] = useState(null);
  const [regKassenart, setRegKassenart] = useState([]);
  const [regGender, setRegGender] = useState(null);
  const [regSpecSearch, setRegSpecSearch] = useState('');
  const [regLangSearch, setRegLangSearch] = useState('');
  const [regDocument, setRegDocument] = useState(null);
  const [regTaxRegistrationStatus, setRegTaxRegistrationStatus] = useState(null);
  const [regHealthAuthorityStatus, setRegHealthAuthorityStatus] = useState(null);
  const [regComplianceDraftReady, setRegComplianceDraftReady] = useState(false);
  const [showRegFortbildungen, setShowRegFortbildungen] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPasswordConfirm, setShowRegPasswordConfirm] = useState(false);
  const [regEmailVerified, setRegEmailVerified] = useState(false);
  const [regOtpSent, setRegOtpSent] = useState(false);
  const [regOtpCode, setRegOtpCode] = useState('');
  const [regOtpError, setRegOtpError] = useState('');
  const [regOtpLoading, setRegOtpLoading] = useState(false);
  const [showRegStepInfo, setShowRegStepInfo] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);

  const registerScrollRef = useRef(null);

  const resetRegState = () => {
    setRegStep(1);
    setRegSubmitted(false);
    setRegEmail('');
    setRegPassword('');
    setRegPasswordConfirm('');
    setRegFirstName('');
    setRegLastName('');
    setRegCity('');
    setRegPostalCode('');
    setRegStreet('');
    setRegHouseNumber('');
    setRegLocationPrecision('approximate');
    setRegGender(null);
    setRegSpecializations([]);
    setRegLanguages(['de']);
    setRegFortbildungen([]);
    setRegHomeVisit(false);
    setRegServiceRadius(null);
    setRegKassenart([]);
    setRegSpecSearch('');
    setRegLangSearch('');
    setRegDocument(null);
    setRegTaxRegistrationStatus(null);
    setRegHealthAuthorityStatus(null);
    setRegComplianceDraftReady(false);
    setShowRegFortbildungen(false);
    setShowRegPassword(false);
    setShowRegPasswordConfirm(false);
    setShowRegStepInfo(false);
    setRegEmailVerified(false);
    setRegIsFreelance(null);
    setRegOtpSent(false);
    setRegOtpCode('');
    setRegOtpError('');
    setRegOtpLoading(false);
  };

  const toggleRegSpec = (s) => setRegSpecializations(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleRegLang = (l) => setRegLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  const toggleRegFort = (f) => setRegFortbildungen(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  const toggleRegKassenart = (k) => setRegKassenart(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  const openFreelanceHelp = async () => {
    try {
      await Linking.openURL(FREELANCE_HELP_URL);
    } catch {
      if (Platform.OS === 'web') alert(t('freelanceCheckHelpOpenError'));
      else Alert.alert(t('alertError'), t('freelanceCheckHelpOpenError'));
    }
  };

  const scrollRegistrationToBottom = () => {
    setTimeout(() => {
      registerScrollRef.current?.scrollToEnd?.({ animated: true });
    }, Platform.OS === 'ios' ? 140 : 220);
  };

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(REGISTRATION_COMPLIANCE_DRAFT_KEY)
      .then((rawValue) => {
        if (!active) return;
        const draft = parseComplianceDraft(rawValue);
        setRegTaxRegistrationStatus(draft.taxRegistrationStatus);
        setRegHealthAuthorityStatus(draft.healthAuthorityStatus);
      })
      .finally(() => { if (active) setRegComplianceDraftReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!regComplianceDraftReady) return;
    if (!regTaxRegistrationStatus && !regHealthAuthorityStatus) {
      AsyncStorage.removeItem(REGISTRATION_COMPLIANCE_DRAFT_KEY).catch(() => {});
      return;
    }
    AsyncStorage.setItem(
      REGISTRATION_COMPLIANCE_DRAFT_KEY,
      JSON.stringify({ taxRegistrationStatus: regTaxRegistrationStatus ?? null, healthAuthorityStatus: regHealthAuthorityStatus ?? null }),
    ).catch(() => {});
  }, [regComplianceDraftReady, regTaxRegistrationStatus, regHealthAuthorityStatus]);

  if (!visible) return null;

  if (regSubmitted) {
    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center', paddingVertical: 40 }]}>
          <Ionicons name="checkmark-circle" size={52} color={c.primary} style={{ marginBottom: 16 }} />
          <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center' }]}>{t('regCompleteTitle')}</Text>
          <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>
            {__DEV__
              ? t('registrationInfoBodyDev')
              : t('regCompleteBody')}
          </Text>
          <Pressable
            style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 24, paddingHorizontal: 32 }]}
            onPress={() => { resetRegState(); onClose(); }}
          >
            <Text style={styles.registerBtnText}>{t('verifyEmailBtn')}</Text>
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
        return (
          regFirstName.trim().length > 0 &&
          regLastName.trim().length > 0 &&
          regCity.trim().length > 0 &&
          regPostalCode.trim().length === 5
        );
      case 2:
        return regIsFreelance === true;
      case 5:
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
              <Text style={[styles.regStepTitle, { color: c.text, marginBottom: 0 }]}>{t('personalDetailsTitle')}</Text>
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
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
              {[{ key: 'female', label: 'Therapeutin' }, { key: 'male', label: 'Therapeut' }].map((opt) => {
                const active = regGender === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setRegGender(active ? null : opt.key)}
                    style={[styles.regInput, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: active ? c.primaryBg ?? c.mutedBg : c.card, borderColor: active ? c.primary : c.border }]}
                  >
                    <Ionicons name={opt.key === 'female' ? 'female-outline' : 'male-outline'} size={15} color={active ? c.primary : c.muted} />
                    <Text style={{ color: active ? c.primary : c.text, fontWeight: active ? '600' : '400', fontSize: 14 }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput value={regFirstName} onChangeText={setRegFirstName} placeholder={t('firstNamePlaceholder')} placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: regFirstName.length > 0 && regFirstName.trim().length === 0 ? c.saved : c.border, color: c.text }]} />
            {regFirstName.length > 0 && regFirstName.trim().length === 0 && (
              <Text style={{ color: c.saved, fontSize: 13, marginTop: -6 }}>{t('firstNameRequired')}</Text>
            )}
            <TextInput value={regLastName} onChangeText={setRegLastName} placeholder={t('lastNamePlaceholder')} placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: regLastName.length > 0 && regLastName.trim().length === 0 ? c.saved : c.border, color: c.text }]} />
            {regLastName.length > 0 && regLastName.trim().length === 0 && (
              <Text style={{ color: c.saved, fontSize: 13, marginTop: -6 }}>{t('lastNameRequired')}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 110 }}>
                <TextInput
                  value={regPostalCode}
                  onChangeText={(value) => setRegPostalCode(value.replace(/\D/g, '').slice(0, 5))}
                  placeholder={t('postalCodePlaceholder')}
                  placeholderTextColor={c.muted}
                  keyboardType="number-pad"
                  maxLength={5}
                  style={[styles.regInput, { backgroundColor: c.card, borderColor: regPostalCode.length > 0 && regPostalCode.length !== 5 ? c.saved : c.border, color: c.text }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={regCity}
                  onChangeText={setRegCity}
                  placeholder={t('cityPlaceholder')}
                  placeholderTextColor={c.muted}
                  autoCapitalize="words"
                  style={[styles.regInput, { backgroundColor: c.card, borderColor: regCity.length > 0 && regCity.trim().length === 0 ? c.saved : c.border, color: c.text }]}
                />
              </View>
            </View>
            {regPostalCode.length > 0 && regPostalCode.length !== 5 && (
              <Text style={{ color: c.saved, fontSize: 13, marginTop: -6 }}>{t('postalCodeInvalid')}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={regStreet}
                  onChangeText={setRegStreet}
                  placeholder={t('streetOptionalPlaceholder')}
                  placeholderTextColor={c.muted}
                  autoCapitalize="words"
                  style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
                />
              </View>
              <View style={{ width: 118 }}>
                <TextInput
                  value={regHouseNumber}
                  onChangeText={setRegHouseNumber}
                  placeholder={t('houseNumberOptionalPlaceholder')}
                  placeholderTextColor={c.muted}
                  autoCapitalize="characters"
                  style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
                />
              </View>
            </View>
            <View style={{ marginTop: 2, gap: 10 }}>
              <Text style={{ fontSize: 13, color: c.muted, lineHeight: 18 }}>
                {t('locationPrecisionQuestion')}
              </Text>
              <View style={{ gap: 10 }}>
                {[
                  {
                    key: 'approximate',
                    label: t('locationPrecisionApproximate'),
                    sub: t('locationPrecisionApproximateSub'),
                  },
                  {
                    key: 'exact',
                    label: t('locationPrecisionExact'),
                    sub: t('locationPrecisionExactSub'),
                  },
                ].map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => setRegLocationPrecision(option.key)}
                    style={[styles.optionRow, {
                      backgroundColor: regLocationPrecision === option.key ? c.primaryBg : c.card,
                      borderColor: regLocationPrecision === option.key ? c.primary : c.border,
                    }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: c.text }]}>{option.label}</Text>
                      <Text style={[styles.optionValue, { color: c.muted, fontSize: 12 }]}>{option.sub}</Text>
                    </View>
                    {regLocationPrecision === option.key && <Ionicons name="checkmark-circle" size={22} color={c.primary} />}
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        );
      case 2:
        return (
          <>
            <Text style={[styles.regStepTitle, { color: c.text }]}>{t('freelanceCheckTitle')}</Text>
            <Text style={{ fontSize: 14, color: c.muted, marginBottom: SPACE.lg, lineHeight: 20 }}>
              {t('freelanceCheckBody')}
            </Text>
            <View style={{ marginTop: -4, marginBottom: SPACE.lg, gap: 4 }}>
              <Text style={{ fontSize: 13, color: c.muted, lineHeight: 18 }}>
                {t('freelanceCheckHelpTitle')}
              </Text>
              <Pressable onPress={openFreelanceHelp} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
                <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600', lineHeight: 18 }}>
                  {t('freelanceCheckHelpLink')}
                </Text>
              </Pressable>
            </View>
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
                <Ionicons name="warning-outline" size={20} color={c.error} style={{ marginTop: 1, width: 24 }} />
                <Text style={[styles.noticeBody, { color: c.error }]}>{t('freelanceCheckBlockedMsg')}</Text>
              </View>
            )}
          </>
        );
      case 3: {
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
                <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{REG_STEP_INFO[3]}</Text>
              </View>
            )}

            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>
              {t('specializationsOptional')} <Text style={styles.optionalInlineLabel}>{t('optionalHint')}</Text>
            </Text>
            <TextInput
              value={regSpecSearch}
              onChangeText={setRegSpecSearch}
              onFocus={scrollRegistrationToBottom}
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
                    {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.checkLabel, { color: c.text }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
            {regFortbildungen.length > 0 && (
              <View style={[styles.tagRow, { marginTop: 4, marginBottom: 4 }]}>
                {regFortbildungen.map((f) => (
                  <Pressable key={f} onPress={() => toggleRegFort(f)} style={[styles.chip, { backgroundColor: c.primary, borderColor: c.primary }]}>
                    <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{getCertificationLabel(f)} ×</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.sectionBadgeRow}>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 0 }]}>{t('languagesLabel')}</Text>
              <View style={[styles.inlineMetaPill, { backgroundColor: c.primaryBg }]}>
                <Text style={[styles.inlineMetaPillText, { color: c.primary }]}>{t('requiredBadge')}</Text>
              </View>
            </View>
            <Text style={[styles.metaNote, { color: c.textMuted, marginBottom: 8 }]}>{t('germanPreselected')}</Text>
            <TextInput
              value={regLangSearch}
              onChangeText={setRegLangSearch}
              onFocus={scrollRegistrationToBottom}
              placeholder={t('addLangPlaceholder')}
              placeholderTextColor={c.muted}
              style={[styles.regInput, { backgroundColor: c.card, borderColor: regLanguages.length > 0 ? c.primary : c.border, color: c.text }]}
            />
            {langSuggestions4.length > 0 && (
              <View style={{ borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, marginTop: -8, marginBottom: 4, overflow: 'hidden', backgroundColor: c.card }}>
                {langSuggestions4.map((l, i) => (
                  <Pressable key={l} onPress={() => { toggleRegLang(l); setRegLangSearch(''); }}
                    style={{ padding: SPACE.md, borderTopWidth: i > 0 ? 1 : 0, borderColor: c.border }}>
                    <Text style={{ ...TYPE.body, color: c.text }}>{getLangLabel(l)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {regLanguages.length > 0 && (
              <View style={[styles.tagRow, { marginTop: 4, marginBottom: 8 }]}>
                {regLanguages.map(l => (
                  <Pressable key={l} onPress={() => toggleRegLang(l)} style={[styles.chip, { backgroundColor: c.primary, borderColor: c.primary }]}>
                    <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{getLangLabel(l)} ×</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Hausbesuche */}
            <View style={[styles.detailInfoRow, { marginTop: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('homeVisitOffer')}</Text>
                <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{t('homeVisitOfferSub')}</Text>
              </View>
              <Switch value={regHomeVisit} onValueChange={(v) => { setRegHomeVisit(v); if (!v) setRegServiceRadius(null); }} trackColor={{ true: c.success }} />
            </View>
            {regHomeVisit && (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('serviceAreaQuestion')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {[5, 10, 15, 20, 30, 50].map((km) => (
                    <Pressable
                      key={km}
                      onPress={() => setRegServiceRadius(km)}
                      style={[styles.kassenartBtn, {
                        backgroundColor: regServiceRadius === km ? c.success : c.mutedBg,
                        borderColor: regServiceRadius === km ? c.success : c.border,
                      }]}
                    >
                      <Text style={[styles.kassenartText, { color: regServiceRadius === km ? '#fff' : c.text }]}>{km} km</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Kassenzulassung */}
            <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 16 }]}>{t('kassenartLabel')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {kassenartOptions.filter(o => o.key !== null).map((option) => {
                const active = regKassenart.includes(option.key);
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => toggleRegKassenart(option.key)}
                    style={[styles.kassenartBtn, {
                      backgroundColor: active ? c.primary : c.mutedBg,
                      borderColor: active ? c.primary : c.border,
                    }]}
                  >
                    <Text style={[styles.kassenartText, { color: active ? '#fff' : c.text }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        );
      }
      case 4:
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
                <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{REG_STEP_INFO[4]}</Text>
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
      case 5:
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
                <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{REG_STEP_INFO[5]}</Text>
              </View>
            )}

            <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border, marginBottom: SPACE.sm }]}>
              <Ionicons name="document-outline" size={20} color={c.muted} style={{ marginTop: 1, width: 24 }} />
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
      case 6:
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
                <Text style={{ fontSize: 13, color: c.muted, lineHeight: 19 }}>{REG_STEP_INFO[6]}</Text>
              </View>
            )}
            {[
              { label: t('nameLabel'), value: `${regFirstName} ${regLastName}`.trim() || '—' },
              { label: t('emailLabel'), value: regEmail || '—' },
              {
                label: t('locationSummaryLabel'),
                value: formatTherapistLocationSummary({
                  city: regCity,
                  postalCode: regPostalCode,
                  street: regStreet,
                  houseNumber: regHouseNumber,
                }) || '—',
              },
              { label: t('activityLabel'), value: t('freelanceLabel') },
              { label: t('specsLabel'), value: regSpecializations.join(', ') || '—' },
              { label: t('languagesLabel'), value: regLanguages.map(getLangLabel).join(', ') || '—' },
              { label: t('certificationsShort'), value: regFortbildungen.map(getCertificationLabel).join(', ') || '—' },
              { label: t('homeVisitOffer'), value: regHomeVisit ? (regServiceRadius ? `Ja, ${regServiceRadius} km` : 'Ja') : 'Nein' },
              { label: t('kassenartLabel'), value: regKassenart.length ? regKassenart.join(', ') : '—' },
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
              <Ionicons name="information-circle-outline" size={20} color={c.muted} style={{ marginTop: 1, width: 24 }} />
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
    1: t('regStepInfoText2'),
    3: t('regStepInfoText4'),
    4: t('regStepInfoText5'),
    5: t('regStepInfoText6'),
    6: t('regStepInfoText7'),
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView
      ref={registerScrollRef}
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 20, paddingBottom: 56, gap: SPACE.sm }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
    >
      <Pressable
        onPress={() => {
          if (regStep === 1) {
            setShowRegister(false);
            resetRegState();
            setShowRoleSelect(true);
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
        style={[styles.registerBtn, { backgroundColor: canProceed() && !regLoading ? c.primary : c.border, marginTop: 8 }]}
        onPress={async () => {
          if (!canProceed() || regLoading) return;
          if (regStep < REG_STEPS) {
            setRegStep(s => s + 1);
            setShowRegStepInfo(false);
          } else {
            setRegLoading(true);
            try {
              const res = await fetch(`${getBaseUrl()}/register/therapist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: regEmail,
                  password: regPassword,
                  fullName: `${regFirstName} ${regLastName}`.trim(),
                  city: regCity.trim() || undefined,
                  postalCode: regPostalCode || undefined,
                  street: regStreet.trim() || undefined,
                  houseNumber: regHouseNumber.trim() || undefined,
                  locationPrecision: regLocationPrecision,
                  specializations: regSpecializations,
                  languages: regLanguages.map(l => l.toLowerCase()),
                  certifications: regFortbildungen,
                  homeVisit: regHomeVisit === true,
                  serviceRadiusKm: regHomeVisit === true ? (regServiceRadius ?? null) : null,
                  kassenart: regKassenart.length ? regKassenart.join(',') : undefined,
                  gender: regGender ?? undefined,
                  compliance: {
                    taxRegistrationStatus: regTaxRegistrationStatus ?? undefined,
                    healthAuthorityStatus: regHealthAuthorityStatus ?? undefined,
                  },
                }),
              });
              const resData = await res.json().catch(() => ({}));
              if (!res.ok) {
                const msg = typeof resData.message === 'string' ? resData.message : (resData.error ?? `Fehler ${res.status}`);
                setRegLoading(false);
                // OTP window expired → send user back to step 1 with the error pre-filled
                if (msg.includes('abgelaufen') || msg.includes('nicht bestätigt')) {
                  setRegStep(1);
                  setRegEmailVerified(false);
                  setRegOtpSent(false);
                  setRegOtpCode('');
                  setRegOtpError(msg);
                  return;
                }
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
                await AsyncStorage.removeItem(REGISTRATION_COMPLIANCE_DRAFT_KEY);
                setShowRegister(false);
                resetRegState();
                return;
              }
            } catch {
              setRegLoading(false);
              showWebAlert(`${t('alertConnectionError')}. ${t('alertConnectionErrorBody')}`);
              return;
            }
            setRegSubmitted(true);
          }
        }}
      >
        {regLoading && regStep >= REG_STEPS
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.registerBtnText}>{regStep < REG_STEPS ? 'Weiter →' : 'Profil einreichen'}</Text>
        }
      </Pressable>
    </ScrollView>

    {regLoading && (
      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
        <View style={{ backgroundColor: c.card, borderRadius: 20, paddingVertical: 32, paddingHorizontal: 40, alignItems: 'center', gap: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 }}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>Profil wird erstellt…</Text>
          <Text style={{ color: c.muted, fontSize: 13, textAlign: 'center' }}>Einen Moment bitte.</Text>
        </View>
      </View>
    )}
    </KeyboardAvoidingView>
  );
}
