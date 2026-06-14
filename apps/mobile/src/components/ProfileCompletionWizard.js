import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { BackButton } from './BackButton';
import {
  getBaseUrl,
  getLangLabel,
  kassenartOptions,
  languageOptions,
  normalizeKassenarten,
  normalizeLanguageCodes,
  RADIUS,
  resolveMediaUrl,
  SPACE,
  TUNNEL_HEADERS,
} from '../utils/app-utils';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const STEP_ORDER = [
  'photo',
  'document',
  'certifications',
  'kassenart',
  'phone',
  'homeVisitRadius',
  'address',
  'specializations',
  'languages',
  'city',
  'bio',
];
const RADIUS_OPTIONS = [5, 10, 15, 20, 30, 50];
const KASSENART_CHOICES = kassenartOptions.filter((option) => option.key);

const STEP_META = {
  photo: { title: 'Profilfoto', sub: 'Ein Foto schafft Vertrauen bei Patient:innen.' },
  document: { title: 'Nachweis hochladen', sub: 'Lade deine Berufsurkunde oder einen Nachweis für die Prüfung hoch.' },
  certifications: { title: 'Fortbildungen', sub: 'Wähle deine Qualifikationen und Fortbildungen.' },
  kassenart: { title: 'Abrechnungsart', sub: 'Du kannst mehrere Kassenarten auswählen.' },
  phone: { title: 'Telefonnummer', sub: 'So können Patient:innen dich bei Rückfragen erreichen.' },
  homeVisitRadius: { title: 'Hausbesuche', sub: 'Bietest du Hausbesuche an? In welchem Umkreis?' },
  address: { title: 'Adresse', sub: 'Deine Praxis- oder Arbeitsadresse.' },
  specializations: { title: 'Spezialisierungen', sub: 'Wähle deine fachlichen Schwerpunkte.' },
  languages: { title: 'Sprachen', sub: 'In welchen Sprachen behandelst du?' },
  city: { title: 'Stadt', sub: 'In welcher Stadt arbeitest du?' },
  bio: { title: 'Über mich', sub: 'Beschreibe dich in mindestens einem Satz. Das ist der letzte Schritt.' },
};

