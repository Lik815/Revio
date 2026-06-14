import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BackButton } from './BackButton';
import {
  getBaseUrl, getLangLabel, kassenartOptions, languageOptions,
  normalizeLanguageCodes, RADIUS, regSpecOptions, resolveMediaUrl, SPACE, TUNNEL_HEADERS,
} from '../utils/app-utils';

// Canonical order of the steps; only the items still missing are shown.
const STEP_ORDER = [
  'photo', 'certifications', 'kassenart', 'homeVisitRadius',
  'address', 'specializations', 'languages', 'city',
];
const RADIUS_OPTIONS = [5, 10, 15, 20, 30, 50];
const KASSENART_CHOICES = kassenartOptions.filter((o) => o.key);

const STEP_META = {
  photo: { title: 'Profilfoto', sub: 'Ein Foto schafft Vertrauen bei Patient:innen.' },
  certifications: { title: 'Fortbildungen', sub: 'Wähle deine Qualifikationen und Fortbildungen.' },
  kassenart: { title: 'Abrechnungsart', sub: 'Wie rechnest du mit Patient:innen ab?' },
  homeVisitRadius: { title: 'Hausbesuche', sub: 'Bietest du Hausbesuche an? In welchem Umkreis?' },
  address: { title: 'Adresse', sub: 'Deine Praxis- oder Arbeitsadresse.' },
  specializations: { title: 'Spezialisierungen', sub: 'Wähle deine fachlichen Schwerpunkte.' },
  languages: { title: 'Sprachen', sub: 'In welchen Sprachen behandelst du?' },
  city: { title: 'Stadt', sub: 'In welcher Stadt arbeitest du?' },
};

