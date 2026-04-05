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
    editMode,
    editServiceRadius,
    editSpecializations,
    handleLoadInviteToken,
    handlePickDocument,
    handlePickPhoto,
    handleSaveProfile,
    inviteToken,
    loadAdminPracticeDetail,
    loggedInTherapist,
    profileSaving,
    setAdminPracticeDetail,
    setEditAvailability,
    setEditBio,
    setEditHomeVisit,
    setEditIsVisible,
    setEditKassenart,
    setEditLanguages,
    setEditMode,
    setEditServiceRadius,
    setEditSpecializations,
    setInvitePageTab,
    setPracticeSearchQuery,
    setPracticeSearchResults,
    setShowCreatePractice,
    setShowInvitePage,
    setShowPracticeAdmin,
    setShowPracticeSearch,
    styles,
    t,
    therapistDocuments,
  } = props;

  const th = loggedInTherapist;
  const [photoError, setPhotoError] = useState(false);
  const initials = th.fullName.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase();
  const reviewStatusLabel = th.reviewStatus === 'APPROVED' ? t('statusApproved') : th.reviewStatus === 'CHANGES_REQUESTED' ? t('statusChangesRequested') : t('statusInReview');
  const reviewStatusColor = th.reviewStatus === 'APPROVED' ? c.success : th.reviewStatus === 'CHANGES_REQUESTED' ? c.warning : c.muted;
  const hasPractice = (th.practices ?? []).length > 0;
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
        <Text style={[styles.practiceHeaderName, { color: c.text, marginTop: 10 }]}>{th.fullName}</Text>
        <Text style={[styles.practiceHeaderCity, { color: c.textMuted ?? c.muted }]}>{th.professionalTitle}</Text>
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
            icon="business-outline"
            label={t('practicesLabel')}
            value={hasPractice ? t('linkedLabel') : t('noneLabel')}
            color={hasPractice ? c.success : c.warning}
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

      {(th.practices ?? []).length === 0 && (
        <View style={[{ marginTop: 12, marginHorizontal: 0, borderRadius: RADIUS.md, borderWidth: 1, padding: 16, backgroundColor: c.mutedBg, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 14, marginBottom: 4 }}>{t('noPracticeYet')}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginBottom: 12 }}>
            Du bist noch mit keiner Praxis verknüpft. Erstelle eine eigene Praxis oder verbinde dich mit einer bestehenden.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setShowCreatePractice(true)}
              style={{ flex: 1, backgroundColor: c.primary, borderRadius: RADIUS.sm, paddingVertical: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>＋ Praxis erstellen</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowPracticeSearch(true)}
              style={{ flex: 1, borderRadius: RADIUS.sm, paddingVertical: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border }}
            >
              <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>🔗 Praxis verbinden</Text>
            </Pressable>
          </View>
        </View>
      )}

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
              { key: 'gesetzlich', label: t('kasseGesetzlich') },
              { key: 'privat', label: t('kassePrivat') },
              { key: 'selbstzahler', label: t('kasseSelbstzahler') },
              { key: 'alle', label: t('allOption') },
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
            {(th.practices ?? []).length === 0 && (
              <View style={[styles.detailInfoRow, { marginBottom: 8 }]}>
                <Text style={[styles.detailInfoLabel, { color: c.muted, flex: 1 }]}>{t('homeVisitLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.homeVisit ? t('yesLabel') : t('noLabel')}</Text>
              </View>
            )}
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

          <Pressable style={[styles.registerBtn, { backgroundColor: c.primary }]} onPress={props.onEnterEdit}>
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

          {(th.practices ?? []).length > 0 && (
            <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('practicesLabel')}</Text>
              {(th.practices ?? []).map((practice) => (
                <Pressable key={practice.id} onPress={() => props.openPractice(practice)} style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}>
                  <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                    <Text style={[styles.practiceInitialText, { color: c.muted }]}>{practice.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.practiceName, { color: c.text }]}>{practice.name}</Text>
                    <Text style={[styles.practiceCity, { color: c.muted }]}>{practice.city}</Text>
                    {practice.phone ? <Text style={[styles.practiceCity, { color: c.muted }]}>{practice.phone}</Text> : null}
                  </View>
                  {th.adminPractice?.id === practice.id && (
                    <>
                      <View style={[styles.tag, { backgroundColor: c.successBg }]}>
                        <Text style={{ color: c.success, fontSize: 11 }}>Admin</Text>
                      </View>
                      <Pressable
                        onPress={() => { setInvitePageTab('new'); if (!inviteToken) handleLoadInviteToken(); setShowInvitePage(true); }}
                        style={{ padding: 6 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="person-add-outline" size={18} color={c.primary} />
                      </Pressable>
                      <Pressable
                        onPress={() => { setAdminPracticeDetail(null); loadAdminPracticeDetail(); setShowPracticeAdmin(true); }}
                        style={{ padding: 6 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="settings-outline" size={18} color={c.primary} />
                      </Pressable>
                    </>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {(th.practices ?? []).length === 0 && (
            <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
              <Text style={styles.noticeIcon}>🏥</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.noticeTitle, { color: c.text }]}>{t('noPracticeLinked')}</Text>
                <Text style={[styles.noticeBody, { color: c.muted }]}>{t('noPracticeLinkedBody')}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable
                    onPress={() => { setPracticeSearchQuery(''); setPracticeSearchResults([]); setShowPracticeSearch(true); }}
                    style={[styles.kassenartBtn, { backgroundColor: c.primary, borderColor: c.primary, flex: 1 }]}
                  >
                    <Text style={[styles.kassenartText, { color: '#fff' }]}>{t('searchPracticeBtn')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowCreatePractice(true)}
                    style={[styles.kassenartBtn, { backgroundColor: c.mutedBg, borderColor: c.border, flex: 1 }]}
                  >
                    <Text style={[styles.kassenartText, { color: c.text }]}>{t('newPracticeBtn')}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

export function PracticeAdminScreen(props) {
  const {
    adminPracticeDetail,
    c,
    editPracticeAddress,
    editPracticeCity,
    editPracticeDescription,
    editPracticeHomeVisit,
    editPracticeHours,
    editPracticeLogo,
    editPracticeName,
    editPracticePhone,
    editPracticePhotos,
    handleAddPracticePhoto,
    handleDeletePractice,
    handleLinkAction,
    handleLoadInviteToken,
    handlePickPracticeLogo,
    handleResendInvite,
    handleSavePractice,
    inviteSectionY,
    inviteToken,
    practiceAdminScrollRef,
    practiceEditSaving,
    scrollToInvite,
    setEditPracticeAddress,
    setEditPracticeCity,
    setEditPracticeDescription,
    setEditPracticeHomeVisit,
    setEditPracticeHours,
    setEditPracticeLogo,
    setEditPracticeName,
    setEditPracticePhone,
    setEditPracticePhotos,
    setInvitePageTab,
    setScrollToInvite,
    setShowInvitePage,
    setShowPracticeAdmin,
    styles,
    t,
    openTherapistById,
  } = props;

  const p = adminPracticeDetail;
  const [practiceLogoError, setPracticeLogoError] = useState(false);
  if (!p) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[styles.infoBody, { color: c.muted }]}>{t('loadingLabel')}</Text>
      </View>
    );
  }

  const confirmed = p.links?.filter((link) => link.status === 'CONFIRMED') ?? [];
  const pending = p.links?.filter((link) => link.status === 'PROPOSED') ?? [];

  return (
    <ScrollView
      ref={practiceAdminScrollRef}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
      onLayout={() => {
        if (scrollToInvite && inviteSectionY.current > 0) {
          setTimeout(() => {
            practiceAdminScrollRef.current?.scrollTo({ y: inviteSectionY.current, animated: true });
            setScrollToInvite(false);
          }, 300);
        }
      }}
    >
      <Pressable onPress={() => { setShowPracticeAdmin(false); setEditPracticeName(''); setEditPracticeLogo(null); setEditPracticePhotos([]); }} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
      </Pressable>

      <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border }]}>
        {p.logo && !practiceLogoError ? (
          <Image
            source={{ uri: resolveMediaUrl(p.logo) }}
            style={[styles.practiceHeaderInitial, { borderRadius: RADIUS.md }]}
            onError={() => setPracticeLogoError(true)}
          />
        ) : (
          <View style={[styles.practiceHeaderInitial, { backgroundColor: c.primary }]}>
            <Text style={styles.practiceHeaderInitialText}>{p.name.charAt(0)}</Text>
            <Text style={{ color: '#fff', fontSize: 12 }}>✚</Text>
          </View>
        )}
        <Text style={[styles.practiceHeaderName, { color: c.text, marginTop: 10 }]}>{p.name}</Text>
        <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{p.city}</Text>
        {p.address ? <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{p.address}</Text> : null}
        {p.phone ? <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{p.phone}</Text> : null}
      </View>

      {pending.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: c.text }]}>{t('requestsTitle')} ({pending.length})</Text>
          {pending.map((link) => (
            <View key={link.id} style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => openTherapistById(link.therapist.id)}>
                <Image source={{ uri: link.therapist.photo || `https://i.pravatar.cc/96?u=${link.therapist.id}` }} style={[styles.therapistAvatarSmall, { borderRadius: 20 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.therapistName, { color: c.text }]}>{link.therapist.fullName}</Text>
                  <Text style={[styles.therapistTitle, { color: c.muted }]}>{link.therapist.professionalTitle}</Text>
                </View>
                <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => handleLinkAction(link.id, 'accept')} style={[styles.kassenartBtn, { backgroundColor: c.success, borderColor: c.success, flex: 1 }]}>
                  <Text style={[styles.kassenartText, { color: '#fff' }]}>{t('acceptBtn')}</Text>
                </Pressable>
                <Pressable onPress={() => handleLinkAction(link.id, 'reject')} style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: c.error, flex: 1 }]}>
                  <Text style={[styles.kassenartText, { color: c.error }]}>{t('rejectBtn')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={[styles.sectionLabel, { color: c.text }]}>{t('therapistsLabel')} ({confirmed.length})</Text>
      {confirmed.map((link) => {
        const therapist = link.therapist;
        const isInvited = therapist.invitedByPracticeId === p.id;
        const statusLabel = isInvited
          ? therapist.onboardingStatus === 'invited' ? t('invitePending')
            : therapist.onboardingStatus === 'claimed' ? t('profileFilling')
            : therapist.isPublished ? t('publishedLabel') : t('profileComplete')
          : null;
        const statusColor = therapist.onboardingStatus === 'invited'
          ? c.warning
          : therapist.onboardingStatus === 'claimed'
            ? c.primary
            : c.success;

        return (
          <View key={link.id} style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 0 }]}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => openTherapistById(therapist.id)}>
              <Image source={{ uri: therapist.photo || `https://i.pravatar.cc/96?u=${therapist.id}` }} style={[styles.therapistAvatarSmall, { borderRadius: 20 }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.therapistName, { color: c.text }]}>{therapist.fullName}</Text>
                <Text style={[styles.therapistTitle, { color: c.muted }]}>{therapist.professionalTitle}</Text>
                <Text style={{ fontSize: 12, color: c.muted }}>{therapist.email}</Text>
                {statusLabel && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
                    <Text style={{ fontSize: 11, color: statusColor, fontWeight: '600' }}>{statusLabel}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
            {isInvited && therapist.onboardingStatus === 'invited' && (
              <Pressable onPress={() => handleResendInvite(therapist.id)} style={{ marginTop: 10, paddingVertical: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: c.border }}>
                <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>{t('resendInviteBtn')}</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      {confirmed.length === 0 && pending.length === 0 && (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('noTherapistsYet')}</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>{t('noTherapistsYetBody')}</Text>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: c.text }]}>{t('editPracticeData')}</Text>
      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
        {[
          { label: t('nameLabel') + ' *', value: editPracticeName, setter: setEditPracticeName, placeholder: t('practiceNamePlaceholder') },
          { label: t('cityPlaceholder') + ' *', value: editPracticeCity, setter: setEditPracticeCity, placeholder: t('cityPlaceholder') },
          { label: t('addressLabel'), value: editPracticeAddress, setter: setEditPracticeAddress, placeholder: t('addressPlaceholder') },
          { label: t('phoneLabel'), value: editPracticePhone, setter: setEditPracticePhone, placeholder: t('phonePlaceholder'), keyboard: 'phone-pad' },
          { label: t('hoursLabel'), value: editPracticeHours, setter: setEditPracticeHours, placeholder: t('hoursPlaceholder') },
        ].map(({ label, value, setter, placeholder, keyboard = 'default' }) => (
          <View key={label}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{label}</Text>
            <TextInput
              style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
              value={value}
              onChangeText={setter}
              placeholder={placeholder}
              placeholderTextColor={c.muted}
              keyboardType={keyboard}
            />
          </View>
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, marginTop: 4 }}>
          <Text style={[styles.filterSectionTitle, { color: c.text }]}>{t('homeVisitsSwitch')}</Text>
          <Switch value={editPracticeHomeVisit} onValueChange={setEditPracticeHomeVisit} trackColor={{ true: c.primary }} />
        </View>

        <View>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('descriptionLabel')}</Text>
          <TextInput
            style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, minHeight: 90, textAlignVertical: 'top' }]}
            value={editPracticeDescription}
            onChangeText={setEditPracticeDescription}
            placeholder={t('practiceIntroPlaceholder')}
            placeholderTextColor={c.muted}
            multiline
          />
        </View>

        <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('logoLabel')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {editPracticeLogo ? (
            <Image source={{ uri: editPracticeLogo }} style={{ width: 64, height: 64, borderRadius: RADIUS.sm }} />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: RADIUS.sm, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{editPracticeName.charAt(0) || '?'}</Text>
              <Text style={{ color: '#fff', fontSize: 10 }}>✚</Text>
            </View>
          )}
          <Pressable onPress={handlePickPracticeLogo} style={[styles.kassenartBtn, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
            <Text style={[styles.kassenartText, { color: c.text }]}>{t('changeLogoBtn')}</Text>
          </Pressable>
          {editPracticeLogo && (
            <Pressable onPress={() => setEditPracticeLogo(null)} style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: c.error }]}>
              <Text style={[styles.kassenartText, { color: c.error }]}>{t('removeBtn')}</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>{t('practicePhotosLabel')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {editPracticePhotos.map((photo, index) => (
            <View key={index} style={{ position: 'relative' }}>
              <Image source={{ uri: photo }} style={{ width: 80, height: 80, borderRadius: RADIUS.sm }} />
              <Pressable
                onPress={() => setEditPracticePhotos((prev) => prev.filter((_, photoIndex) => photoIndex !== index))}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ position: 'absolute', top: -6, right: -6, backgroundColor: c.error, borderRadius: RADIUS.sm, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={handleAddPracticePhoto} style={{ width: 80, height: 80, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: c.mutedBg }}>
            <Text style={{ color: c.muted, fontSize: 28 }}>＋</Text>
          </Pressable>
        </View>

        <Pressable onPress={handleSavePractice} style={[styles.kassenartBtn, { backgroundColor: c.primary, borderColor: c.primary, marginTop: 4 }]}>
          <Text style={[styles.kassenartText, { color: '#fff' }]}>
            {practiceEditSaving ? t('savingBtn') : t('saveBtn')}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onLayout={(event) => { inviteSectionY.current = event.nativeEvent.layout.y; }}
        onPress={() => { setInvitePageTab('new'); if (!inviteToken) handleLoadInviteToken(); setShowInvitePage(true); }}
        style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: c.border, alignSelf: 'flex-start', marginBottom: 8 }]}
      >
        <Text style={[styles.kassenartText, { color: c.muted }]}>{t('inviteTherapistBtn')}</Text>
      </Pressable>

      <Pressable onPress={handleDeletePractice} style={{ marginTop: 8, marginBottom: 8, alignItems: 'center', paddingVertical: 14 }}>
        <Text style={{ color: c.muted, fontSize: 14 }}>{t('deletePracticeBtn')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function LangMultiselect({ editLanguages, setEditLanguages, c, styles, t }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const suggestions = languageOptions.filter((code) => {
    if (editLanguages.includes(code)) return false;
    if (!q) return true;
    return code.toLowerCase().includes(q) || getLangLabel(code).toLowerCase().includes(q);
  }).slice(0, 8);

  return (
    <View>
      {editLanguages.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {editLanguages.map((code) => (
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
