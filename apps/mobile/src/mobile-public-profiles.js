import React from 'react';
import { Ionicons } from '@expo/vector-icons';
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
  formatDist,
  getLangLabel,
  getPracticeInitials,
  getPrimaryPractice,
  RADIUS,
  resolveMediaUrl,
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

  const therapists = selectedPracticeTherapists;
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
            <Ionicons name={isPracticeFavorite(practice.id) ? 'heart' : 'heart-outline'} size={22} color={isPracticeFavorite(practice.id) ? c.saved : c.muted} />
          </Pressable>
          <Pressable
            onPress={() => sharePublicLink({
              title: practice.name,
              url: `https://revio.app/p/${practice.id}`,
              message: `${practice.name} – ${practice.city}\nhttps://revio.app/p/${practice.id}`,
            })}
            hitSlop={iconHitSlop}
            style={{ paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Ionicons name="share-outline" size={22} color={c.primary} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border }]}>
        {practice.logo && !practiceLogoError ? (
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
              {practice.name.split(' ').filter((word) => word.length > 2).map((word) => word[0]).join('').toUpperCase().slice(0, 2) || practice.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[styles.practiceHeaderName, { color: c.text }]}>{practice.name}</Text>
        <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{practice.city}</Text>
      </View>

      {[
        practice.address && { icon: '📍', label: practice.address, onPress: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practice.address)}`) },
        practice.phone && { icon: '📞', label: practice.phone, onPress: () => Linking.openURL(`tel:${practice.phone}`) },
        practice.hours && { icon: '🕐', label: practice.hours, onPress: null },
      ].filter(Boolean).map((row) => (
        <Pressable key={row.label} onPress={row.onPress ?? undefined} style={[styles.detailRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.detailIcon}>{row.icon}</Text>
          <Text style={[styles.detailText, { color: row.onPress ? c.primary : c.text }]}>{row.label}</Text>
        </Pressable>
      ))}

      {practice.photos?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {practice.photos.map((uri, index) => (
            <Image key={index} source={{ uri }} style={{ width: 220, height: 145, borderRadius: RADIUS.sm }} />
          ))}
        </ScrollView>
      )}

      {!!practice.description && (
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
        therapists.map((therapist) => (
          <Pressable key={therapist.id} onPress={() => openTherapistById(therapist.id)} style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Image source={{ uri: therapist.photo }} style={styles.miniAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: c.text }]}>{therapist.fullName}</Text>
              <Text style={[styles.cardTitle, { color: c.muted }]}>{therapist.professionalTitle}</Text>
              <View style={[styles.tagRow, { marginTop: 6 }]}>
                {therapist.specializations.slice(0, 2).map((specialization) => (
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
        ))
      )}

      <Pressable style={[styles.ctaBtn, { backgroundColor: c.accent, marginTop: 4 }]} onPress={() => callPhone(practice.phone)}>
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
    openPractice,
    setSelectedTherapist,
    styles,
    t,
    th,
    toggleFavorite,
  } = props;

  const primaryPractice = getPrimaryPractice(th);
  const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
  const openEmailComposer = () => {
    if (!th.email) return;
    const subject = encodeURIComponent(t('contactSubject').replace('{name}', th.fullName));
    Linking.openURL(`mailto:${th.email}?subject=${subject}`);
  };

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
              title: th.fullName,
              url: `https://revio.app/t/${th.id}`,
              message: `${th.fullName} – ${th.professionalTitle}\nhttps://revio.app/t/${th.id}`,
            })}
            hitSlop={iconHitSlop}
            style={{ paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Ionicons name="share-outline" size={22} color={c.primary} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border }]}>
        {th.photo ? (
          <Image source={{ uri: th.photo }} style={styles.therapistAvatarLarge} />
        ) : (
          <View style={[styles.therapistAvatarLarge, { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>
              {th.fullName.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.profileNameRow}>
          <Text style={[styles.practiceHeaderName, { color: c.text }]}>{th.fullName}</Text>
        </View>
        <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{th.professionalTitle}</Text>
        {((th.languages ?? []).length > 0 || th.homeVisit) && (
          <View style={[styles.tagRow, { justifyContent: 'center', marginTop: 8 }]}>
            {(th.languages ?? []).map((language) => (
              <View key={language} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.muted }]}>{getLangLabel(language)}</Text>
              </View>
            ))}
            {th.homeVisit && (
              <View style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success }]}>
                <Text style={[styles.tagText, { color: c.success }]}>🏠 {th.serviceRadiusKm ? t('homeVisitRadius').replace('{radius}', th.serviceRadiusKm) : t('homeVisitTag')}</Text>
              </View>
            )}
            {th.kassenart ? (
              <View style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.muted }]}>{th.kassenart}</Text>
              </View>
            ) : null}
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          {(primaryPractice?.city || th.city) ? (
            <View style={[styles.metaPill, { backgroundColor: c.mutedBg }]}>
              <Text style={[styles.metaPillText, { color: c.text }]}>{primaryPractice?.city || th.city}</Text>
            </View>
          ) : null}
          {th.distKm != null ? (
            <View style={[styles.metaPill, { backgroundColor: c.successBg }]}>
              <Text style={[styles.metaPillText, { color: c.success }]}>{t('distanceAway').replace('{dist}', formatDist(th.distKm))}</Text>
            </View>
          ) : null}
          {th.practices?.length > 1 ? (
            <View style={[styles.metaPill, { backgroundColor: c.mutedBg }]}>
              <Text style={[styles.metaPillText, { color: c.text }]}>{t('nPractices').replace('{n}', th.practices.length)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {(th.homeVisit || th.availability) && (
        <View style={[styles.infoSection, { backgroundColor: c.successBg, borderColor: c.success, borderWidth: 1 }]}>
          <Text style={[styles.filterSectionTitle, { color: c.success }]}>{t('contactAndArea')}</Text>
          {th.serviceRadiusKm ? (
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailIcon}>📍</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.success }]}>{t('serviceAreaLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{t('serviceAreaValue').replace('{radius}', th.serviceRadiusKm)}</Text>
              </View>
            </View>
            ) : null}
          {th.availability ? (
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailIcon}>🕐</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.success }]}>{t('availabilityLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.availability}</Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {th.bio ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('aboutLabel')}</Text>
          <Text style={[styles.infoBody, { color: c.text, fontSize: 15 }]}>{th.bio}</Text>
        </View>
      ) : null}

      {th.behandlungsbereiche?.length > 0 && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('behandlungLabel')}</Text>
          <View style={styles.tagRow}>
            {th.behandlungsbereiche.map((area) => (
              <View key={area} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.text }]}>{area}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {(th.specializations ?? []).length > 0 && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('specsLabel')}</Text>
          <View style={styles.tagRow}>
            {th.specializations.map((specialization) => (
              <View key={specialization} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.text }]}>{specialization}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {th.fortbildungen?.length > 0 && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('certsLabel')}</Text>
          <View style={styles.tagRow}>
            {th.fortbildungen.map((qualification) => (
              <View key={qualification} style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success }]}>
                <Text style={[styles.tagText, { color: c.success }]}>{qualification}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {(th.kassenart || th.distKm != null || th.availability || th.website) && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('detailsLabel')}</Text>
          {th.kassenart ? (
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailIcon}>💳</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.muted }]}>{t('insuranceLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.kassenart.charAt(0).toUpperCase() + th.kassenart.slice(1)}</Text>
              </View>
            </View>
          ) : null}
          {th.distKm != null ? (
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailIcon}>📍</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.muted }]}>{t('distanceLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{t('distanceAway').replace('{dist}', formatDist(th.distKm))}</Text>
              </View>
            </View>
          ) : null}
          {th.availability ? (
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailIcon}>🕐</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.muted }]}>{t('availabilityLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.availability}</Text>
              </View>
            </View>
          ) : null}
          {th.website ? (
            <Pressable style={styles.detailInfoRow} onPress={() => Linking.openURL(`https://${th.website}`)}>
              <Text style={styles.detailIcon}>🌐</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.muted }]}>Website</Text>
                <Text style={[styles.detailInfoValue, { color: c.primary }]}>{th.website}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      )}

      {primaryPractice ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('quickContact')}</Text>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{primaryPractice.name}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
            {primaryPractice.address || primaryPractice.city}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable style={[styles.ctaBtn, { backgroundColor: c.accent, flex: 1 }]} onPress={() => callPhone(primaryPractice.phone)}>
              <Text style={styles.ctaBtnText}>{t('callPractice')}</Text>
            </Pressable>
            <Pressable
              style={[styles.ctaBtnSecondary, { borderColor: c.border, backgroundColor: c.mutedBg, flex: 1 }]}
              onPress={() => { setSelectedTherapist(null); openPractice(primaryPractice); }}
            >
              <Text style={[styles.ctaBtnSecondaryText, { color: c.text }]}>{t('viewPracticeAction')}</Text>
            </Pressable>
          </View>
        </View>
      ) : th.email ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('contactTitle')}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
            {t('contactBody')}{th.city ? ` (${th.city})` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable style={[styles.ctaBtn, { backgroundColor: c.primary, flex: 1 }]} onPress={openEmailComposer}>
              <Text style={styles.ctaBtnText}>{t('writeEmail')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {th.practices?.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: c.text }]}>{t('practicesLabel')}</Text>
          {th.practices.map((practice) => (
            <Pressable
              key={practice.id}
              onPress={() => { setSelectedTherapist(null); openPractice(practice); }}
              style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}
            >
              <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                <Text style={[styles.practiceInitialText, { color: c.muted }]}>{getPracticeInitials(practice.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.practiceName, { color: c.text }]}>{practice.name}</Text>
                <Text style={[styles.practiceCity, { color: c.muted }]}>{practice.city}</Text>
                {!!practice.address && <Text style={[styles.practiceCity, { color: c.muted }]} numberOfLines={1}>{practice.address}</Text>}
              </View>
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}