function Chip({ label, active, onPress, c }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1,
        borderColor: active ? c.primary : c.border,
        backgroundColor: active ? c.primaryBg : c.card,
      }}
    >
      {active && <Ionicons name="checkmark" size={14} color={c.primary} />}
      <Text style={{ fontSize: 13, color: active ? c.primary : c.text, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

// Step-by-step "complete your profile" flow. Walks only through the items the
// dashboard checklist reports as missing, saving each step before advancing.
export function ProfileCompletionWizard({ visible, onClose, th, authToken, certificationOptions, onRefresh, c, t, styles }) {
  const steps = useMemo(() => {
    const missing = new Set(th?.profileCompletion?.missingItems ?? []);
    return STEP_ORDER.filter((k) => missing.has(k));
    // Snapshot at open: keyed on `visible` so it does not reshuffle after each save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Field state
  const [photoUrl, setPhotoUrl] = useState(null);
  const [certs, setCerts] = useState([]);
  const [kassenart, setKassenart] = useState('');
  const [homeVisit, setHomeVisit] = useState(false);
  const [serviceRadius, setServiceRadius] = useState(null);
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [locationPrecision, setLocationPrecision] = useState('approximate');
  const [specs, setSpecs] = useState([]);
  const [langs, setLangs] = useState([]);
  const [city, setCity] = useState('');

  useEffect(() => {
    if (!visible || !th) return;
    setIndex(0);
    setError('');
    setSaving(false);
    setPhotoUrl(th.photo ?? null);
    setCerts(Array.isArray(th.certifications) ? th.certifications : []);
    setKassenart(th.kassenart ?? '');
    setHomeVisit(th.homeVisit ?? false);
    setServiceRadius(th.serviceRadiusKm ?? null);
    setStreet(th.street ?? '');
    setHouseNumber(th.houseNumber ?? '');
    setLocationPrecision(th.locationPrecision ?? 'approximate');
    setSpecs(Array.isArray(th.specializations) ? th.specializations : []);
    setLangs(normalizeLanguageCodes(th.languages).map((l) => l.toLowerCase()));
    setCity(th.city ?? '');
  }, [visible, th?.id]);

  if (!visible) return null;
  if (steps.length === 0) { onClose?.(); return null; }

  const current = steps[index];
  const isLast = index === steps.length - 1;

  const toggle = (setter, list, value) =>
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const validate = () => {
    switch (current) {
      case 'photo': return !!photoUrl;
      case 'certifications': return certs.length > 0;
      case 'kassenart': return !!kassenart;
      case 'homeVisitRadius': return !homeVisit || !!serviceRadius;
      case 'address': return !!street.trim() && !!houseNumber.trim();
      case 'specializations': return specs.length > 0;
      case 'languages': return langs.length > 0;
      case 'city': return !!city.trim();
      default: return true;
    }
  };

  const buildPayload = () => {
    switch (current) {
      case 'certifications': return { certifications: certs };
      case 'kassenart': return { kassenart };
      case 'homeVisitRadius': return { homeVisit, serviceRadiusKm: homeVisit ? serviceRadius : null };
      case 'address': return { street: street.trim() || null, houseNumber: houseNumber.trim() || null, locationPrecision };
      case 'specializations': return { specializations: specs };
      case 'languages': return { languages: langs.map((l) => l.toLowerCase()) };
      case 'city': return { city: city.trim() };
      default: return null;
    }
  };

  const pickPhoto = async () => {
    setError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('photo', { uri: asset.uri, name: asset.uri.split('/').pop() || 'photo.jpg', type: asset.mimeType || 'image/jpeg' });
      const res = await fetch(`${getBaseUrl()}/upload/photo`, {
        method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: fd,
      });
      if (!res.ok) { setError('Foto konnte nicht hochgeladen werden.'); return; }
      const { url } = await res.json();
      // The upload endpoint may return a relative path — resolve it to a full URL.
      setPhotoUrl(resolveMediaUrl(url) ?? url);
      await onRefresh?.();
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setSaving(false);
    }
  };

  const advance = () => {
    if (isLast) onClose?.();
    else { setIndex((i) => i + 1); setError(''); }
  };

  const handleNext = async () => {
    setError('');
    if (!validate()) { setError('Bitte fülle diesen Schritt aus.'); return; }
    if (current === 'photo') { advance(); return; } // already uploaded on pick
    const payload = buildPayload();
    setSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? 'Speichern fehlgeschlagen.');
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

        {/* Progress */}
        <View style={{ marginBottom: SPACE.md }}>
          <Text style={{ fontSize: 13, color: c.muted }}>{`Schritt ${index + 1} von ${steps.length}`}</Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.mutedBg, overflow: 'hidden', marginTop: 6 }}>
            <View style={{ width: `${((index + 1) / steps.length) * 100}%`, height: '100%', backgroundColor: c.primary }} />
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
                <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: c.mutedBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person-outline" size={48} color={c.muted} />
                </View>
              )}
              <Pressable onPress={pickPhoto} style={[styles.registerBtn, { backgroundColor: c.primary, paddingHorizontal: 24 }]}>
                <Text style={styles.registerBtnText}>{photoUrl ? 'Anderes Foto wählen' : 'Foto auswählen'}</Text>
              </Pressable>
            </View>
          )}

          {current === 'certifications' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(certificationOptions ?? []).map((opt) => (
                <Chip key={opt.key} label={opt.label} active={certs.includes(opt.key)} onPress={() => toggle(setCerts, certs, opt.key)} c={c} />
              ))}
            </View>
          )}

          {current === 'kassenart' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {KASSENART_CHOICES.map((opt) => (
                <Chip key={opt.key} label={opt.label} active={kassenart === opt.key} onPress={() => setKassenart(opt.key)} c={c} />
              ))}
            </View>
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
                      <Chip key={km} label={`${km} km`} active={serviceRadius === km} onPress={() => setServiceRadius(km)} c={c} />
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
                  value={street} onChangeText={setStreet} placeholder="Straße" placeholderTextColor={c.muted}
                />
                <TextInput
                  style={[styles.regInput, { width: 90, color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
                  value={houseNumber} onChangeText={setHouseNumber} placeholder="Nr." placeholderTextColor={c.muted}
                />
              </View>
              <View style={{ gap: 8 }}>
                {[
                  { value: 'approximate', label: 'Nur ungefähre Umgebung', sub: 'Deine genaue Adresse bleibt privat' },
                  { value: 'exact', label: 'Exakte Adresse', sub: 'Dein genauer Standort wird öffentlich angezeigt' },
                ].map((opt) => {
                  const active = locationPrecision === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setLocationPrecision(opt.value)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primaryBg : c.mutedBg }}
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
            </View>
          )}

          {current === 'specializations' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {regSpecOptions.map((spec) => (
                <Chip key={spec} label={spec} active={specs.includes(spec)} onPress={() => toggle(setSpecs, specs, spec)} c={c} />
              ))}
            </View>
          )}

          {current === 'languages' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {languageOptions.map((code) => {
                const lc = code.toLowerCase();
                return (
                  <Chip key={code} label={getLangLabel(code)} active={langs.includes(lc)} onPress={() => toggle(setLangs, langs, lc)} c={c} />
                );
              })}
            </View>
          )}

          {current === 'city' && (
            <TextInput
              style={[styles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
              value={city} onChangeText={setCity} placeholder="Stadt" placeholderTextColor={c.muted} autoCapitalize="words"
            />
          )}

          {!!error && <Text style={{ color: c.error, fontSize: 13, marginTop: 14 }}>{error}</Text>}
        </ScrollView>

        {/* Footer */}
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
