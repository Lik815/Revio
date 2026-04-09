import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

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
    editHomeVisit,
    editIsVisible,
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
    setEditHomeVisit,
    setEditIsVisible,
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
  } = props;

  const [photoError, setPhotoError] = useState(false);
  const th = loggedInTherapist;
  if (!th) return null;
  const fullName = typeof th.fullName === 'string' && th.fullName.trim() ? th.fullName.trim() : 'Profil';
  const initials = fullName.split(/\s+/).map((name) => name[0]).join('').slice(0, 2).toUpperCase();
  const reviewStatusLabel = th.reviewStatus === 'APPROVED' ? t('statusApproved') : th.reviewStatus === 'CHANGES_REQUESTED' ? t('statusChangesRequested') : t('statusInReview');
  const reviewStatusColor = th.reviewStatus === 'APPROVED' ? c.success : th.reviewStatus === 'CHANGES_REQUESTED' ? c.warning : c.muted;
  const hasDocuments = (therapistDocuments ?? []).length > 0;
  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center' }]}>
        <Pressable onPress={handlePickPhoto} style={{ position: 'relative' }}>
          {th.photo && !photoError ? (
            <Image source={{ uri: th.photo }} style={[styles.therapistAvatarLarge, { borderRadius: 48 }]} onError={() => setPhotoError(true)} />
          ) : (
            <View style={[styles.therapistAvatarLarge, { borderRadius: 48, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>{initials}</Text>
            </View>
          )}
          <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: c.accent, borderRadius: 12, padding: 4 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>📷</Text>
          </View>
        </Pressable>
        <Text style={[styles.practiceHeaderName, { color: c.text, marginTop: 10 }]}>{fullName}</Text>
        <Text style={[styles.practiceHeaderCity, { color: c.textMuted ?? c.muted }]}>{th.professionalTitle ?? ''}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm, width: '100%' }}>
          <StatusMiniCard
            icon="shield-checkmark-outline"
            label={t('reviewStatusLabel')}
            value={reviewStatusLabel}
            color={reviewStatusColor}
            c={c}
          />
          <StatusMiniCard
            icon="eye-outline"
            label={t('visibleLabel')}
            value={th.isVisible ? t('yesLabel') : t('hiddenLabel')}
            color={th.isVisible ? c.success : c.muted}
            c={c}
          />
          <StatusMiniCard
            icon="home-outline"
            label={t('homeVisitLabel')}
            value={th.homeVisit ? t('yesLabel') : t('noLabel')}
            color={th.homeVisit ? c.success : c.muted}
            c={c}
          />
          <StatusMiniCard
            icon="document-outline"
            label={t('documentsTitle')}
            value={hasDocuments ? t('existsLabel') : t('missingLabel')}
            color={hasDocuments ? c.success : c.warning}
            c={c}
          />
        </View>
      </View>

      {editMode ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('aboutLabel')}</Text>
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
            <Switch value={editIsVisible} onValueChange={setEditIsVisible} trackColor={{ true: c.primary }} />
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
          {th.bio ? (
            <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('aboutLabel')}</Text>
              <Text style={[styles.infoBody, { color: c.text }]}>{th.bio}</Text>
            </View>
          ) : null}

          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('specsLabel')}</Text>
            <View style={styles.tagRow}>
              {(th.specializations ?? []).map((specialization) => (
                <View key={specialization} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                  <Text style={[styles.tagText, { color: c.text }]}>{specialization}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('languagesLabel')}</Text>
            <View style={styles.tagRow}>
              {(th.languages ?? []).map((language) => (
                <View key={language} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                  <Text style={[styles.tagText, { color: c.muted }]}>{getLangLabel(language)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.detailInfoRow, { marginBottom: 8 }]}>
              <Text style={[styles.detailInfoLabel, { color: c.muted, flex: 1 }]}>{t('homeVisitLabel')}</Text>
              <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.homeVisit ? t('yesLabel') : t('noLabel')}</Text>
            </View>
            {th.homeVisit && th.serviceRadiusKm ? (
              <View style={[styles.detailInfoRow, { marginTop: 8 }]}>
                <Text style={[styles.detailInfoLabel, { color: c.muted, flex: 1 }]}>{t('serviceAreaLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{t('serviceAreaValue').replace('{radius}', th.serviceRadiusKm)}</Text>
              </View>
            ) : null}
            {th.availability ? (
              <View style={[styles.detailInfoRow, { marginTop: 8 }]}>
                <Text style={[styles.detailInfoLabel, { color: c.muted, flex: 1 }]}>{t('availabilityLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.availability}</Text>
              </View>
            ) : null}
            <View style={[styles.detailInfoRow, { marginTop: 8 }]}>
              <Text style={[styles.detailInfoLabel, { color: c.muted, flex: 1 }]}>E-Mail</Text>
              <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.email}</Text>
            </View>
          </View>

          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('complianceSectionTitle')}</Text>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
              {t('complianceSectionBody')}
            </Text>
            <View style={[styles.detailInfoRow, { marginBottom: 8 }]}>
              <Text style={[styles.detailInfoLabel, { color: c.muted, flex: 1 }]}>{t('taxRegistrationLabel')}</Text>
              <Text style={[styles.detailInfoValue, { color: c.text }]}>
                {getComplianceStatusLabel(th.compliance?.taxRegistrationStatus, t)}
              </Text>
            </View>
            <View style={[styles.detailInfoRow, { marginTop: 8 }]}>
              <Text style={[styles.detailInfoLabel, { color: c.muted, flex: 1 }]}>{t('healthAuthorityLabel')}</Text>
              <Text style={[styles.detailInfoValue, { color: c.text }]}>
                {getComplianceStatusLabel(th.compliance?.healthAuthorityStatus, t)}
              </Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 12 }}>
              {t('complianceDisclaimer')}
            </Text>
          </View>

          <Pressable style={[styles.registerBtn, { backgroundColor: c.primary }]} onPress={onEnterEdit}>
            <Text style={styles.registerBtnText}>{t('editProfileBtn')}</Text>
          </Pressable>

          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('documentsTitle')}</Text>
            {(therapistDocuments ?? []).length > 0 && (
              <View style={{ marginBottom: 12 }}>
                {(therapistDocuments ?? []).map((doc) => (
                  <View
                    key={doc.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}
                  >
                    <Text style={{ fontSize: 16 }}>{doc.mimetype === 'application/pdf' ? '📄' : '🖼️'}</Text>
                    <Text style={{ flex: 1, fontSize: 13, color: c.text }} numberOfLines={1}>{doc.originalName}</Text>
                  </View>
                ))}
              </View>
            )}
            <Pressable
              onPress={handlePickDocument}
              disabled={documentUploading}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, paddingVertical: 10, paddingHorizontal: 14,
                borderRadius: RADIUS.sm, borderWidth: 1,
                borderColor: documentUploading ? c.border : c.primary,
                borderStyle: 'dashed',
              }}
            >
              {documentUploading ? (
                <Text style={{ color: c.muted, fontSize: 13 }}>{t('uploadingDoc')}</Text>
              ) : (
                <>
                  <Ionicons name="attach-outline" size={18} color={c.primary} />
                  <Text style={{ color: c.primary, fontWeight: '600', fontSize: 13 }}>{t('uploadDocBtn')}</Text>
                </>
              )}
            </Pressable>
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>
              {t('documentsHint')}
            </Text>
          </View>
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
  const suggestions = languageOptions.filter((code) => {
    if (selectedLanguages.includes(code)) return false;
    if (!q) return true;
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
