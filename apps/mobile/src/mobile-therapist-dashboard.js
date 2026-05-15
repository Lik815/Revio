import React, { useState } from 'react';
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
import { TherapistSlotComposer } from './mobile-slot-composer';

import {
  getLangLabel,
  languageOptions,
  RADIUS,
  resolveMediaUrl,
  SPACE,
  TYPE,
} from './mobile-utils';
import {
  ComplianceStatusStep,
  getComplianceStatusLabel,
} from './mobile-compliance-step';

const LANG_FLAGS = {
  DE: '🇩🇪', EN: '🇬🇧', FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹',
  TR: '🇹🇷', AR: '🇸🇦', PL: '🇵🇱', RU: '🇷🇺', SR: '🇷🇸',
  PT: '🇵🇹', NL: '🇳🇱', UK: '🇺🇦', HR: '🇭🇷', BS: '🇧🇦',
  CS: '🇨🇿', SK: '🇸🇰', HU: '🇭🇺', RO: '🇷🇴', BG: '🇧🇬',
  EL: '🇬🇷', SQ: '🇦🇱', FA: '🇮🇷', UR: '🇵🇰', HI: '🇮🇳',
  ZH: '🇨🇳', JA: '🇯🇵', KO: '🇰🇷', VI: '🇻🇳', DA: '🇩🇰',
  SV: '🇸🇪', FI: '🇫🇮',
};

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

export function TherapistDashboardScreen(props) {
  const {
    c,
    documentUploading,
    editAvailability,
    editBio,
    editPhone,
    editHomeVisit,
    editIsVisible,
    editGender,
    editKassenart,
    editLanguages,
    editHealthAuthorityStatus,
    editMode,
    editServiceRadius,
    editSpecializations,
    editTaxRegistrationStatus,
    handlePickDocument,
    handlePickPhoto,
    handleSaveProfile,
    loggedInTherapist,
    onEnterEdit,
    profileSaving,
    setEditAvailability,
    setEditBio,
    setEditPhone,
    setEditHomeVisit,
    setEditIsVisible,
    setEditGender,
    setEditKassenart,
    setEditLanguages,
    setEditHealthAuthorityStatus,
    setEditMode,
    setEditServiceRadius,
    setEditSpecializations,
    setEditTaxRegistrationStatus,
    styles,
    t,
    therapistDocuments,
    editBookingMode,
    setEditBookingMode,
    editCertifications,
    setEditCertifications,
    certificationOptions,
    onOpenTherapyTab,
    onAddSlot,
    editCity,
    setEditCity,
    editPostalCode,
    setEditPostalCode,
    editStreet,
    setEditStreet,
    editHouseNumber,
    setEditHouseNumber,
    editLocationPrecision,
    setEditLocationPrecision,
  } = props;

  const [photoError, setPhotoError] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  const th = loggedInTherapist;
  if (!th) return null;
  const fullName = typeof th.fullName === 'string' && th.fullName.trim() ? th.fullName.trim() : 'Profil';
  const initials = fullName.split(/\s+/).map((name) => name[0]).join('').slice(0, 2).toUpperCase();
  const isApproved = th.reviewStatus === 'APPROVED';
  const docCount = (therapistDocuments ?? []).length;
  const docTotal = 2;

  const statusChips = [
    { icon: 'shield-checkmark-outline', label: isApproved ? t('statusApproved') : t('statusInReview'), color: isApproved ? c.success : c.muted },
    { icon: 'eye-outline', label: `Sichtbar: ${th.isVisible ? 'Ja' : 'Nein'}`, color: th.isVisible ? c.success : c.muted },
    ...(th.homeVisit ? [{ icon: 'home-outline', label: t('homeVisitLabel'), color: c.success }] : []),
    { icon: 'document-outline', label: docCount > 0 ? t('existsLabel') : t('missingLabel'), color: docCount > 0 ? c.success : c.warning ?? '#d97706' },
  ];

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40, paddingTop: 60 }]}>

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
            onPress={editMode ? () => setEditMode(false) : onEnterEdit}
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {[
              { key: 'privat', label: t('kassePrivat') },
              { key: 'selbstzahler', label: t('kasseSelbstzahler') },
            ].map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setEditKassenart(option.key)}
                style={[styles.kassenartBtn, {
                  backgroundColor: editKassenart === option.key ? c.primary : c.mutedBg,
                  borderColor: editKassenart === option.key ? c.primary : c.border,
                }]}
              >
                <Text style={[styles.kassenartText, { color: editKassenart === option.key ? '#fff' : c.text }]}>
                  {option.label}
                </Text>
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
              onValueChange={(val) => setEditBookingMode(val ? 'FIRST_APPOINTMENT_REQUEST' : 'DIRECTORY_ONLY')}
              trackColor={{ true: c.primary }}
            />
          </View>
          {loggedInTherapist?.reviewStatus !== 'APPROVED' && (
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 4, marginBottom: 4 }}>
              Sichtbarkeit wird nach der Freigabe durch Revio aktiviert.
            </Text>
          )}
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
                    <Text style={{ fontSize: 15 }}>{doc.mimetype === 'application/pdf' ? '📄' : '🖼️'}</Text>
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
