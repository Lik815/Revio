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
} from './mobile-utils';

export function TherapistDashboardScreen(props) {
  const {
    authToken,
    c,
    documentUploading,
    editAvailability,
    editBio,
    editHomeVisit,
    editIsVisible,
    editLanguages,
    editMode,
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
    setEditLanguages,
    setEditMode,
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
  const initials = th.fullName.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase();

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center' }]}>
        <Pressable onPress={handlePickPhoto} style={{ position: 'relative' }}>
          {th.photo ? (
            <Image source={{ uri: th.photo }} style={[styles.therapistAvatarLarge, { borderRadius: 48 }]} />
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
        <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{th.professionalTitle}</Text>
        <View style={[styles.tag, { backgroundColor: th.reviewStatus === 'APPROVED' ? c.successBg : c.mutedBg, marginTop: 6 }]}>
          <Text style={{ color: th.reviewStatus === 'APPROVED' ? c.success : c.muted, fontSize: 12 }}>
            {th.reviewStatus === 'APPROVED' ? '✓ Freigegeben' : '⏳ In Prüfung'}
          </Text>
        </View>
      </View>

      {(th.practices ?? []).length === 0 && (
        <View style={[{ marginTop: 12, marginHorizontal: 0, borderRadius: 14, borderWidth: 1, padding: 16, backgroundColor: c.mutedBg, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 14, marginBottom: 4 }}>Noch keine Praxis verbunden</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginBottom: 12 }}>
            Du bist noch mit keiner Praxis verknüpft. Erstelle eine eigene Praxis oder verbinde dich mit einer bestehenden.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setShowCreatePractice(true)}
              style={{ flex: 1, backgroundColor: c.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>＋ Praxis erstellen</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowPracticeSearch(true)}
              style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: c.border }}
            >
              <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>🔗 Praxis verbinden</Text>
            </Pressable>
          </View>
        </View>
      )}

      {editMode ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Über mich</Text>
          <TextInput
            style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, minHeight: 80, textAlignVertical: 'top' }]}
            value={editBio}
            onChangeText={setEditBio}
            placeholder="Kurze Beschreibung…"
            placeholderTextColor={c.muted}
            multiline
          />
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Spezialisierungen (kommagetrennt)</Text>
          <TextInput
            style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
            value={editSpecializations}
            onChangeText={setEditSpecializations}
            placeholder="Rücken, Sport, Neurologie…"
            placeholderTextColor={c.muted}
          />
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Sprachen</Text>
          <LangMultiselect editLanguages={editLanguages} setEditLanguages={setEditLanguages} c={c} styles={styles} />
          {(th.practices ?? []).length === 0 && (
            <View style={[styles.detailInfoRow, { marginTop: 12 }]}>
              <Text style={[styles.detailInfoLabel, { color: c.text, flex: 1 }]}>Hausbesuch</Text>
              <Switch value={editHomeVisit} onValueChange={setEditHomeVisit} trackColor={{ true: c.primary }} />
            </View>
          )}
          <View style={[styles.detailInfoRow, { marginTop: 12 }]}>
            <Text style={[styles.detailInfoLabel, { color: c.text, flex: 1 }]}>In Suche sichtbar</Text>
            <Switch value={editIsVisible} onValueChange={setEditIsVisible} trackColor={{ true: c.primary }} />
          </View>
          <Text style={[styles.detailInfoLabel, { color: c.muted, marginTop: 14, marginBottom: 4 }]}>Sprechzeiten</Text>
          <TextInput
            style={[styles.registerInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
            value={editAvailability}
            onChangeText={setEditAvailability}
            placeholder="z.B. Mo–Fr 8:00–18:00 Uhr"
            placeholderTextColor={c.muted}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable style={[styles.registerBtn, { flex: 1, backgroundColor: c.border, marginTop: 0 }]} onPress={() => setEditMode(false)}>
              <Text style={[styles.registerBtnText, { color: c.text }]}>Abbrechen</Text>
            </Pressable>
            <Pressable style={[styles.registerBtn, { flex: 1, backgroundColor: profileSaving ? c.border : c.primary, marginTop: 0 }]} onPress={handleSaveProfile} disabled={profileSaving}>
              <Text style={styles.registerBtnText}>{profileSaving ? 'Speichern…' : 'Speichern'}</Text>
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
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Sprachen</Text>
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
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.homeVisit ? 'Ja' : 'Nein'}</Text>
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
            <Text style={styles.registerBtnText}>✏️ Profil bearbeiten</Text>
          </Pressable>

          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Nachweise & Dokumente</Text>
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
                borderRadius: 10, borderWidth: 1,
                borderColor: documentUploading ? c.border : c.primary,
                borderStyle: 'dashed',
              }}
            >
              {documentUploading ? (
                <Text style={{ color: c.muted, fontSize: 13 }}>Wird hochgeladen…</Text>
              ) : (
                <>
                  <Ionicons name="attach-outline" size={18} color={c.primary} />
                  <Text style={{ color: c.primary, fontWeight: '600', fontSize: 13 }}>Nachweis hochladen</Text>
                </>
              )}
            </Pressable>
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>
              PDF, Foto oder Scan — nur für Admins sichtbar
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
                        hitSlop={8}
                      >
                        <Ionicons name="person-add-outline" size={18} color={c.primary} />
                      </Pressable>
                      <Pressable
                        onPress={() => { setAdminPracticeDetail(null); loadAdminPracticeDetail(); setShowPracticeAdmin(true); }}
                        style={{ padding: 6 }}
                        hitSlop={8}
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
                <Text style={[styles.noticeTitle, { color: c.text }]}>Keine Praxis verknüpft</Text>
                <Text style={[styles.noticeBody, { color: c.muted }]}>Verbinde dich mit einer Praxis oder erstelle deine eigene.</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable
                    onPress={() => { setPracticeSearchQuery(''); setPracticeSearchResults([]); setShowPracticeSearch(true); }}
                    style={[styles.kassenartBtn, { backgroundColor: c.primary, borderColor: c.primary, flex: 1 }]}
                  >
                    <Text style={[styles.kassenartText, { color: '#fff' }]}>Praxis suchen</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowCreatePractice(true)}
                    style={[styles.kassenartBtn, { backgroundColor: c.mutedBg, borderColor: c.border, flex: 1 }]}
                  >
                    <Text style={[styles.kassenartText, { color: c.text }]}>Neue Praxis</Text>
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
  if (!p) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[styles.infoBody, { color: c.muted }]}>Wird geladen…</Text>
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
        {p.logo ? (
          <Image source={{ uri: p.logo }} style={[styles.practiceHeaderInitial, { borderRadius: 12 }]} />
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
          <Text style={[styles.sectionLabel, { color: c.text }]}>Anfragen ({pending.length})</Text>
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
                  <Text style={[styles.kassenartText, { color: '#fff' }]}>✓ Annehmen</Text>
                </Pressable>
                <Pressable onPress={() => handleLinkAction(link.id, 'reject')} style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: '#E74C3C', flex: 1 }]}>
                  <Text style={[styles.kassenartText, { color: '#E74C3C' }]}>✕ Ablehnen</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={[styles.sectionLabel, { color: c.text }]}>Therapeuten ({confirmed.length})</Text>
      {confirmed.map((link) => {
        const therapist = link.therapist;
        const isInvited = therapist.invitedByPracticeId === p.id;
        const statusLabel = isInvited
          ? therapist.onboardingStatus === 'invited' ? 'Einladung ausstehend'
            : therapist.onboardingStatus === 'claimed' ? 'Profil wird ausgefüllt'
            : therapist.isPublished ? 'Veröffentlicht' : 'Profil vollständig'
          : null;
        const statusColor = therapist.onboardingStatus === 'invited' ? '#F59E0B'
          : therapist.onboardingStatus === 'claimed' ? '#3B82F6'
          : '#10B981';

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
              <Pressable onPress={() => handleResendInvite(therapist.id)} style={{ marginTop: 10, paddingVertical: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border }}>
                <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>Einladung erneut senden</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      {confirmed.length === 0 && pending.length === 0 && (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Noch keine Therapeuten</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>Lade Therapeuten per E-Mail ein.</Text>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: c.text }]}>Praxisdaten bearbeiten</Text>
      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
        {[
          { label: 'Name *', value: editPracticeName, setter: setEditPracticeName, placeholder: 'Praxisname' },
          { label: 'Stadt *', value: editPracticeCity, setter: setEditPracticeCity, placeholder: 'Stadt' },
          { label: 'Adresse', value: editPracticeAddress, setter: setEditPracticeAddress, placeholder: 'Straße Nr, PLZ Stadt' },
          { label: 'Telefon', value: editPracticePhone, setter: setEditPracticePhone, placeholder: '+49 …', keyboard: 'phone-pad' },
          { label: 'Öffnungszeiten', value: editPracticeHours, setter: setEditPracticeHours, placeholder: 'Mo–Fr 8:00–18:00' },
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
          <Text style={[styles.filterSectionTitle, { color: c.text }]}>Hausbesuche</Text>
          <Switch value={editPracticeHomeVisit} onValueChange={setEditPracticeHomeVisit} trackColor={{ true: c.primary }} />
        </View>

        <View>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Beschreibung</Text>
          <TextInput
            style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, minHeight: 90, textAlignVertical: 'top' }]}
            value={editPracticeDescription}
            onChangeText={setEditPracticeDescription}
            placeholder="Stellen Sie Ihre Praxis vor …"
            placeholderTextColor={c.muted}
            multiline
          />
        </View>

        <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Logo</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {editPracticeLogo ? (
            <Image source={{ uri: editPracticeLogo }} style={{ width: 64, height: 64, borderRadius: 8 }} />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{editPracticeName.charAt(0) || '?'}</Text>
              <Text style={{ color: '#fff', fontSize: 10 }}>✚</Text>
            </View>
          )}
          <Pressable onPress={handlePickPracticeLogo} style={[styles.kassenartBtn, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
            <Text style={[styles.kassenartText, { color: c.text }]}>📷 Logo ändern</Text>
          </Pressable>
          {editPracticeLogo && (
            <Pressable onPress={() => setEditPracticeLogo(null)} style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: '#E74C3C' }]}>
              <Text style={[styles.kassenartText, { color: '#E74C3C' }]}>Entfernen</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>Praxisfotos</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {editPracticePhotos.map((photo, index) => (
            <View key={index} style={{ position: 'relative' }}>
              <Image source={{ uri: photo }} style={{ width: 80, height: 80, borderRadius: 6 }} />
              <Pressable
                onPress={() => setEditPracticePhotos((prev) => prev.filter((_, photoIndex) => photoIndex !== index))}
                style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#E74C3C', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={handleAddPracticePhoto} style={{ width: 80, height: 80, borderRadius: 6, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: c.mutedBg }}>
            <Text style={{ color: c.muted, fontSize: 28 }}>＋</Text>
          </Pressable>
        </View>

        <Pressable onPress={handleSavePractice} style={[styles.kassenartBtn, { backgroundColor: c.primary, borderColor: c.primary, marginTop: 4 }]}>
          <Text style={[styles.kassenartText, { color: '#fff' }]}>
            {practiceEditSaving ? 'Wird gespeichert…' : 'Speichern'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onLayout={(event) => { inviteSectionY.current = event.nativeEvent.layout.y; }}
        onPress={() => { setInvitePageTab('new'); if (!inviteToken) handleLoadInviteToken(); setShowInvitePage(true); }}
        style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: c.border, alignSelf: 'flex-start', marginBottom: 8 }]}
      >
        <Text style={[styles.kassenartText, { color: c.muted }]}>+ Therapeut einladen</Text>
      </Pressable>

      <Pressable onPress={handleDeletePractice} style={{ marginTop: 8, marginBottom: 8, alignItems: 'center', paddingVertical: 14 }}>
        <Text style={{ color: c.muted, fontSize: 14 }}>Praxis löschen</Text>
      </Pressable>
    </ScrollView>
  );
}

function LangMultiselect({ editLanguages, setEditLanguages, c, styles }) {
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
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.primary + '22', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, gap: 4 }}
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
        placeholder="Sprache suchen…"
        placeholderTextColor={c.muted}
        style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
      />
      {suggestions.length > 0 && (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
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