function Chip({ label, active, onPress, c }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: active ? c.primary : c.border,
        backgroundColor: active ? c.primaryBg : c.card,
      }}
    >
      {active && <Ionicons name="checkmark" size={14} color={c.primary} />}
      <Text style={{ fontSize: 13, color: active ? c.primary : c.text, fontWeight: active ? '600' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatDocumentSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function isSentenceLike(value) {
  return value.trim().split(/[.!?]+/).filter(Boolean).length > 0;
}

function createBioSuggestion(th, certificationOptions, specializationOptions) {
  const name = (th?.fullName ?? '').trim() || 'Ich';
  const specializationLabels = Array.isArray(th?.specializations) && th.specializations.length > 0
    ? th.specializations
    : (specializationOptions ?? []).slice(0, 2).map((option) => option.label);
  const certificationLabels = (th?.certifications ?? [])
    .map((key) => certificationOptions?.find((option) => option.key === key)?.label ?? key)
    .filter(Boolean);

  const intro = name === 'Ich'
    ? 'Ich bin Physiotherapeut:in'
    : `${name} ist Physiotherapeut:in`;
  const specializationPart = specializationLabels.length > 0
    ? `mit Schwerpunkten in ${specializationLabels.slice(0, 2).join(' und ')}`
    : 'mit einem klaren Fokus auf individuelle Therapie';
  const certificationPart = certificationLabels.length > 0
    ? ` und Fortbildungen in ${certificationLabels.slice(0, 2).join(' und ')}`
    : '';

  return `${intro} ${specializationPart}${certificationPart}.`;
}

export function ProfileCompletionWizard({
  visible,
  onClose,
  th,
  authToken,
  certificationOptions,
  specializationOptions,
  onRefresh,
  c,
  t,
  styles,
}) {
  const steps = useMemo(() => {
    const missing = new Set(th?.profileCompletion?.missingItems ?? []);
    return STEP_ORDER.filter((key) => missing.has(key));
  }, [visible, th?.profileCompletion?.missingItems]);

  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [certs, setCerts] = useState([]);
  const [kassenarten, setKassenarten] = useState([]);
  const [phone, setPhone] = useState('');
  const [homeVisit, setHomeVisit] = useState(false);
  const [serviceRadius, setServiceRadius] = useState(null);
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [locationPrecision, setLocationPrecision] = useState('approximate');
  const [specs, setSpecs] = useState([]);
  const [langs, setLangs] = useState([]);
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (!visible || !th) return;
    setIndex(0);
    setError('');
    setSaving(false);
    setPhotoUrl(resolveMediaUrl(th.photo) ?? th.photo ?? null);
    setDocumentCount(Number.isFinite(th.documentCount) ? th.documentCount : 0);
    setCerts(Array.isArray(th.certifications) ? th.certifications : []);
    setKassenarten(normalizeKassenarten(th.kassenarten ?? th.kassenart));
    setPhone(th.phone ?? '');
    setHomeVisit(th.homeVisit ?? false);
    setServiceRadius(th.serviceRadiusKm ?? null);
    setStreet(th.street ?? '');
    setHouseNumber(th.houseNumber ?? '');
    setLocationPrecision(th.locationPrecision ?? 'approximate');
    setSpecs(Array.isArray(th.specializations) ? th.specializations : []);
    setLangs(normalizeLanguageCodes(th.languages).map((language) => language.toLowerCase()));
    setCity(th.city ?? '');
    setBio(th.bio?.trim() || createBioSuggestion(th, certificationOptions, specializationOptions));
  }, [visible, th, certificationOptions, specializationOptions]);

  useEffect(() => {
    if (!visible || th?.reviewStatus !== 'APPROVED') return;
    onClose?.();
  }, [visible, th?.reviewStatus, onClose]);

  useEffect(() => {
    if (!visible || steps.length > 0) return;
    onClose?.();
  }, [visible, steps.length, onClose]);

  if (!visible) return null;
  if (steps.length === 0) return null;

  const current = steps[Math.min(index, steps.length - 1)];
  const isLast = index === steps.length - 1;

  const toggle = (setter, list, value) =>
    setter(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);

  const validate = () => {
    switch (current) {
      case 'photo':
        return !!photoUrl;
      case 'document':
        return documentCount > 0;
      case 'certifications':
        return certs.length > 0;
      case 'kassenart':
        return kassenarten.length > 0;
      case 'phone':
        return phone.trim().length >= 6;
      case 'homeVisitRadius':
        return !homeVisit || !!serviceRadius;
      case 'address':
        return !!street.trim() && !!houseNumber.trim();
      case 'specializations':
        return specs.length > 0;
      case 'languages':
        return langs.length > 0;
      case 'city':
        return !!city.trim();
      case 'bio':
        return isSentenceLike(bio);
      default:
        return true;
    }
  };

  const buildPayload = () => {
    switch (current) {
      case 'certifications':
        return { certifications: certs };
      case 'kassenart':
        return { kassenarten };
      case 'phone':
        return { phone: phone.trim() || null };
      case 'homeVisitRadius':
        return { homeVisit, serviceRadiusKm: homeVisit ? serviceRadius : null };
      case 'address':
        return {
          street: street.trim() || null,
          houseNumber: houseNumber.trim() || null,
          locationPrecision,
        };
      case 'specializations':
        return { specializations: specs };
      case 'languages':
        return { languages: langs.map((language) => language.toLowerCase()) };
      case 'city':
        return { city: city.trim() };
      case 'bio':
        return { bio: bio.trim() };
      default:
        return null;
    }
  };

  const pickPhoto = async () => {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        name: asset.uri.split('/').pop() || 'photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      const res = await fetch(`${getBaseUrl()}/upload/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      if (!res.ok) {
        setError('Foto konnte nicht hochgeladen werden.');
        return;
      }
      const { url } = await res.json();
      setPhotoUrl(resolveMediaUrl(url) ?? url);
      await onRefresh?.();
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setSaving(false);
    }
  };

  const pickDocument = async () => {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_DOCUMENT_BYTES) {
        Alert.alert(
          t('alertDocumentTooLargeTitle'),
          t('alertDocumentTooLargeBody')
            .replace('{max}', formatDocumentSize(MAX_DOCUMENT_BYTES))
            .replace('{name}', asset.name || t('documentFallback')),
        );
        return;
      }

      const formData = new FormData();
      formData.append('document', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      });

      setSaving(true);
      const res = await fetch(`${getBaseUrl()}/upload/document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? t('alertDocUploadFail'));
        return;
      }

      setDocumentCount((count) => count + 1);
      await onRefresh?.();
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setSaving(false);
    }
  };

  const advance = () => {
    if (isLast) onClose?.();
    else {
      setIndex((value) => Math.min(value + 1, steps.length - 1));
      setError('');
    }
  };

  const handleNext = async () => {
    setError('');
    if (!validate()) {
      setError('Bitte fülle diesen Schritt aus.');
      return;
    }
    if (current === 'photo' || current === 'document') {
      advance();
      return;
    }

    const payload = buildPayload();
    setSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...TUNNEL_HEADERS,
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Speichern fehlgeschlagen.');
        return;
      }
      await onRefresh?.();
      advance();
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setSaving(false);
    }
  };

  const meta = STEP_META[current] ?? { title: '', sub: '' };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingHorizontal: 20 }}>
        <BackButton c={c} label="Abbrechen" onPress={onClose} />

        <View style={{ marginBottom: SPACE.md }}>
          <Text style={{ fontSize: 13, color: c.muted }}>{`Schritt ${index + 1} von ${steps.length}`}</Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.mutedBg, overflow: 'hidden', marginTop: 6 }}>
            <View
              style={{
                width: `${((index + 1) / steps.length) * 100}%`,
                height: '100%',
                backgroundColor: c.primary,
              }}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 24, fontWeight: '800', color: c.text }}>{meta.title}</Text>
          <Text style={{ fontSize: 14, color: c.muted, marginTop: 6, marginBottom: 20, lineHeight: 20 }}>{meta.sub}</Text>

          {current === 'photo' && (
            <View style={{ alignItems: 'center', gap: 16 }}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={{ width: 120, height: 120, borderRadius: 60 }} />
              ) : (
                <View
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: c.mutedBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="person-outline" size={48} color={c.muted} />
                </View>
              )}
              <Pressable onPress={pickPhoto} style={[styles.registerBtn, { backgroundColor: c.primary, paddingHorizontal: 24 }]}>
                <Text style={styles.registerBtnText}>{photoUrl ? 'Anderes Foto wählen' : 'Foto auswählen'}</Text>
              </Pressable>
            </View>
          )}

          {current === 'document' && (
            <View style={{ gap: 16 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: RADIUS.md,
                  backgroundColor: c.card,
                  padding: 16,
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                  {documentCount > 0 ? `${documentCount} Nachweis(e) hochgeladen` : 'Noch kein Nachweis hochgeladen'}
                </Text>
                <Text style={{ fontSize: 13, color: c.muted }}>
                  PDF, Foto oder Scan. Der Nachweis ist nur für Admins sichtbar.
                </Text>
              </View>
              <Pressable onPress={pickDocument} style={[styles.registerBtn, { backgroundColor: c.primary }]}>
                <Text style={styles.registerBtnText}>
                  {documentCount > 0 ? t('registrationDocumentReplaceBtn') : t('registrationDocumentUploadBtn')}
                </Text>
              </Pressable>
            </View>
          )}

          {current === 'certifications' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(certificationOptions ?? []).map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  active={certs.includes(option.key)}
                  onPress={() => toggle(setCerts, certs, option.key)}
                  c={c}
                />
              ))}
            </View>
          )}

          {current === 'kassenart' && (
            <View style={styles.kassenartToggleGrid}>
              {KASSENART_CHOICES.map((option) => {
                const active = kassenarten.includes(option.key);
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => toggle(setKassenarten, kassenarten, option.key)}
                    style={[
                      styles.kassenartToggleCard,
                      {
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.primaryBg : c.card,
                      },
                    ]}
                  >
                    <Text style={[styles.kassenartToggleText, { color: active ? c.primary : c.text }]}>
                      {option.label}
                    </Text>
                    <Ionicons
                      name={active ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={active ? c.primary : c.muted}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}

          {current === 'phone' && (
            <TextInput
              style={[styles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('phonePlaceholder')}
              placeholderTextColor={c.muted}
              keyboardType="phone-pad"
            />
          )}

          {current === 'homeVisitRadius' && (
            <View style={{ gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 15, color: c.text, flex: 1 }}>Ich biete Hausbesuche an</Text>
                <Switch value={homeVisit} onValueChange={setHomeVisit} trackColor={{ true: c.primary }} />
              </View>
              {homeVisit && (
                <View>
                  <Text style={{ fontSize: 14, color: c.muted, marginBottom: 8 }}>In welchem Umkreis?</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {RADIUS_OPTIONS.map((km) => (
                      <Chip
                        key={km}
                        label={`${km} km`}
                        active={serviceRadius === km}
                        onPress={() => setServiceRadius(km)}
                        c={c}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {current === 'address' && (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.regInput, { flex: 1, color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
                  value={street}
                  onChangeText={setStreet}
                  placeholder="Straße"
                  placeholderTextColor={c.muted}
                />
                <TextInput
                  style={[styles.regInput, { width: 90, color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
                  value={houseNumber}
                  onChangeText={setHouseNumber}
                  placeholder="Nr."
                  placeholderTextColor={c.muted}
                />
              </View>
              <View style={{ gap: 8 }}>
                {[
                  { value: 'approximate', label: 'Nur ungefähre Umgebung', sub: 'Deine genaue Adresse bleibt privat' },
                  { value: 'exact', label: 'Exakte Adresse', sub: 'Dein genauer Standort wird öffentlich angezeigt' },
                ].map((option) => {
                  const active = locationPrecision === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setLocationPrecision(option.value)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        padding: 12,
                        borderRadius: RADIUS.md,
                        borderWidth: 1.5,
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.primaryBg : c.mutedBg,
                      }}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 2,
                          borderColor: active ? c.primary : c.muted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {active && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.primary }} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: active ? c.primary : c.text }}>{option.label}</Text>
                        <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{option.sub}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {current === 'specializations' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(specializationOptions ?? []).map((option) => {
                const value = option.label;
                return (
                  <Chip
                    key={value}
                    label={value}
                    active={specs.includes(value)}
                    onPress={() => toggle(setSpecs, specs, value)}
                    c={c}
                  />
                );
              })}
            </View>
          )}

          {current === 'languages' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {languageOptions.map((code) => {
                const value = code.toLowerCase();
                return (
                  <Chip
                    key={code}
                    label={getLangLabel(code)}
                    active={langs.includes(value)}
                    onPress={() => toggle(setLangs, langs, value)}
                    c={c}
                  />
                );
              })}
            </View>
          )}

          {current === 'city' && (
            <TextInput
              style={[styles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
              value={city}
              onChangeText={setCity}
              placeholder="Stadt"
              placeholderTextColor={c.muted}
              autoCapitalize="words"
            />
          )}

          {current === 'bio' && (
            <View style={{ gap: 12 }}>
              <TextInput
                style={[
                  styles.regInput,
                  {
                    color: c.text,
                    borderColor: c.border,
                    backgroundColor: c.mutedBg,
                    minHeight: 140,
                    textAlignVertical: 'top',
                  },
                ]}
                value={bio}
                onChangeText={setBio}
                placeholder={t('bioShortPlaceholder')}
                placeholderTextColor={c.muted}
                multiline
              />
              <Pressable
                onPress={() => setBio(createBioSuggestion(th, certificationOptions, specializationOptions))}
                style={{ alignItems: 'flex-start' }}
              >
                <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>Vorschlag neu erzeugen</Text>
              </Pressable>
            </View>
          )}

          {!!error && <Text style={{ color: c.error, fontSize: 13, marginTop: 14 }}>{error}</Text>}
        </ScrollView>

        <View style={{ paddingVertical: 12, gap: 10 }}>
          <Pressable
            onPress={handleNext}
            disabled={saving}
            style={[styles.registerBtn, { backgroundColor: saving ? c.border : c.primary, marginTop: 0 }]}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.registerBtnText}>{isLast ? 'Fertig' : 'Weiter'}</Text>}
          </Pressable>
          <Pressable onPress={advance} disabled={saving} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 14, color: c.muted }}>Überspringen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
