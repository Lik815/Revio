import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import { ReviewComposerModal } from '../../components/ReviewComposerModal';
import { ReviewsSection } from '../../components/ReviewsSection';
import {
  Clipboard,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import {
  formatDist,
  getBaseUrl,
  getLangLabel,
  getPracticeInitials,
  getPublicTherapistUrl,
  resolveMediaUrl,
  TUNNEL_HEADERS,
} from '../../utils/app-utils';

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

export function TherapistProfileContent(props) {
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
  const insets = useSafeAreaInsets();

  const [showLoginHint, setShowLoginHint] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const therapistName = typeof th?.fullName === 'string' && th.fullName.trim() ? th.fullName.trim() : 'Profil';
  const therapistPublicUrl = th?.id ? getPublicTherapistUrl(th.id) : 'https://www.my-revio.de';
  const therapistLanguages = Array.isArray(th?.languages) ? th.languages : [];
  const therapistSpecializations = Array.isArray(th?.specializations) ? th.specializations : [];
  const therapistAreasRaw = Array.isArray(th?.behandlungsbereiche) ? th.behandlungsbereiche : [];
  const normalizeList = (items) => items.map((i) => String(i).trim().toLowerCase()).filter(Boolean).sort();
  const listsEqual = (a, b) => { const la = normalizeList(a); const lb = normalizeList(b); return la.length === lb.length && la.every((v, i) => v === lb[i]); };
  const therapistAreas = listsEqual(therapistAreasRaw, therapistSpecializations) ? [] : therapistAreasRaw;
  const therapistCertifications = Array.isArray(th?.fortbildungen) && th.fortbildungen.length > 0
    ? th.fortbildungen
    : Array.isArray(th?.certifications) ? th.certifications : [];
  const therapistHeilmittel = Array.isArray(th?.heilmittel) ? th.heilmittel : [];
  const therapistPhone = th?.phone || null;
  const displayEmail = th?.email || null;
  const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
  const canOpenBookingModal = thWithSlots.bookingMode === 'FIRST_APPOINTMENT_REQUEST' && accountType !== 'therapist' && accountType !== 'manager';
  const bookingSlots = Array.isArray(thWithSlots?.availableSlots)
    ? [...thWithSlots.availableSlots].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    : [];
  const hasOnlineBooking = canOpenBookingModal;
  const showBookingBar = accountType !== 'therapist' && accountType !== 'manager';
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

  useEffect(() => {
    if (!authToken || !th?.id) return;
    let cancelled = false;
    fetch(`${getBaseUrl()}/therapists/${th.id}/review-eligibility`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setReviewEligibility(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authToken, th?.id]);

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: showBookingBar ? 100 : 20 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: insets.top + 12 }}>
        <BackButton c={c} label={t('backBtn')} onPress={() => setSelectedTherapist(null)} topInset={false} style={{ paddingTop: 0 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <HeartButton isSaved={isFavorite(th.id)} onToggle={() => toggleFavorite(th)} unsavedColor={c.muted} hitSlop={iconHitSlop} style={{ paddingHorizontal: 10, paddingVertical: 10 }} />
          <Pressable
            onPress={() => sharePublicLink({
              title: therapistName,
              url: therapistPublicUrl,
              message: `${therapistName} – ${th.professionalTitle ?? ''}\n${therapistPublicUrl}`,
            })}
            hitSlop={iconHitSlop}
            style={{ paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Ionicons name="share-outline" size={22} color={c.primary} />
          </Pressable>
        </View>
      </View>

      {/* ── Header-Card ───────────────────────────────────────────────────── */}
      <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border, paddingTop: 20, paddingBottom: 20, alignItems: 'stretch' }]}>

        {/* Avatar + Name + Titel */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <View style={{ position: 'relative' }}>
            {th.photo ? (
              <Image source={{ uri: th.photo }} style={[styles.therapistAvatarLarge, { width: 96, height: 96, borderRadius: 48 }]} />
            ) : (
              <View style={[styles.therapistAvatarLarge, { width: 96, height: 96, borderRadius: 48, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>{getPracticeInitials(therapistName)}</Text>
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

        {/* Chip-Reihe 1: Hausbesuch · Ort · Sprachen */}
        <View style={[styles.tagRow, { marginTop: 16, gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }]}>
          <View style={[styles.tag, { backgroundColor: c.mutedBg, borderWidth: 1, borderColor: th.homeVisit ? c.success : c.border, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 }]}>
            <Ionicons name="home-outline" size={14} color={th.homeVisit ? c.success : c.muted} />
            <Text style={[styles.tagText, { color: th.homeVisit ? c.success : c.muted, fontSize: 13 }]}>
              {th.homeVisit ? `Hausbesuch${th.serviceRadiusKm ? ` bis ${th.serviceRadiusKm} km` : ''}` : 'Kein Hausbesuch'}
            </Text>
          </View>
          {th.city ? (
            <View style={[styles.tag, { backgroundColor: c.mutedBg, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 }]}>
              <Ionicons name="location-outline" size={14} color={c.muted} />
              <Text style={[styles.tagText, { color: c.text, fontSize: 13 }]}>{th.city}</Text>
            </View>
          ) : null}
          {therapistLanguages.length > 0 ? (
            <View style={[styles.tag, { backgroundColor: c.mutedBg, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 }]}>
              <Ionicons name="chatbubble-outline" size={14} color={c.muted} />
              <Text style={[styles.tagText, { color: c.text, fontSize: 13 }]}>{therapistLanguages.map(getLangLabel).join(', ')}</Text>
            </View>
          ) : null}
        </View>

        {/* Chip-Reihe 2: Kassenart */}
        <View style={{ marginTop: 8 }}>
          <View style={[styles.tag, { alignSelf: 'flex-start', backgroundColor: c.mutedBg, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10 }]}>
            <Ionicons name="card-outline" size={13} color={c.muted} />
            <Text style={[styles.tagText, { color: c.muted, fontSize: 12 }]}>{th.kassenart || 'Alle Kassen'}</Text>
          </View>
        </View>

        {/* Info-Rows: Distanz · Telefon · E-Mail */}
        {(th.distKm != null || displayEmail || therapistPhone) ? (
          <View style={{ marginTop: 16, borderWidth: 1, borderColor: c.border, borderRadius: 12, overflow: 'hidden' }}>
            {th.distKm != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: (therapistPhone || displayEmail) ? 1 : 0, borderBottomColor: c.border }}>
                <Ionicons name="navigate-outline" size={18} color={c.primary} />
                <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{formatDist(th.distKm)} entfernt</Text>
                <Ionicons name="chevron-forward" size={14} color={c.muted} />
              </View>
            ) : null}
            {therapistPhone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${therapistPhone}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: displayEmail ? 1 : 0, borderBottomColor: c.border }}
              >
                <Ionicons name="call-outline" size={18} color={c.primary} />
                <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{therapistPhone}</Text>
                <Ionicons name="chevron-forward" size={14} color={c.muted} />
              </Pressable>
            ) : null}
            {displayEmail ? (
              <Pressable
                onPress={openEmailComposer}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 16 }}
              >
                <Ionicons name="mail-outline" size={18} color={c.primary} />
                <Text style={{ color: c.text, fontSize: 15, flex: 1 }} numberOfLines={1}>{displayEmail}</Text>
                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    Clipboard.setString(displayEmail);
                    if (Platform.OS === 'android') ToastAndroid.show('E-Mail kopiert', ToastAndroid.SHORT);
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color={c.muted} />
                </Pressable>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* ── Bio-Card ──────────────────────────────────────────────────────── */}
      {th.bio ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ color: c.muted, fontSize: 15, lineHeight: 24 }}>{th.bio}</Text>
        </View>
      ) : null}

      {/* ── Content-Cards ─────────────────────────────────────────────────── */}
      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }]}>

        {/* 0. Heilmittel — verordnungsfähige Leistungen, die behandelt werden */}
        {therapistHeilmittel.length > 0 && (
          <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 0 }]}>Heilmittel</Text>
            </View>
            <View style={styles.tagRow}>
              {therapistHeilmittel.map((item) => (
                <View key={item} style={[styles.tag, { backgroundColor: c.primary, paddingHorizontal: 18, paddingVertical: 10 }]}>
                  <Text style={[styles.tagText, { color: '#fff', fontSize: 13 }]}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 1. Spezialisierungen */}
        {therapistSpecializations.length > 0 && (
          <View style={{ borderTopWidth: therapistHeilmittel.length > 0 ? 1 : 0, borderTopColor: c.border, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 0 }]}>{t('specsLabel')}</Text>
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

        {/* 2. Behandlungsbereiche */}
        {therapistAreas.length > 0 && (
          <View style={{ borderTopWidth: (therapistHeilmittel.length > 0 || therapistSpecializations.length > 0) ? 1 : 0, borderTopColor: c.border, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 0 }]}>{t('behandlungLabel')}</Text>
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

        {/* 3. Fortbildungen */}
        {therapistCertifications.length > 0 && (
          <View style={{ borderTopWidth: (therapistHeilmittel.length > 0 || therapistSpecializations.length > 0 || therapistAreas.length > 0) ? 1 : 0, borderTopColor: c.border, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 }}>
            <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 14 }]}>{t('certsLabel')}</Text>
            <View style={styles.tagRow}>
              {therapistCertifications.map((cert) => (
                <View key={cert} style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success, paddingHorizontal: 18, paddingVertical: 10 }]}>
                  <Text style={[styles.tagText, { color: c.success, fontSize: 13 }]}>{cert}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 4. Summary-Leiste: Kassenart · Sprachen */}
        <View style={{ borderTopWidth: (therapistHeilmittel.length > 0 || therapistSpecializations.length > 0 || therapistAreas.length > 0 || therapistCertifications.length > 0) ? 1 : 0, borderTopColor: c.border }}>
          <View style={{ flexDirection: 'row' }}>
            {[
              { label: 'KASSENART', icon: 'card-outline', value: th.kassenart || 'Alle' },
              { label: 'SPRACHEN', icon: 'chatbubble-outline', value: therapistLanguages.length > 0 ? therapistLanguages.map(getLangLabel).join(', ') : '—' },
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
        </View>
      </View>

      {reviewEligibility?.eligible ? (
        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          <Pressable
            onPress={() => setShowReviewModal(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.success ?? '#5A9E8E', borderRadius: 999, paddingVertical: 14, gap: 8 }}
          >
            <Ionicons name="star-outline" size={17} color="#fff" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{t('writeReviewCta')}</Text>
          </Pressable>
        </View>
      ) : null}

      {reviewEligibility?.alreadyReviewed ? (
        <View style={{ paddingHorizontal: 18, paddingTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Ionicons
                key={n}
                name={n <= (reviewEligibility.review?.rating ?? 0) ? 'star' : 'star-outline'}
                size={16}
                color={c.success ?? '#5A9E8E'}
              />
            ))}
          </View>
          <Text style={{ fontSize: 13, color: c.muted, fontWeight: '600' }}>{t('reviewAlreadyGivenMsg')}</Text>
        </View>
      ) : null}

      <ReviewsSection c={c} t={t} styles={styles} therapistId={th.id} authToken={authToken} />

      <ReviewComposerModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        c={c}
        t={t}
        authToken={authToken}
        bookingId={reviewEligibility?.bookingId}
        onSubmitted={(review) => {
          setReviewEligibility({ eligible: false, alreadyReviewed: true, review });
          setShowReviewModal(false);
        }}
      />

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

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: therapistHeilmittel.length > 0 ? 4 : 16 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>Freie Termine</Text>
              <Pressable onPress={() => setShowBookingModal(false)} hitSlop={iconHitSlop}>
                <Ionicons name="close-outline" size={26} color={c.muted} />
              </Pressable>
            </View>

            {therapistHeilmittel.length > 0 ? (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginBottom: 16 }} numberOfLines={2}>
                Behandelte Heilmittel: {therapistHeilmittel.join(', ')}
              </Text>
            ) : null}

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
              onPress={() => { setShowLoginHint(false); onBookingRequest({ ...th, selectedSlotId }); }}
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

    {/* Fixed booking bar above the bottom navigation */}
    {showBookingBar && (
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
        {hasOnlineBooking ? (
          <Pressable
            style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            onPress={() => setShowBookingModal(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Freie Termine ansehen</Text>
          </Pressable>
        ) : (
          <View style={{ borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.mutedBg ?? c.card, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ color: c.muted, fontSize: 15, fontWeight: '600' }}>Keine freien Termine online</Text>
          </View>
        )}
      </View>
    )}
    </View>
  );
}
