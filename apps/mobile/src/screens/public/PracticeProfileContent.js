import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/BackButton';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import {
  getPracticeInitials,
  getPublicPracticeUrl,
  RADIUS,
  resolveMediaUrl,
  softenErrorMessage,
  TYPE,
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

export function PracticeProfileContent(props) {
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
  const practicePublicUrl = practice?.id ? getPublicPracticeUrl(practice.id) : 'https://www.my-revio.de';
  const therapists = Array.isArray(selectedPracticeTherapists) ? selectedPracticeTherapists : [];
  const practicePhotos = Array.isArray(practice?.photos) ? practice.photos.filter(Boolean) : [];
  const specialties = Array.isArray(practice?.specialties) ? practice.specialties.filter(Boolean) : [];
  const services = Array.isArray(practice?.services) ? practice.services.filter(Boolean) : [];
  const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
  const [practiceLogoError, setPracticeLogoError] = React.useState(false);
  const insets = useSafeAreaInsets();
  const scrollRef = React.useRef(null);
  const [teamY, setTeamY] = React.useState(0);
  const scrollToTeam = () => scrollRef.current?.scrollTo?.({ y: Math.max(teamY - 12, 0), animated: true });

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: insets.top + 12 }}>
        <BackButton c={c} label={t('backBtn')} onPress={() => setSelectedPractice(null)} topInset={false} style={{ paddingTop: 0 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => toggleFavoritePractice(practice)} hitSlop={iconHitSlop} style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
            <Ionicons name={isPracticeFavorite(practice?.id) ? 'heart' : 'heart-outline'} size={22} color={isPracticeFavorite(practice?.id) ? c.saved : c.muted} />
          </Pressable>
          <Pressable
            onPress={() => sharePublicLink({
              title: practiceName,
              url: practicePublicUrl,
              message: `${practiceName} – ${practiceCity}\n${practicePublicUrl}`,
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
        practice?.address && { icon: 'location-outline', label: practice.address, onPress: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practice.address)}`) },
        practice?.phone && { icon: 'call-outline', label: practice.phone, onPress: () => Linking.openURL(`tel:${practice.phone}`) },
        practice?.email && { icon: 'mail-outline', label: practice.email, onPress: () => Linking.openURL(`mailto:${practice.email}`) },
        practice?.website && { icon: 'globe-outline', label: practice.website, onPress: () => Linking.openURL(/^https?:\/\//.test(practice.website) ? practice.website : `https://${practice.website}`) },
        (practice?.openingHours || practice?.hours) && { icon: 'time-outline', label: practice.openingHours || practice.hours, onPress: null },
      ].filter(Boolean).map((row) => (
        <Pressable key={row.label} onPress={row.onPress ?? undefined} style={[styles.detailRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name={row.icon} size={18} color={row.onPress ? c.primary : c.muted} />
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

      {(specialties.length > 0 || services.length > 0) && (
        <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 4, gap: 12 }}>
          {specialties.length > 0 && (
            <View>
              <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 6, textTransform: 'none', letterSpacing: 0.5 }}>{t('practiceSpecialtiesLabel')}</Text>
              <View style={styles.tagRow}>
                {specialties.map((s) => (
                  <View key={`spec-${s}`} style={[styles.tag, { backgroundColor: c.primaryBg }]}>
                    <Text style={[styles.tagText, { color: c.primary }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {services.length > 0 && (
            <View>
              <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 6, textTransform: 'none', letterSpacing: 0.5 }}>{t('practiceServicesLabel')}</Text>
              <View style={styles.tagRow}>
                {services.map((s) => (
                  <View key={`svc-${s}`} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                    <Text style={[styles.tagText, { color: c.text }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {therapists.length > 0 && (
        <Pressable style={[styles.ctaBtn, { backgroundColor: c.primary, marginTop: 8 }]} onPress={scrollToTeam}>
          <Text style={styles.ctaBtnText}>{t('selectTherapist')}</Text>
        </Pressable>
      )}

      <View onLayout={(e) => setTeamY(e.nativeEvent.layout.y)}>
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
              {therapist.photo ? (
                <Image source={{ uri: therapist.photo }} style={styles.miniAvatar} />
              ) : (
                <View style={[styles.miniAvatar, { backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.primary }}>{getPracticeInitials(therapist.fullName ?? 'Profil')}</Text>
                </View>
              )}
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
                  {therapist.requestable && (
                    <View style={[styles.tag, { backgroundColor: c.successBg }]}>
                      <Text style={[styles.tagText, { color: c.success }]}>{t('directlyBookable')}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
          );
        })
      )}
      </View>

      {!!practice?.phone && (
        <Pressable
          style={[styles.ctaBtn, therapists.length === 0
            ? { backgroundColor: c.primary, marginTop: 8 }
            : { backgroundColor: c.mutedBg, borderWidth: 1, borderColor: c.border, marginTop: 8 }]}
          onPress={() => callPhone(practice?.phone)}
        >
          <Text style={[styles.ctaBtnText, therapists.length > 0 && { color: c.text }]}>{t('callPractice')}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
