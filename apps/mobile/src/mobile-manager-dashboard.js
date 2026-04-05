import React from 'react';
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
  formatMissingProfileFields,
  getBaseUrl,
  RADIUS,
  resolveMediaUrl,
  SPACE,
  TYPE,
} from './mobile-utils';

const getStatusLabels = (t) => ({
  APPROVED: t('statusApproved'),
  PENDING_REVIEW: t('statusInReview'),
  DRAFT: t('statusDraft'),
  REJECTED: t('statusRejected'),
  SUSPENDED: t('statusSuspended'),
  CHANGES_REQUESTED: t('statusChangesRequested'),
});

export function ManagerDashboardContent(props) {
  const {
    activePracticeId,
    c,
    handleAddManagerPracticePhoto,
    handleDeleteManagerPractice,
    handleManagerPracticeSave,
    handleManagerProfilePublication,
    handleManagerProfileSave,
    handlePickManagerPracticeLogo,
    handleRemoveTherapist,
    loggedInManager,
    mgrEditAddress,
    mgrEditCity,
    mgrEditDescription,
    mgrEditHomeVisit,
    mgrEditHours,
    mgrEditLogo,
    mgrEditMode,
    mgrEditName,
    mgrEditPhone,
    mgrEditPhotos,
    mgrEditSaving,
    mgrProfileBio,
    mgrProfileEditMode,
    mgrProfileFullName,
    mgrProfileIsVisible,
    mgrProfileLanguages,
    mgrProfilePublishLoading,
    mgrProfileSaving,
    mgrProfileSpecializations,
    mgrProfileTitle,
    removingTherapistId,
    setActivePracticeId,
    setMgrEditAddress,
    setMgrEditCity,
    setMgrEditDescription,
    setMgrEditHomeVisit,
    setMgrEditHours,
    setMgrEditLogo,
    setMgrEditMode,
    setMgrEditName,
    setMgrEditPhone,
    setMgrEditPhotos,
    setMgrProfileBio,
    setMgrProfileEditMode,
    setMgrProfileFullName,
    setMgrProfileIsVisible,
    setMgrProfileLanguages,
    setMgrProfileSpecializations,
    setMgrProfileTitle,
    setShowInvitePage,
    setInvitePageTab,
    setInviteToken,
    styles,
    t,
  } = props;

  const [managerProfileExpanded, setManagerProfileExpanded] = React.useState(false);
  const mgr = loggedInManager;
  const practices = mgr?.practices ?? [];
  const practice = practices.find((p) => p.id === activePracticeId) ?? practices[0] ?? null;
  let practicePhotos = [];
  if (typeof practice?.photos === 'string') {
    try {
      practicePhotos = JSON.parse(practice.photos);
    } catch {}
  } else if (Array.isArray(practice?.photos)) {
    practicePhotos = practice.photos;
  }

  const therapists = practice?.therapists ?? [];
  const managerProfile = mgr?.therapistProfile ?? null;
  const managerProfileMissingFields = formatMissingProfileFields(managerProfile?.missingFields ?? []);
  const managerProfileIsReady = !!managerProfile?.complete;
  const managerProfileIsPublic = !!managerProfile?.publicSearchEligible;
  const reviewStatus = practice?.reviewStatus ?? 'DRAFT';
  const statusColors = {
    APPROVED: { bg: c.successBg, text: c.success },
    PENDING_REVIEW: { bg: c.warningBg, text: c.warning },
    DRAFT: { bg: c.mutedBg, text: c.muted },
    REJECTED: { bg: c.errorBg, text: c.error },
    SUSPENDED: { bg: c.errorBg, text: c.error },
    CHANGES_REQUESTED: { bg: c.warningBg, text: c.warning },
  };
  const statusStyle = statusColors[reviewStatus] ?? statusColors.DRAFT;

  React.useEffect(() => {
    if (!managerProfile) {
      setManagerProfileExpanded(false);
      return;
    }
    if (!managerProfileIsReady) {
      setManagerProfileExpanded(true);
    }
  }, [managerProfile, managerProfileIsReady]);

  React.useEffect(() => {
    if (mgrProfileEditMode) setManagerProfileExpanded(true);
  }, [mgrProfileEditMode]);

  if (!mgr) return null;

  const renderManagerProfileSection = () => {
    if (!mgr.isTherapist || !mgr.therapistProfile) return null;

    return (
      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('myProfileLabel')}</Text>
          {!mgrProfileEditMode ? (
            <Pressable
              onPress={() => {
                if (managerProfileIsReady && !managerProfileExpanded) {
                  setManagerProfileExpanded(true);
                  return;
                }
                const profile = mgr.therapistProfile;
                setMgrProfileFullName(profile.fullName ?? '');
                setMgrProfileTitle(profile.professionalTitle ?? '');
                setMgrProfileBio(profile.bio ?? '');
                setMgrProfileSpecializations(profile.specializations ?? '');
                setMgrProfileLanguages(profile.languages ?? '');
                setMgrProfileIsVisible(profile.isVisible ?? false);
                setMgrProfileEditMode(true);
                setManagerProfileExpanded(true);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name={managerProfileIsReady && !managerProfileExpanded ? 'chevron-down-outline' : 'pencil-outline'} size={15} color={c.primary} />
              <Text style={{ ...TYPE.meta, color: c.primary, fontWeight: '600' }}>
                {managerProfileIsReady && !managerProfileExpanded ? t('showBtn') : t('editBtn')}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setMgrProfileEditMode(false)}>
              <Text style={{ ...TYPE.meta, color: c.muted }}>{t('cancelBtn')}</Text>
            </Pressable>
          )}
        </View>

        {!mgrProfileEditMode && managerProfileIsReady && !managerProfileExpanded ? (
          <Pressable
            onPress={() => setManagerProfileExpanded(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            {mgr.therapistProfile.photo ? (
              <Image
                source={{
                  uri: mgr.therapistProfile.photo.startsWith('http')
                    ? mgr.therapistProfile.photo
                    : `${getBaseUrl()}${mgr.therapistProfile.photo}`,
                }}
                style={{ width: 56, height: 56, borderRadius: RADIUS.full }}
              />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', ...TYPE.heading, fontWeight: '700' }}>
                  {(mgr.therapistProfile.fullName ?? '?').split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...TYPE.heading, color: c.text }}>{mgr.therapistProfile.fullName}</Text>
              <Text style={{ ...TYPE.meta, color: c.textMuted ?? c.muted }}>{mgr.therapistProfile.professionalTitle}</Text>
              <Text style={{ ...TYPE.meta, color: managerProfileIsPublic ? c.success : c.textMuted ?? c.muted }}>
                {managerProfileIsPublic ? t('publiclyVisible') : t('notPublicYet')}
              </Text>
            </View>
            <Ionicons name="chevron-down-outline" size={18} color={c.primary} />
          </Pressable>
        ) : !mgrProfileEditMode ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            {mgr.therapistProfile.photo ? (
              <Image
                source={{
                  uri: mgr.therapistProfile.photo.startsWith('http')
                    ? mgr.therapistProfile.photo
                    : `${getBaseUrl()}${mgr.therapistProfile.photo}`,
                }}
                style={{ width: 56, height: 56, borderRadius: RADIUS.full }}
              />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', ...TYPE.heading, fontWeight: '700' }}>
                  {(mgr.therapistProfile.fullName ?? '?').split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ ...TYPE.heading, color: c.text }}>{mgr.therapistProfile.fullName}</Text>
              <Text style={{ ...TYPE.meta, color: c.textMuted ?? c.muted }}>{mgr.therapistProfile.professionalTitle}</Text>
              {!!mgr.therapistProfile.bio && (
                <Text style={{ ...TYPE.meta, color: c.text, marginTop: 6 }} numberOfLines={3}>
                  {mgr.therapistProfile.bio}
                </Text>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <View style={{ backgroundColor: mgr.therapistProfile.isVisible ? c.successBg : c.mutedBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ ...TYPE.label, color: mgr.therapistProfile.isVisible ? c.success : c.muted, fontSize: 11, lineHeight: 11, textTransform: 'none' }}>
                    {mgr.therapistProfile.isVisible ? t('visibleLabel') : t('hiddenLabel')}
                  </Text>
                </View>
                <View style={{ backgroundColor: mgr.therapistProfile.isPublished ? c.successBg : c.mutedBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ ...TYPE.label, color: mgr.therapistProfile.isPublished ? c.success : c.muted, fontSize: 11, lineHeight: 11, textTransform: 'none' }}>
                    {mgr.therapistProfile.isPublished ? t('publishedLabel') : t('notPublished')}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 12, backgroundColor: managerProfileIsPublic ? c.successBg : c.mutedBg, borderRadius: RADIUS.md, padding: 12 }}>
                <Text style={{ ...TYPE.meta, color: managerProfileIsPublic ? c.success : c.text, fontWeight: '700' }}>
                  {managerProfileIsPublic ? t('publiclyVisible') : t('notPublicYet')}
                </Text>
                <Text style={{ ...TYPE.meta, color: c.textMuted ?? c.muted, marginTop: 4 }}>
                  {managerProfileIsPublic
                    ? t('profileInSearchInfo')
                    : !managerProfile?.reviewApproved
                      ? t('profilePendingReview')
                      : !managerProfile?.isVisible
                        ? t('profileHiddenByYou')
                        : !managerProfileIsReady
                          ? t('profileMissingFields')
                          : !managerProfile?.isPublished
                            ? t('profileNotPublished')
                            : t('profileNotVisibleGeneric')}
                </Text>
                {!managerProfileIsReady && managerProfileMissingFields.length > 0 && (
                  <Text style={{ ...TYPE.meta, color: c.text, marginTop: 8 }}>
                    {t('missingFieldsLabel')}: {managerProfileMissingFields.join(', ')}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={() => handleManagerProfilePublication('visible')}
                  style={{ flex: 1, backgroundColor: (!managerProfile?.reviewApproved || mgrProfilePublishLoading) ? c.border : c.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', opacity: !managerProfile?.reviewApproved ? 0.7 : 1 }}
                  disabled={!managerProfile?.reviewApproved || mgrProfilePublishLoading}
                >
                  <Text style={{ ...TYPE.meta, color: '#FFFFFF', fontWeight: '700' }}>
                    {mgrProfilePublishLoading ? t('checkingBtn') : managerProfile?.isPublished ? t('recheckBtn') : t('publishNowBtn')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleManagerProfilePublication('hidden')}
                  style={{ flex: 1, backgroundColor: c.mutedBg, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.border, opacity: mgrProfilePublishLoading ? 0.7 : 1 }}
                  disabled={mgrProfilePublishLoading}
                >
                  <Text style={{ ...TYPE.meta, color: c.text, fontWeight: '700' }}>{t('hideBtn')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View>
            <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 4 }}>{t('nameLabel')}</Text>
            <TextInput style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 10 }]} value={mgrProfileFullName} onChangeText={setMgrProfileFullName} placeholder={t('fullNamePlaceholder')} placeholderTextColor={c.muted} />
            <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 4 }}>{t('professionalTitleLabel')}</Text>
            <TextInput style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 10 }]} value={mgrProfileTitle} onChangeText={setMgrProfileTitle} placeholder={t('professionalTitlePlaceholder')} placeholderTextColor={c.muted} />
            <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 4 }}>{t('bioLabel')}</Text>
            <TextInput style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 10, minHeight: 80, textAlignVertical: 'top' }]} value={mgrProfileBio} onChangeText={setMgrProfileBio} placeholder={t('bioPlaceholder')} placeholderTextColor={c.muted} multiline />
            <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 4 }}>{t('specsCommaSeparated')}</Text>
            <TextInput style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 10 }]} value={mgrProfileSpecializations} onChangeText={setMgrProfileSpecializations} placeholder={t('specsPlaceholder')} placeholderTextColor={c.muted} />
            <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 4 }}>{t('langsCommaSeparated')}</Text>
            <TextInput style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 12 }]} value={mgrProfileLanguages} onChangeText={setMgrProfileLanguages} placeholder={t('langsPlaceholder')} placeholderTextColor={c.muted} />
            <Pressable
              onPress={() => setMgrProfileIsVisible((value) => !value)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}
            >
              <View style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: mgrProfileIsVisible ? c.primary : c.border, justifyContent: 'center', paddingHorizontal: 2 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF', alignSelf: mgrProfileIsVisible ? 'flex-end' : 'flex-start' }} />
              </View>
              <Text style={{ ...TYPE.body, color: c.text }}>{t('visibleAfterPublish')}</Text>
            </Pressable>
            <Text style={{ ...TYPE.meta, color: c.textMuted ?? c.muted, marginBottom: 14 }}>
              {t('visibilityExplanation')}
            </Text>
            <Pressable
              style={{ backgroundColor: mgrProfileSaving ? c.border : c.primary, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center' }}
              onPress={handleManagerProfileSave}
              disabled={mgrProfileSaving}
            >
              <Text style={{ ...TYPE.heading, color: '#FFFFFF' }}>{mgrProfileSaving ? t('savingBtn') : t('saveBtn')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>{t('practiceDashboard')}</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>{mgr.email}</Text>
          </View>
        </View>

        {practices.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 4 }}
          >
            {practices.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setActivePracticeId(item.id);
                  setMgrEditMode(false);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  minHeight: 44,
                  borderRadius: RADIUS.full,
                  borderWidth: 1.5,
                  borderColor: (activePracticeId ?? practices[0]?.id) === item.id ? c.primary : c.border,
                  backgroundColor: (activePracticeId ?? practices[0]?.id) === item.id ? c.primary : c.mutedBg,
                }}
              >
                <Text style={{ color: (activePracticeId ?? practices[0]?.id) === item.id ? '#FFFFFF' : c.text, fontSize: 13, fontWeight: '600' }}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {practice && (
          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{practice.name}</Text>
                <Text style={{ color: c.muted, fontSize: 14, marginTop: 2 }}>{practice.city}</Text>
              </View>
              <View style={{ backgroundColor: statusStyle.bg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: statusStyle.text, fontSize: 12, fontWeight: '600' }}>
                  {getStatusLabels(t)[reviewStatus] ?? reviewStatus}
                </Text>
              </View>
            </View>

            {!!practice.address && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="location-outline" size={14} color={c.muted} />
                <Text style={{ color: c.muted, fontSize: 13 }}>{practice.address}</Text>
              </View>
            )}
            {!!practice.phone && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="call-outline" size={14} color={c.muted} />
                <Text style={{ color: c.muted, fontSize: 13 }}>{practice.phone}</Text>
              </View>
            )}
            {!!practice.description && (
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{practice.description}</Text>
            )}
            {practice.logo ? (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 6 }]}>{t('logoLabel')}</Text>
                <Image source={{ uri: resolveMediaUrl(practice.logo) }} style={{ width: 64, height: 64, borderRadius: RADIUS.sm }} />
              </View>
            ) : null}
            {practicePhotos.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 6 }]}>{t('practicePhotosLabel')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {practicePhotos.map((uri, index) => (
                    <Image key={`${uri}-${index}`} source={{ uri }} style={{ width: 80, height: 80, borderRadius: RADIUS.sm }} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {mgrEditMode ? (
              <View style={{ marginTop: 16, gap: 10 }}>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('practiceNamePlaceholder')}</Text>
                <TextInput value={mgrEditName} onChangeText={setMgrEditName} placeholder={practice.name} placeholderTextColor={c.muted} style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('cityPlaceholder')}</Text>
                <TextInput value={mgrEditCity} onChangeText={setMgrEditCity} placeholder={practice.city} placeholderTextColor={c.muted} style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('addressLabel')}</Text>
                <TextInput value={mgrEditAddress} onChangeText={setMgrEditAddress} placeholder={practice.address ?? t('addressFallbackPlaceholder')} placeholderTextColor={c.muted} style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('phoneLabel')}</Text>
                <TextInput value={mgrEditPhone} onChangeText={setMgrEditPhone} placeholder={practice.phone ?? t('phonePlaceholder')} placeholderTextColor={c.muted} keyboardType="phone-pad" style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('hoursLabel')}</Text>
                <TextInput value={mgrEditHours} onChangeText={setMgrEditHours} placeholder={practice.hours ?? t('hoursFallbackPlaceholder')} placeholderTextColor={c.muted} style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, minHeight: 44 }}>
                  <Text style={[styles.filterSectionTitle, { color: c.text }]}>{t('homeVisitsSwitch')}</Text>
                  <Switch value={mgrEditHomeVisit} onValueChange={setMgrEditHomeVisit} trackColor={{ true: c.primary }} />
                </View>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('descriptionLabel')}</Text>
                <TextInput value={mgrEditDescription} onChangeText={setMgrEditDescription} placeholder={practice.description ?? t('shortDescPlaceholder')} placeholderTextColor={c.muted} multiline numberOfLines={3} style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, minHeight: 72, textAlignVertical: 'top' }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('logoLabel')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {mgrEditLogo ? (
                    <Image source={{ uri: mgrEditLogo }} style={{ width: 64, height: 64, borderRadius: RADIUS.sm }} />
                  ) : (
                    <View style={{ width: 64, height: 64, borderRadius: RADIUS.sm, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>
                        {(mgrEditName || practice.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Pressable onPress={handlePickManagerPracticeLogo} style={[styles.kassenartBtn, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                    <Text style={[styles.kassenartText, { color: c.text }]}>{t('changeLogoSimple')}</Text>
                  </Pressable>
                  {mgrEditLogo && (
                    <Pressable onPress={() => setMgrEditLogo(null)} style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: c.error }]}>
                      <Text style={[styles.kassenartText, { color: c.error }]}>{t('removeBtn')}</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('practicePhotosLabel')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {mgrEditPhotos.map((photo, index) => (
                    <View key={`${photo}-${index}`} style={{ position: 'relative' }}>
                      <Image source={{ uri: photo }} style={{ width: 80, height: 80, borderRadius: RADIUS.sm }} />
                      <Pressable
                        onPress={() => setMgrEditPhotos((prev) => prev.filter((_, photoIndex) => photoIndex !== index))}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ position: 'absolute', top: -6, right: -6, backgroundColor: c.error, borderRadius: RADIUS.sm, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>X</Text>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={handleAddManagerPracticePhoto}
                    style={{ width: 80, height: 80, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: c.mutedBg }}
                  >
                    <Text style={{ color: c.muted, fontSize: 28 }}>+</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Pressable
                    style={{ flex: 1, backgroundColor: c.mutedBg, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.border }}
                    onPress={() => setMgrEditMode(false)}
                  >
                    <Text style={{ color: c.text, fontWeight: '600' }}>{t('cancelBtn')}</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, backgroundColor: mgrEditSaving ? c.border : c.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' }}
                    onPress={handleManagerPracticeSave}
                    disabled={mgrEditSaving}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{mgrEditSaving ? t('savingBtn') : t('saveBtn')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => {
                  setMgrEditName(practice.name ?? '');
                  setMgrEditCity(practice.city ?? '');
                  setMgrEditAddress(practice.address ?? '');
                  setMgrEditPhone(practice.phone ?? '');
                  setMgrEditHours(practice.hours ?? '');
                  setMgrEditDescription(practice.description ?? '');
                  setMgrEditHomeVisit(practice.homeVisit ?? false);
                  setMgrEditLogo(practice.logo ?? null);
                  setMgrEditPhotos(practicePhotos);
                  setMgrEditMode(true);
                }}
              >
                <Ionicons name="pencil-outline" size={16} color={c.primary} />
                <Text style={{ color: c.primary, fontSize: 14, fontWeight: '600' }}>{t('editBtn')}</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 12 }]}>{t('therapeutsSection')}</Text>
          {therapists.length === 0 ? (
            <Text style={{ color: c.muted, fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>{t('noTherapistsLinked')}</Text>
          ) : (
            therapists.map((therapist) => {
              const isInvited = therapist.onboardingStatus === 'invited';
              const initials = (therapist.fullName ?? '?').split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase();
              return (
                <View key={therapist.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
                  {therapist.photo ? (
                    <Image source={{ uri: therapist.photo.startsWith('http') ? therapist.photo : `${getBaseUrl()}${therapist.photo}` }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  ) : (
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{initials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{therapist.fullName ?? '-'}</Text>
                    {!!therapist.professionalTitle && <Text style={{ color: c.muted, fontSize: 12 }}>{therapist.professionalTitle}</Text>}
                  </View>
                  <View style={{ backgroundColor: isInvited ? c.warningBg : c.successBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: isInvited ? c.warning : c.success, fontSize: 11, fontWeight: '600' }}>
                      {isInvited ? t('invitedLabel') : t('activeLabel')}
                    </Text>
                  </View>
                  {therapist.id !== loggedInManager?.therapistProfile?.id && (
                    <Pressable
                      onPress={() => handleRemoveTherapist(therapist.id, therapist.fullName ?? t('tabTherapist'))}
                      disabled={removingTherapistId === therapist.id}
                      style={{ paddingHorizontal: 10, paddingVertical: 10, minHeight: 44, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.error, opacity: removingTherapistId === therapist.id ? 0.4 : 1, justifyContent: 'center' }}
                    >
                      <Text style={{ color: c.error, fontSize: 11, fontWeight: '600' }}>
                      {removingTherapistId === therapist.id ? '...' : t('removeBtn')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>

        {renderManagerProfileSection()}

        {!mgrEditMode && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, gap: 8 }}>
            {/* Invite a new therapist by email */}
            <Pressable
              onPress={() => {
                setInvitePageTab('new');
                setInviteToken(null);
                setShowInvitePage(true);
              }}
              style={{ borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: c.primary, flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="person-add-outline" size={18} color={c.primary} />
              <Text style={{ color: c.primary, fontSize: 15, fontWeight: '600' }}>{t('inviteTherapistAction')}</Text>
            </Pressable>
          </View>
        )}

        {!mgrEditMode && practice && (
          <View style={{ marginHorizontal: 16, marginTop: SPACE.xl, marginBottom: 8, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: c.border }}>
            <Pressable
              onPress={() => handleDeleteManagerPractice(practice.id)}
              style={{ alignItems: 'center', paddingVertical: 14 }}
            >
              <Text style={{ ...TYPE.body, color: c.error }}>{t('deletePracticeBtn')}</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
