import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatMissingProfileFields,
  getBaseUrl,
} from './mobile-utils';

const statusColors = {
  APPROVED: { bg: '#E8F5E9', text: '#2E7D32' },
  PENDING_REVIEW: { bg: '#FFF8E1', text: '#F57F17' },
  DRAFT: { bg: '#F5F5F5', text: '#9E9E9E' },
  REJECTED: { bg: '#FDECEA', text: '#C62828' },
  SUSPENDED: { bg: '#FDECEA', text: '#C62828' },
  CHANGES_REQUESTED: { bg: '#FFF3E0', text: '#E65100' },
};

const statusLabels = {
  APPROVED: 'Freigegeben',
  PENDING_REVIEW: 'In Pruefung',
  DRAFT: 'Entwurf',
  REJECTED: 'Abgelehnt',
  SUSPENDED: 'Gesperrt',
  CHANGES_REQUESTED: 'Aenderungen noetig',
};

export function ManagerDashboardContent(props) {
  const {
    activePracticeId,
    c,
    handleAddManagerPracticePhoto,
    handleAddNewPractice,
    handleManagerPracticeSave,
    handleManagerProfilePublication,
    handleManagerProfileSave,
    handlePickManagerPracticeLogo,
    handleRemoveTherapist,
    loggedInManager,
    mgrEditAddress,
    mgrEditCity,
    mgrEditDescription,
    mgrEditHours,
    mgrEditLogo,
    mgrEditMode,
    mgrEditName,
    mgrEditPhone,
    mgrEditPhotos,
    mgrEditSaving,
    mgrNewPracticeAddress,
    mgrNewPracticeCity,
    mgrNewPracticeLoading,
    mgrNewPracticeName,
    mgrNewPracticePhone,
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
    setMgrEditHours,
    setMgrEditLogo,
    setMgrEditMode,
    setMgrEditName,
    setMgrEditPhone,
    setMgrEditPhotos,
    setMgrNewPracticeAddress,
    setMgrNewPracticeCity,
    setMgrNewPracticeName,
    setMgrNewPracticePhone,
    setMgrProfileBio,
    setMgrProfileEditMode,
    setMgrProfileFullName,
    setMgrProfileIsVisible,
    setMgrProfileLanguages,
    setMgrProfileSpecializations,
    setMgrProfileTitle,
    setShowAddPracticeForm,
    setShowInvitePage,
    setInvitePageTab,
    setInviteToken,
    showAddPracticeForm,
    styles,
  } = props;

  const mgr = loggedInManager;
  if (!mgr) return null;

  const practices = mgr.practices ?? [];
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
  const managerProfile = mgr.therapistProfile ?? null;
  const managerProfileMissingFields = formatMissingProfileFields(managerProfile?.missingFields ?? []);
  const managerProfileIsReady = !!managerProfile?.complete;
  const managerProfileIsPublic = !!managerProfile?.publicSearchEligible;
  const reviewStatus = practice?.reviewStatus ?? 'DRAFT';
  const statusStyle = statusColors[reviewStatus] ?? statusColors.DRAFT;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>Praxis-Dashboard</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>{mgr.email}</Text>
          </View>
        </View>

        {mgr.isTherapist && mgr.therapistProfile && (
          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>MEIN PROFIL</Text>
              {!mgrProfileEditMode ? (
                <Pressable
                  onPress={() => {
                    const profile = mgr.therapistProfile;
                    setMgrProfileFullName(profile.fullName ?? '');
                    setMgrProfileTitle(profile.professionalTitle ?? '');
                    setMgrProfileBio(profile.bio ?? '');
                    setMgrProfileSpecializations(profile.specializations ?? '');
                    setMgrProfileLanguages(profile.languages ?? '');
                    setMgrProfileIsVisible(profile.isVisible ?? false);
                    setMgrProfileEditMode(true);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name="pencil-outline" size={15} color={c.primary} />
                  <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }}>Bearbeiten</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setMgrProfileEditMode(false)}>
                  <Text style={{ color: c.muted, fontSize: 13 }}>Abbrechen</Text>
                </Pressable>
              )}
            </View>

            {!mgrProfileEditMode ? (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                {mgr.therapistProfile.photo ? (
                  <Image
                    source={{
                      uri: mgr.therapistProfile.photo.startsWith('http')
                        ? mgr.therapistProfile.photo
                        : `${getBaseUrl()}${mgr.therapistProfile.photo}`,
                    }}
                    style={{ width: 52, height: 52, borderRadius: 26 }}
                  />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
                      {(mgr.therapistProfile.fullName ?? '?').split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{mgr.therapistProfile.fullName}</Text>
                  <Text style={{ color: c.muted, fontSize: 13 }}>{mgr.therapistProfile.professionalTitle}</Text>
                  {!!mgr.therapistProfile.bio && (
                    <Text style={{ color: c.text, fontSize: 13, marginTop: 6 }} numberOfLines={3}>
                      {mgr.therapistProfile.bio}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: mgr.therapistProfile.isVisible ? '#E8F5E9' : '#F5F5F5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: mgr.therapistProfile.isVisible ? '#2E7D32' : '#9E9E9E', fontSize: 11, fontWeight: '600' }}>
                        {mgr.therapistProfile.isVisible ? 'Sichtbar' : 'Versteckt'}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: mgr.therapistProfile.isPublished ? '#E8F5E9' : '#F5F5F5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: mgr.therapistProfile.isPublished ? '#2E7D32' : '#9E9E9E', fontSize: 11, fontWeight: '600' }}>
                        {mgr.therapistProfile.isPublished ? 'Veroeffentlicht' : 'Nicht veroeffentlicht'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 12, backgroundColor: managerProfileIsPublic ? '#E8F5E9' : c.mutedBg, borderRadius: 12, padding: 12 }}>
                    <Text style={{ color: managerProfileIsPublic ? '#2E7D32' : c.text, fontSize: 13, fontWeight: '700' }}>
                      {managerProfileIsPublic ? 'Oeffentlich sichtbar' : 'Noch nicht oeffentlich'}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                      {managerProfileIsPublic
                        ? 'Dein Profil erscheint aktuell in der Therapeutensuche.'
                        : !managerProfile?.reviewApproved
                          ? 'Dein Profil wird erst nach der Freigabe durch das Revio-Team oeffentlich.'
                          : !managerProfile?.isVisible
                            ? 'Du hast dein Profil aktuell auf verborgen gestellt.'
                            : !managerProfileIsReady
                              ? 'Es fehlen noch Pflichtangaben, bevor du veroeffentlichen kannst.'
                              : !managerProfile?.isPublished
                                ? 'Dein Profil ist vollstaendig, aber noch nicht ausdruecklich veroeffentlicht.'
                                : 'Dein Profil ist aktuell nicht oeffentlich sichtbar.'}
                    </Text>
                    {!managerProfileIsReady && managerProfileMissingFields.length > 0 && (
                      <Text style={{ color: c.text, fontSize: 12, marginTop: 8 }}>
                        Fehlende Angaben: {managerProfileMissingFields.join(', ')}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <Pressable
                      onPress={() => handleManagerProfilePublication('visible')}
                      style={{ flex: 1, backgroundColor: (!managerProfile?.reviewApproved || mgrProfilePublishLoading) ? c.border : c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: !managerProfile?.reviewApproved ? 0.7 : 1 }}
                      disabled={!managerProfile?.reviewApproved || mgrProfilePublishLoading}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                        {mgrProfilePublishLoading ? 'Pruefen...' : managerProfile?.isPublished ? 'Erneut pruefen' : 'Jetzt veroeffentlichen'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleManagerProfilePublication('hidden')}
                      style={{ flex: 1, backgroundColor: c.mutedBg, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.border, opacity: mgrProfilePublishLoading ? 0.7 : 1 }}
                      disabled={mgrProfilePublishLoading}
                    >
                      <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>Verbergen</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              <View>
                <Text style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>Name</Text>
                <TextInput style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 10 }]} value={mgrProfileFullName} onChangeText={setMgrProfileFullName} placeholder="Vollstaendiger Name" placeholderTextColor={c.muted} />
                <Text style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>Berufsbezeichnung</Text>
                <TextInput style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 10 }]} value={mgrProfileTitle} onChangeText={setMgrProfileTitle} placeholder="z.B. Physiotherapeutin" placeholderTextColor={c.muted} />
                <Text style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>Bio</Text>
                <TextInput style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 10, minHeight: 80, textAlignVertical: 'top' }]} value={mgrProfileBio} onChangeText={setMgrProfileBio} placeholder="Kurzbeschreibung..." placeholderTextColor={c.muted} multiline />
                <Text style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>Spezialisierungen (kommagetrennt)</Text>
                <TextInput style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 10 }]} value={mgrProfileSpecializations} onChangeText={setMgrProfileSpecializations} placeholder="z.B. Ruecken, Knie, Sport" placeholderTextColor={c.muted} />
                <Text style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>Sprachen (kommagetrennt)</Text>
                <TextInput style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 12 }]} value={mgrProfileLanguages} onChangeText={setMgrProfileLanguages} placeholder="z.B. Deutsch, Englisch" placeholderTextColor={c.muted} />
                <Pressable
                  onPress={() => setMgrProfileIsVisible((value) => !value)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}
                >
                  <View style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: mgrProfileIsVisible ? c.primary : c.border, justifyContent: 'center', paddingHorizontal: 2 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignSelf: mgrProfileIsVisible ? 'flex-end' : 'flex-start' }} />
                  </View>
                  <Text style={{ color: c.text, fontSize: 14 }}>Nach Veroeffentlichung im Verzeichnis sichtbar</Text>
                </Pressable>
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 14 }}>
                  Sichtbarkeit allein reicht nicht aus. Das Profil wird erst oeffentlich, wenn alle Pflichtfelder ausgefuellt sind und du die Veroeffentlichung bestaetigst.
                </Text>
                <Pressable
                  style={{ backgroundColor: mgrProfileSaving ? c.border : c.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
                  onPress={handleManagerProfileSave}
                  disabled={mgrProfileSaving}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{mgrProfileSaving ? 'Speichern...' : 'Speichern'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

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
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: (activePracticeId ?? practices[0]?.id) === item.id ? c.primary : c.border,
                  backgroundColor: (activePracticeId ?? practices[0]?.id) === item.id ? c.primary : c.mutedBg,
                }}
              >
                <Text style={{ color: (activePracticeId ?? practices[0]?.id) === item.id ? '#fff' : c.text, fontSize: 13, fontWeight: '600' }}>
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
              <View style={{ backgroundColor: statusStyle.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: statusStyle.text, fontSize: 12, fontWeight: '600' }}>
                  {statusLabels[reviewStatus] ?? reviewStatus}
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
                <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 6 }]}>Logo</Text>
                <Image source={{ uri: practice.logo }} style={{ width: 64, height: 64, borderRadius: 8 }} />
              </View>
            ) : null}
            {practicePhotos.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 6 }]}>Praxisfotos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {practicePhotos.map((uri, index) => (
                    <Image key={`${uri}-${index}`} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {mgrEditMode ? (
              <View style={{ marginTop: 16, gap: 10 }}>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Praxisname</Text>
                <TextInput value={mgrEditName} onChangeText={setMgrEditName} placeholder={practice.name} placeholderTextColor={c.muted} style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Stadt</Text>
                <TextInput value={mgrEditCity} onChangeText={setMgrEditCity} placeholder={practice.city} placeholderTextColor={c.muted} style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Adresse</Text>
                <TextInput value={mgrEditAddress} onChangeText={setMgrEditAddress} placeholder={practice.address ?? 'Strasse und Hausnummer'} placeholderTextColor={c.muted} style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Telefon</Text>
                <TextInput value={mgrEditPhone} onChangeText={setMgrEditPhone} placeholder={practice.phone ?? '+49 ...'} placeholderTextColor={c.muted} keyboardType="phone-pad" style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Oeffnungszeiten</Text>
                <TextInput value={mgrEditHours} onChangeText={setMgrEditHours} placeholder={practice.hours ?? 'Mo-Fr 8-18 Uhr'} placeholderTextColor={c.muted} style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Beschreibung</Text>
                <TextInput value={mgrEditDescription} onChangeText={setMgrEditDescription} placeholder={practice.description ?? 'Kurze Beschreibung...'} placeholderTextColor={c.muted} multiline numberOfLines={3} style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, minHeight: 72, textAlignVertical: 'top' }]} />
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Logo</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {mgrEditLogo ? (
                    <Image source={{ uri: mgrEditLogo }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                  ) : (
                    <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>
                        {(mgrEditName || practice.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Pressable onPress={handlePickManagerPracticeLogo} style={[styles.kassenartBtn, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                    <Text style={[styles.kassenartText, { color: c.text }]}>Logo aendern</Text>
                  </Pressable>
                  {mgrEditLogo && (
                    <Pressable onPress={() => setMgrEditLogo(null)} style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: '#E74C3C' }]}>
                      <Text style={[styles.kassenartText, { color: '#E74C3C' }]}>Entfernen</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Praxisfotos</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {mgrEditPhotos.map((photo, index) => (
                    <View key={`${photo}-${index}`} style={{ position: 'relative' }}>
                      <Image source={{ uri: photo }} style={{ width: 80, height: 80, borderRadius: 6 }} />
                      <Pressable
                        onPress={() => setMgrEditPhotos((prev) => prev.filter((_, photoIndex) => photoIndex !== index))}
                        style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#E74C3C', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>X</Text>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={handleAddManagerPracticePhoto}
                    style={{ width: 80, height: 80, borderRadius: 6, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: c.mutedBg }}
                  >
                    <Text style={{ color: c.muted, fontSize: 28 }}>+</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Pressable
                    style={{ flex: 1, backgroundColor: c.mutedBg, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.border }}
                    onPress={() => setMgrEditMode(false)}
                  >
                    <Text style={{ color: c.text, fontWeight: '600' }}>Abbrechen</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, backgroundColor: mgrEditSaving ? c.border : c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                    onPress={handleManagerPracticeSave}
                    disabled={mgrEditSaving}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{mgrEditSaving ? 'Speichern...' : 'Speichern'}</Text>
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
                  setMgrEditLogo(practice.logo ?? null);
                  setMgrEditPhotos(practicePhotos);
                  setMgrEditMode(true);
                }}
              >
                <Ionicons name="pencil-outline" size={16} color={c.primary} />
                <Text style={{ color: c.primary, fontSize: 14, fontWeight: '600' }}>Bearbeiten</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 12 }]}>THERAPEUTEN</Text>
          {therapists.length === 0 ? (
            <Text style={{ color: c.muted, fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>Noch keine Therapeuten verknuepft</Text>
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
                  <View style={{ backgroundColor: isInvited ? '#FFF8E1' : '#E8F5E9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: isInvited ? '#F57F17' : '#2E7D32', fontSize: 11, fontWeight: '600' }}>
                      {isInvited ? 'Eingeladen' : 'Aktiv'}
                    </Text>
                  </View>
                  {therapist.id !== loggedInManager?.therapistProfile?.id && (
                    <Pressable
                      onPress={() => handleRemoveTherapist(therapist.id, therapist.fullName ?? 'Therapeut')}
                      disabled={removingTherapistId === therapist.id}
                      style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#E74C3C', opacity: removingTherapistId === therapist.id ? 0.4 : 1 }}
                    >
                      <Text style={{ color: '#E74C3C', fontSize: 11, fontWeight: '600' }}>
                        {removingTherapistId === therapist.id ? '...' : 'Entfernen'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>

        {!mgrEditMode && (
          <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <Pressable
              onPress={() => {
                setInvitePageTab('new');
                setInviteToken(null);
                setShowInvitePage(true);
              }}
              style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: c.primary, flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="person-add-outline" size={18} color={c.primary} />
              <Text style={{ color: c.primary, fontSize: 15, fontWeight: '600' }}>Therapeut einladen</Text>
            </Pressable>
          </View>
        )}

        {!mgrEditMode && (
          <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            {!showAddPracticeForm ? (
              <Pressable
                onPress={() => setShowAddPracticeForm(true)}
                style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: c.primary, flexDirection: 'row', justifyContent: 'center', gap: 6 }}
              >
                <Ionicons name="add-circle-outline" size={18} color={c.primary} />
                <Text style={{ color: c.primary, fontSize: 15, fontWeight: '600' }}>Weitere Praxis hinzufuegen</Text>
              </Pressable>
            ) : (
              <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 10 }]}>NEUE PRAXIS</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 8 }]}
                  placeholder="Praxisname *"
                  placeholderTextColor={c.muted}
                  value={mgrNewPracticeName}
                  onChangeText={setMgrNewPracticeName}
                />
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 8 }]}
                  placeholder="Stadt *"
                  placeholderTextColor={c.muted}
                  value={mgrNewPracticeCity}
                  onChangeText={setMgrNewPracticeCity}
                />
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 8 }]}
                  placeholder="Adresse"
                  placeholderTextColor={c.muted}
                  value={mgrNewPracticeAddress}
                  onChangeText={setMgrNewPracticeAddress}
                />
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginBottom: 12 }]}
                  placeholder="Telefon"
                  placeholderTextColor={c.muted}
                  value={mgrNewPracticePhone}
                  onChangeText={setMgrNewPracticePhone}
                  keyboardType="phone-pad"
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    style={{ flex: 1, backgroundColor: c.mutedBg, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: c.border }}
                    onPress={() => {
                      setShowAddPracticeForm(false);
                      setMgrNewPracticeName('');
                      setMgrNewPracticeCity('');
                      setMgrNewPracticeAddress('');
                      setMgrNewPracticePhone('');
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '600' }}>Abbrechen</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, backgroundColor: mgrNewPracticeLoading ? c.border : c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                    onPress={handleAddNewPractice}
                    disabled={mgrNewPracticeLoading}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{mgrNewPracticeLoading ? 'Erstellen...' : 'Erstellen'}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
