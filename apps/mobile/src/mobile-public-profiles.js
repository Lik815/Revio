import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import {
  formatDist,
  getLangLabel,
  getPracticeInitials,
  RADIUS,
  resolveMediaUrl,
  softenErrorMessage,
  TYPE,
} from './mobile-utils';

const webNavigator = typeof globalThis !== 'undefined' ? globalThis.navigator : undefined;
const webAlert = typeof globalThis !== 'undefined' ? globalThis.alert : undefined;

async function sharePublicLink({ title, url, message }) {
  if (Platform.OS === 'web') {
    if (webNavigator?.share) {
      webNavigator.share({ title, url });
      return;
    }
    await webNavigator?.clipboard?.writeText?.(url);
    webAlert?.('Link copied!');
    return;
  }

  await Share.share({ message });
}

function getSlotDayKey(startsAt) {
  if (!startsAt) return null;
  return new Date(startsAt).toISOString().slice(0, 10);
}

function formatSlotDayLabel(dayKey) {
  if (!dayKey) return { weekday: '—', date: '—' };
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  return {
    weekday: date.toLocaleDateString('de-DE', { weekday: 'short' }),
    date: date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }),
  };
}

function formatSlotTime(startsAt) {
  if (!startsAt) return '—';
  return new Date(startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function PracticeProfileScreen(props) {
  const {
    c,
    callPhone,
    isPracticeFavorite,
    openPractice,
    openTherapistById,
    practice,
    selectedPracticeError,
    selectedPracticeLoading,
    selectedPracticeTherapists,
    setSelectedPractice,
    styles,
    t,
    toggleFavoritePractice,
  } = props;

  const practiceName = typeof practice?.name === 'string' && practice.name.trim() ? practice.name.trim() : 'Praxis';
  const practiceCity = typeof practice?.city === 'string' ? practice.city : '';
  const therapists = Array.isArray(selectedPracticeTherapists) ? selectedPracticeTherapists : [];
  const practicePhotos = Array.isArray(practice?.photos) ? practice.photos.filter(Boolean) : [];
  const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
  const [practiceLogoError, setPracticeLogoError] = React.useState(false);

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setSelectedPractice(null)} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => toggleFavoritePractice(practice)} hitSlop={iconHitSlop} style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
            <Ionicons name={isPracticeFavorite(practice?.id) ? 'heart' : 'heart-outline'} size={22} color={isPracticeFavorite(practice?.id) ? c.saved : c.muted} />
          </Pressable>
          <Pressable
            onPress={() => sharePublicLink({
              title: practiceName,
              url: `https://revio.app/p/${practice?.id}`,
              message: `${practiceName} – ${practiceCity}\nhttps://revio.app/p/${practice?.id}`,
            })}
            hitSlop={iconHitSlop}
            style={{ paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Ionicons name="share-outline" size={22} color={c.primary} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border }]}>
        {practice?.logo && !practiceLogoError ? (
          <Image
            source={{ uri: resolveMediaUrl(practice.logo) }}
            style={[styles.practiceLogoLarge, { borderRadius: RADIUS.md }]}
            onError={() => setPracticeLogoError(true)}
          />
        ) : (
          <View style={[styles.practiceLogoLarge, { backgroundColor: c.primary }]}>
            <View style={styles.practiceLogoCross}>
              <View style={[styles.plusBarH, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
              <View style={[styles.plusBarV, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
            </View>
            <Text style={styles.practiceLogoText}>
              {getPracticeInitials(practiceName)}
            </Text>
          </View>
        )}
        <Text style={[styles.practiceHeaderName, { color: c.text }]}>{practiceName}</Text>
        <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{practiceCity}</Text>
      </View>

      {[
        practice?.address && { icon: '📍', label: practice.address, onPress: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practice.address)}`) },
        practice?.phone && { icon: '📞', label: practice.phone, onPress: () => Linking.openURL(`tel:${practice.phone}`) },
        practice?.hours && { icon: '🕐', label: practice.hours, onPress: null },
      ].filter(Boolean).map((row) => (
        <Pressable key={row.label} onPress={row.onPress ?? undefined} style={[styles.detailRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.detailIcon}>{row.icon}</Text>
          <Text style={[styles.detailText, { color: row.onPress ? c.primary : c.text }]}>{row.label}</Text>
        </Pressable>
      ))}

      {practicePhotos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {practicePhotos.map((uri, index) => (
            <Image key={index} source={{ uri }} style={{ width: 220, height: 145, borderRadius: RADIUS.sm }} />
          ))}
        </ScrollView>
      )}

      {!!practice?.description && (
        <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 4, padding: 14, backgroundColor: c.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 6, textTransform: 'none', letterSpacing: 0.5 }}>{t('aboutPractice')}</Text>
          <Text style={{ ...TYPE.body, color: c.text }}>{practice.description}</Text>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: c.text, marginTop: 4 }]}>
        {t('therapistsLabel')}{!selectedPracticeLoading && !selectedPracticeError ? ` (${therapists.length})` : ''}
      </Text>
      {selectedPracticeLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <ActivityIndicator color={c.primary} />
          <Text style={{ color: c.muted, marginTop: 8, fontSize: 13 }}>{t('loadingTherapists')}</Text>
        </View>
      ) : selectedPracticeError ? (
        <Text style={{ ...TYPE.meta, color: c.error, paddingVertical: 10, marginHorizontal: 16 }}>{softenErrorMessage(selectedPracticeError)}</Text>
      ) : therapists.length === 0 ? (
        <View style={[styles.emptyInlineState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{t('noPublicProfiles')}</Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
            {t('noPublicProfilesBody')}
          </Text>
        </View>
      ) : (
        therapists.map((therapist) => {
          const therapistSpecializations = Array.isArray(therapist?.specializations) ? therapist.specializations : [];
          return (
            <Pressable key={therapist.id} onPress={() => openTherapistById(therapist.id)} style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Image source={{ uri: therapist.photo }} style={styles.miniAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: c.text }]}>{therapist.fullName ?? 'Profil'}</Text>
                <Text style={[styles.cardTitle, { color: c.muted }]}>{therapist.professionalTitle ?? ''}</Text>
                <View style={[styles.tagRow, { marginTop: 6 }]}>
                  {therapistSpecializations.slice(0, 2).map((specialization) => (
                    <View key={specialization} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                      <Text style={[styles.tagText, { color: c.text }]}>{specialization}</Text>
                    </View>
                  ))}
                  {therapist.homeVisit && (
                    <View style={[styles.tag, { backgroundColor: c.successBg }]}>
                      <Text style={[styles.tagText, { color: c.success }]}>{t('homeVisitTag')}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
          );
        })
      )}

      <Pressable style={[styles.ctaBtn, { backgroundColor: c.accent, marginTop: 4 }]} onPress={() => callPhone(practice?.phone)}>
        <Text style={styles.ctaBtnText}>{t('callPractice')}</Text>
      </Pressable>
    </ScrollView>
  );
}

export function TherapistProfileScreen(props) {
  const {
    HeartButton,
    c,
    callPhone,
    isFavorite,
    setSelectedTherapist,
    styles,
    t,
    th,
    toggleFavorite,
    authToken,
    accountType,
    onBookingRequest,
    availableSlots,
  } = props;

  // Merge availableSlots into th for the booking section
  const thWithSlots = availableSlots !== undefined ? { ...th, availableSlots } : th;

  const [showLoginHint, setShowLoginHint] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);

  const therapistName = typeof th?.fullName === 'string' && th.fullName.trim() ? th.fullName.trim() : 'Profil';
  const therapistLanguages = Array.isArray(th?.languages) ? th.languages : [];
  const therapistAreas = Array.isArray(th?.behandlungsbereiche) ? th.behandlungsbereiche : [];
  const therapistSpecializations = Array.isArray(th?.specializations) ? th.specializations : [];
  const therapistCertifications = Array.isArray(th?.fortbildungen) ? th.fortbildungen : [];
  const therapistPhone = th?.phone ?? '+4312345678';
  const displayEmail = th?.email || null;
  const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
  const canOpenBookingModal = thWithSlots.bookingMode === 'FIRST_APPOINTMENT_REQUEST' && accountType !== 'therapist' && accountType !== 'manager';
  const bookingSlots = Array.isArray(thWithSlots?.availableSlots)
    ? [...thWithSlots.availableSlots].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    : [];
  const slotGroups = bookingSlots.reduce((acc, slot) => {
    const dayKey = getSlotDayKey(slot.startsAt);
    if (!dayKey) return acc;
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(slot);
    return acc;
  }, {});
  const slotDates = Object.keys(slotGroups).sort((a, b) => new Date(a) - new Date(b));
  const slotsForSelectedDate = selectedDate ? (slotGroups[selectedDate] ?? []) : [];
  const visibleSlotsForSelectedDate = slotsForSelectedDate.filter(
    (slot, index, arr) => arr.findIndex((candidate) => formatSlotTime(candidate.startsAt) === formatSlotTime(slot.startsAt)) === index,
  );
  const openEmailComposer = () => {
    if (!displayEmail) return;
    const subject = encodeURIComponent(t('contactSubject').replace('{name}', therapistName));
    Linking.openURL(`mailto:${displayEmail}?subject=${subject}`);
  };

  useEffect(() => {
    if (slotDates.length === 0) {
      setSelectedDate(null);
      setSelectedSlotId(null);
      return;
    }

    if (!selectedDate || !slotDates.includes(selectedDate)) {
      setSelectedDate(slotDates[0]);
      setSelectedSlotId(null);
    }
  }, [selectedDate, slotDates]);

  useEffect(() => {
    if (visibleSlotsForSelectedDate.length === 0) {
      setSelectedSlotId(null);
      return;
    }

    if (!selectedSlotId || !visibleSlotsForSelectedDate.some((slot) => slot.id === selectedSlotId)) {
      setSelectedSlotId(visibleSlotsForSelectedDate[0].id);
    }
  }, [selectedSlotId, visibleSlotsForSelectedDate]);

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setSelectedTherapist(null)} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <HeartButton isSaved={isFavorite(th.id)} onToggle={() => toggleFavorite(th)} unsavedColor={c.muted} hitSlop={iconHitSlop} style={{ paddingHorizontal: 10, paddingVertical: 10 }} />
          <Pressable
            onPress={() => sharePublicLink({
              title: therapistName,
              url: `https://revio.app/t/${th.id}`,
              message: `${therapistName} – ${th.professionalTitle ?? ''}\nhttps://revio.app/t/${th.id}`,
            })}
            hitSlop={iconHitSlop}
            style={{ paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Ionicons name="share-outline" size={22} color={c.primary} />
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.practiceHeader,
          {
            backgroundColor: c.card,
            borderColor: c.border,
            paddingTop: 20,
            paddingBottom: 20,
            alignItems: 'stretch',
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <View style={{ position: 'relative' }}>
            {th.photo ? (
              <Image source={{ uri: th.photo }} style={[styles.therapistAvatarLarge, { width: 96, height: 96, borderRadius: 48 }]} />
            ) : (
              <View style={[styles.therapistAvatarLarge, { width: 96, height: 96, borderRadius: 48, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>
                  {getPracticeInitials(therapistName)}
                </Text>
              </View>
            )}
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.card }}>
              <Ionicons name="checkmark" size={18} color={c.background} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.practiceHeaderName, { color: c.text, textAlign: 'left', marginBottom: 4 }]}>{therapistName}</Text>
            <Text style={[styles.practiceHeaderCity, { color: c.muted, textAlign: 'left' }]}>{th.professionalTitle ?? ''}</Text>
          </View>
        </View>

        <View style={[styles.tagRow, { marginTop: 16, gap: 10, justifyContent: 'flex-start' }]}>
          <View style={[styles.tag, { backgroundColor: c.mutedBg, borderWidth: 1, borderColor: th.homeVisit ? c.success : c.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 }]}>
            <Ionicons name="home-outline" size={15} color={th.homeVisit ? c.success : c.muted} />
            <Text style={[styles.tagText, { color: th.homeVisit ? c.success : c.muted, fontSize: 13 }]}>
              {th.homeVisit
                ? `Hausbesuch${th.serviceRadiusKm ? ` bis ${th.serviceRadiusKm} km` : ''}`
                : 'Kein Hausbesuch'}
            </Text>
          </View>
          {th.city ? (
            <View style={[styles.tag, { backgroundColor: c.mutedBg, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 }]}>
              <Ionicons name="location-outline" size={15} color={c.muted} />
              <Text style={[styles.tagText, { color: c.text, fontSize: 13 }]}>{th.city}</Text>
            </View>
          ) : null}
          <View style={[styles.tag, { backgroundColor: c.mutedBg, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 }]}>
            <Ionicons name="card-outline" size={15} color={c.muted} />
            <Text style={[styles.tagText, { color: c.text, fontSize: 13 }]}>{th.kassenart || 'Alle Kassen'}</Text>
          </View>
        </View>

        {displayEmail ? (
          <>
            <View style={{ height: 1, backgroundColor: c.border, marginTop: 18, marginBottom: 18, opacity: 0.8 }} />
            <View style={{ minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="mail-outline" size={22} color={c.accent} />
              <Text style={{ color: c.text, fontSize: 15, flexShrink: 1 }}>{displayEmail}</Text>
            </View>
          </>
        ) : null}

        {canOpenBookingModal ? (
          <Pressable
            style={[styles.ctaBtn, { backgroundColor: c.primary, marginTop: 16 }]}
            onPress={() => setShowBookingModal(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Ionicons name="calendar-outline" size={20} color="#fff" />
              <Text style={styles.ctaBtnText}>Freie Termine ansehen</Text>
            </View>
          </Pressable>
        ) : null}

        {th.bio ? (
          <Text style={{ color: c.muted, fontSize: 15, marginTop: 18, lineHeight: 24 }}>
            {th.bio}
          </Text>
        ) : null}
      </View>

      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }]}>
        {therapistAreas.length > 0 && (
          <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 0 }]}>{t('behandlungLabel')}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </View>
            <View style={styles.tagRow}>
              {therapistAreas.map((area) => (
                <View key={area} style={[styles.tag, { backgroundColor: c.mutedBg, paddingHorizontal: 18, paddingVertical: 10 }]}>
                  <Text style={[styles.tagText, { color: c.text, fontSize: 13 }]}>{area}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {therapistSpecializations.length > 0 && (
          <View style={{ borderTopWidth: therapistAreas.length > 0 ? 1 : 0, borderTopColor: c.border, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 0 }]}>{t('specsLabel')}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </View>
            <View style={styles.tagRow}>
              {therapistSpecializations.map((specialization) => (
                <View key={specialization} style={[styles.tag, { backgroundColor: c.mutedBg, paddingHorizontal: 18, paddingVertical: 10 }]}>
                  <Text style={[styles.tagText, { color: c.text, fontSize: 13 }]}>{specialization}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ borderTopWidth: (therapistAreas.length > 0 || therapistSpecializations.length > 0) ? 1 : 0, borderTopColor: c.border }}>
          <View style={{ flexDirection: 'row' }}>
            {[
              {
                label: 'KASSENART',
                icon: 'card-outline',
                value: th.kassenart || 'Alle',
              },
              {
                label: 'SPRACHEN',
                icon: 'chatbubble-outline',
                value: therapistLanguages.length > 0
                  ? therapistLanguages.map(getLangLabel).join(', ')
                  : '—',
              },
            ].map((item, index) => (
              <View key={item.label} style={{ flex: 1, minWidth: 0, paddingHorizontal: 18, paddingVertical: 18, borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: c.border }}>
                <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 12 }]}>{item.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={item.icon} size={18} color={c.text} />
                  <Text style={{ color: c.text, fontSize: 14, flexShrink: 1 }}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 18, paddingVertical: 18 }}>
            <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 12 }]}>DISTANZ</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="navigate-outline" size={18} color={c.text} />
              <Text style={{ color: c.text, fontSize: 14, flexShrink: 1 }}>
                {th.distKm != null ? `${formatDist(th.distKm)} entfernt` : '—'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {therapistCertifications.length > 0 && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('certsLabel')}</Text>
          <View style={styles.tagRow}>
            {therapistCertifications.map((qualification) => (
              <View key={qualification} style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success }]}>
                <Text style={[styles.tagText, { color: c.success }]}>{qualification}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {displayEmail ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('contactTitle')}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
            {t('contactBody')}{th.city ? ` (${th.city})` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable style={[styles.ctaBtn, { backgroundColor: c.primary, flex: 1 }]} onPress={openEmailComposer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Ionicons name="mail-outline" size={20} color="#fff" />
                <Text style={styles.ctaBtnText}>{t('writeEmail')}</Text>
              </View>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <Text style={{ color: c.primary, fontSize: 14 }}>{displayEmail}</Text>
            <Ionicons name="copy-outline" size={18} color={c.muted} />
          </View>
        </View>
      ) : null}

      <Modal visible={showBookingModal} transparent animationType="slide" onRequestClose={() => setShowBookingModal(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setShowBookingModal(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 12,
              paddingHorizontal: 20,
              paddingBottom: 24,
              width: '100%',
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: c.border,
              maxHeight: '86%',
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: c.border }} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>Freie Termine</Text>
              <Pressable onPress={() => setShowBookingModal(false)} hitSlop={iconHitSlop}>
                <Ionicons name="close-outline" size={26} color={c.muted} />
              </Pressable>
            </View>

            {bookingSlots.length > 0 ? (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
                  {slotDates.map((dayKey) => {
                    const active = selectedDate === dayKey;
                    const label = formatSlotDayLabel(dayKey);
                    return (
                      <Pressable
                        key={dayKey}
                        onPress={() => {
                          setSelectedDate(dayKey);
                          setSelectedSlotId(null);
                        }}
                        style={{
                          minWidth: 82,
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: active ? c.primary : c.border,
                          backgroundColor: active ? c.primary : c.mutedBg,
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        }}
                      >
                        <Text style={{ color: active ? '#fff' : c.text, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' }}>
                          {label.weekday}
                        </Text>
                        <Text style={{ color: active ? '#fff' : c.muted, fontSize: 13 }}>
                          {label.date}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
                  {visibleSlotsForSelectedDate.map((slot) => {
                    const active = selectedSlotId === slot.id;
                    return (
                      <Pressable
                        key={slot.id}
                        onPress={() => setSelectedSlotId(slot.id)}
                        style={{
                          width: '30%',
                          minWidth: 88,
                          paddingVertical: 14,
                          paddingHorizontal: 8,
                          borderRadius: 18,
                          borderWidth: 1.5,
                          borderColor: active ? c.primary : c.border,
                          backgroundColor: active ? c.primaryBg : c.card,
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '700', color: active ? c.primary : c.text }}>
                          {formatSlotTime(slot.startsAt)}
                        </Text>
                        <Text style={{ fontSize: 12, color: active ? c.primary : c.muted }}>
                          {slot.durationMin ?? 20} Min
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  style={[styles.ctaBtn, { backgroundColor: selectedSlotId ? c.primary : c.border, marginTop: 18, opacity: selectedSlotId ? 1 : 0.85 }]}
                  onPress={() => {
                    if (!selectedSlotId) return;
                    if (authToken && accountType === 'patient') {
                      setShowBookingModal(false);
                      onBookingRequest({ ...th, selectedSlotId });
                    } else {
                      setShowBookingModal(false);
                      setShowLoginHint(true);
                    }
                  }}
                  disabled={!selectedSlotId}
                >
                  <Text style={styles.ctaBtnText}>Termin buchen</Text>
                </Pressable>
              </ScrollView>
            ) : (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
                Aktuell keine freien Termine verfügbar. Kontaktiere den Therapeuten direkt.
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Login-Hinweis Modal */}
      <Modal visible={showLoginHint} transparent animationType="fade" onRequestClose={() => setShowLoginHint(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => setShowLoginHint(false)}
        >
          <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="calendar-outline" size={26} color={c.primary} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, textAlign: 'center', marginBottom: 8 }}>
                Anmeldung erforderlich
              </Text>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
                Um einen Termin zu buchen, melde dich mit deinem Patienten-Konto an oder erstelle ein kostenloses Konto.
              </Text>
            </View>
            <Pressable
              onPress={() => { setShowLoginHint(false); onBookingRequest(null); }}
              style={{ backgroundColor: c.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginBottom: 10 }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Jetzt anmelden</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowLoginHint(false)}
              style={{ paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ color: c.muted, fontSize: 14 }}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
