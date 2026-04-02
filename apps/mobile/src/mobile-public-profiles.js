import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatDist,
  getBaseUrl,
  getLangLabel,
  getPracticeInitials,
  getPrimaryPractice,
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
    webAlert?.('Link kopiert!');
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
        {practice.logo ? (
          <Image source={{ uri: resolveMediaUrl(practice.logo) }} style={[styles.practiceLogoLarge, { borderRadius: RADIUS.md }]} />
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
          <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 6, textTransform: 'none', letterSpacing: 0.5 }}>Über die Praxis</Text>
          <Text style={{ ...TYPE.body, color: c.text }}>{practice.description}</Text>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: c.text, marginTop: 4 }]}>
        {t('therapistsLabel')}{!selectedPracticeLoading && !selectedPracticeError ? ` (${therapists.length})` : ''}
      </Text>
      {selectedPracticeLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <ActivityIndicator color={c.primary} />
          <Text style={{ color: c.muted, marginTop: 8, fontSize: 13 }}>Lade Therapeuten…</Text>
        </View>
      ) : selectedPracticeError ? (
        <Text style={{ ...TYPE.meta, color: c.error, paddingVertical: 10, marginHorizontal: 16 }}>{softenErrorMessage(selectedPracticeError)}</Text>
      ) : therapists.length === 0 ? (
        <View style={[styles.emptyInlineState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>Aktuell keine oeffentlichen Profile</Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
            Diese Praxis hat momentan keine freigeschalteten Therapeut:innen im Verzeichnis.
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
    onBookingSuccess,
    openPractice,
    setSelectedTherapist,
    styles,
    t,
    th,
    toggleFavorite,
  } = props;

  const primaryPractice = getPrimaryPractice(th);
  const iconHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
  const [showRequestForm, setShowRequestForm] = React.useState(false);
  const [patientName, setPatientName] = React.useState('');
  const [patientEmail, setPatientEmail] = React.useState('');
  const [patientPhone, setPatientPhone] = React.useState('');
  const [preferredDays, setPreferredDays] = React.useState([]);
  const [preferredTimeWindows, setPreferredTimeWindows] = React.useState([]);
  const [requestMessage, setRequestMessage] = React.useState('');
  const [consentAccepted, setConsentAccepted] = React.useState(false);
  const [requestLoading, setRequestLoading] = React.useState(false);
  const [showBookingSuccessModal, setShowBookingSuccessModal] = React.useState(false);
  const [bookingSuccessSummary, setBookingSuccessSummary] = React.useState({
    preferredDays: [],
    preferredTimeWindows: [],
    message: '',
  });
  const requestDayOptions = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
  const requestTimeOptions = ['Vormittag', 'Nachmittag', 'Abend'];

  const toggleRequestValue = (setter, current, value) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const formatBookingDate = (value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const resetRequestForm = () => {
    setShowRequestForm(false);
    setPatientName('');
    setPatientEmail('');
    setPatientPhone('');
    setPreferredDays([]);
    setPreferredTimeWindows([]);
    setRequestMessage('');
    setConsentAccepted(false);
  };

  React.useEffect(() => {
    resetRequestForm();
    setShowBookingSuccessModal(false);
    setBookingSuccessSummary({ preferredDays: [], preferredTimeWindows: [], message: '' });
  }, [th.id]);

  const handleSubmitBookingRequest = async () => {
    if (!patientName.trim()) {
      Alert.alert('Hinweis', 'Bitte deinen Namen eingeben');
      return;
    }
    if (!patientEmail.trim() && !patientPhone.trim()) {
      Alert.alert('Hinweis', 'Bitte E-Mail oder Telefonnummer angeben');
      return;
    }
    if (!consentAccepted) {
      Alert.alert('Hinweis', 'Bitte der Verarbeitung deiner Anfrage zustimmen');
      return;
    }
    setRequestLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/booking-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapistId: th.id,
          patientName: patientName.trim(),
          patientEmail: patientEmail.trim() || undefined,
          patientPhone: patientPhone.trim() || undefined,
          preferredDays,
          preferredTimeWindows,
          message: requestMessage.trim() || undefined,
          consentAccepted: true,
        }),
      });
      if (res.ok) {
        const successSummary = {
          preferredDays: [...preferredDays],
          preferredTimeWindows: [...preferredTimeWindows],
          message: requestMessage.trim(),
        };
        await onBookingSuccess?.(th, {
          preferredDays,
          preferredTimeWindows,
          message: requestMessage.trim(),
        });
        resetRequestForm();
        setBookingSuccessSummary(successSummary);
        setShowBookingSuccessModal(true);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Hinweis', softenErrorMessage(err.message ?? 'Hat nicht geklappt – bitte nochmal versuchen'));
      }
    } catch {
      Alert.alert('Hinweis', 'Hat nicht geklappt – bitte nochmal versuchen');
    }
    setRequestLoading(false);
  };

  return (
    <>
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
                <Text style={[styles.tagText, { color: c.success }]}>🏠 {th.serviceRadiusKm ? `Hausbesuch bis ${th.serviceRadiusKm} km` : t('homeVisitTag')}</Text>
              </View>
            )}
            {th.kassenart ? (
              <View style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.muted }]}>{th.kassenart}</Text>
              </View>
            ) : null}
            {th.requestable ? (
              <View style={[styles.tag, { backgroundColor: c.primaryBg, borderWidth: 1, borderColor: c.primary }]}>
                <Text style={[styles.tagText, { color: c.primary }]}>Ersttermin anfragbar</Text>
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
              <Text style={[styles.metaPillText, { color: c.success }]}>{`${formatDist(th.distKm)} entfernt`}</Text>
            </View>
          ) : null}
          {th.practices?.length > 1 ? (
            <View style={[styles.metaPill, { backgroundColor: c.mutedBg }]}>
              <Text style={[styles.metaPillText, { color: c.text }]}>{`${th.practices.length} Praxen`}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {th.homeVisit && (th.serviceRadiusKm || th.availability) && (
        <View style={[styles.infoSection, { backgroundColor: c.successBg, borderColor: c.success, borderWidth: 1 }]}>
          <Text style={[styles.filterSectionTitle, { color: c.success }]}>Hausbesuch</Text>
          {th.serviceRadiusKm ? (
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailIcon}>📍</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.success }]}>Einzugsgebiet</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>Bis {th.serviceRadiusKm} km</Text>
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

      {th.requestable && (
        <View style={[styles.infoSection, { backgroundColor: c.primaryBg, borderColor: c.primary, borderWidth: 1 }]}>
          <Text style={[styles.filterSectionTitle, { color: c.primary }]}>Ersttermin über Revio</Text>
          <Text style={{ ...TYPE.body, color: c.text }}>
            Dieser Therapeut kann direkt für einen ersten Termin angefragt werden.
          </Text>
          {th.nextFreeSlotAt ? (
            <Text style={{ ...TYPE.meta, color: c.primary, marginTop: 8 }}>
              Nächster freier Termin: {formatBookingDate(th.nextFreeSlotAt)}
            </Text>
          ) : null}
          {!showRequestForm ? (
            <Pressable
              style={[styles.ctaBtn, { backgroundColor: c.primary, marginTop: 14 }]}
              onPress={() => setShowRequestForm(true)}
            >
              <Text style={styles.ctaBtnText}>Ersttermin anfragen</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 10, marginTop: 14 }}>
              <TextInput
                style={[styles.registerInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                value={patientName}
                onChangeText={setPatientName}
                placeholder="Dein Name"
                placeholderTextColor={c.muted}
              />
              <TextInput
                style={[styles.registerInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                value={patientEmail}
                onChangeText={setPatientEmail}
                placeholder="E-Mail"
                placeholderTextColor={c.muted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.registerInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                value={patientPhone}
                onChangeText={setPatientPhone}
                placeholder="Telefonnummer"
                placeholderTextColor={c.muted}
                keyboardType="phone-pad"
              />
              <View>
                <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 6, textTransform: 'none' }}>Bevorzugte Tage</Text>
                <View style={styles.tagRow}>
                  {requestDayOptions.map((day) => (
                    <Pressable
                      key={day}
                      onPress={() => toggleRequestValue(setPreferredDays, preferredDays, day)}
                      style={[styles.kassenartBtn, {
                        backgroundColor: preferredDays.includes(day) ? c.primary : c.card,
                        borderColor: preferredDays.includes(day) ? c.primary : c.border,
                      }]}
                    >
                      <Text style={[styles.kassenartText, { color: preferredDays.includes(day) ? '#fff' : c.text }]}>
                        {day}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View>
                <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 6, textTransform: 'none' }}>Bevorzugte Zeitfenster</Text>
                <View style={styles.tagRow}>
                  {requestTimeOptions.map((slot) => (
                    <Pressable
                      key={slot}
                      onPress={() => toggleRequestValue(setPreferredTimeWindows, preferredTimeWindows, slot)}
                      style={[styles.kassenartBtn, {
                        backgroundColor: preferredTimeWindows.includes(slot) ? c.primary : c.card,
                        borderColor: preferredTimeWindows.includes(slot) ? c.primary : c.border,
                      }]}
                    >
                      <Text style={[styles.kassenartText, { color: preferredTimeWindows.includes(slot) ? '#fff' : c.text }]}>
                        {slot}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <TextInput
                style={[styles.inputField, {
                  color: c.text,
                  borderColor: c.border,
                  backgroundColor: c.card,
                  minHeight: 90,
                  textAlignVertical: 'top',
                }]}
                value={requestMessage}
                onChangeText={setRequestMessage}
                placeholder="Kurze Nachricht (optional)"
                placeholderTextColor={c.muted}
                multiline
              />
              <Pressable
                onPress={() => setConsentAccepted((value) => !value)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
              >
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: consentAccepted ? c.primary : c.border,
                  backgroundColor: consentAccepted ? c.primary : c.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {consentAccepted ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </View>
                <Text style={{ ...TYPE.meta, color: c.text, flex: 1 }}>
                  Ich stimme zu, dass meine Angaben für diese Terminanfrage verarbeitet werden.
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  style={[styles.registerBtn, { flex: 1, marginTop: 0, backgroundColor: c.border }]}
                  onPress={resetRequestForm}
                >
                  <Text style={{ ...TYPE.heading, color: c.text }}>Abbrechen</Text>
                </Pressable>
                <Pressable
                  style={[styles.registerBtn, { flex: 1, marginTop: 0, backgroundColor: requestLoading ? c.border : c.primary }]}
                  onPress={handleSubmitBookingRequest}
                  disabled={requestLoading}
                >
                  <Text style={styles.registerBtnText}>{requestLoading ? 'Senden…' : 'Anfrage senden'}</Text>
                </Pressable>
              </View>
            </View>
          )}
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
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{formatDist(th.distKm)} entfernt</Text>
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
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Schnellkontakt</Text>
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
              <Text style={[styles.ctaBtnSecondaryText, { color: c.text }]}>Praxis ansehen</Text>
            </Pressable>
          </View>
        </View>
      ) : th.homeVisit ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Kontakt</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
            Dieser Therapeut kommt zu Ihnen nach Hause{th.city ? ` (${th.city})` : ''}.
          </Text>
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
    <Modal
      visible={showBookingSuccessModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowBookingSuccessModal(false)}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
        onPress={() => setShowBookingSuccessModal(false)}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, padding: 24, gap: 14 }}>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: c.successBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark" size={28} color={c.success} />
              </View>
              <Text style={{ ...TYPE.lg, color: c.text, textAlign: 'center' }}>Terminanfrage gesendet</Text>
              <Text style={{ ...TYPE.body, color: c.muted, textAlign: 'center' }}>
                Der Therapeut wurde in deinen Favoriten gespeichert. Deine Angaben bleiben dort lokal auf deinem Gerät sichtbar.
              </Text>
            </View>

            {(bookingSuccessSummary.preferredDays.length > 0 || bookingSuccessSummary.preferredTimeWindows.length > 0 || bookingSuccessSummary.message) ? (
              <View style={[styles.infoSection, { backgroundColor: c.mutedBg, borderColor: c.border, padding: 14 }]}>
                <Text style={[styles.filterSectionTitle, { color: c.muted, marginBottom: 0 }]}>Deine Anfrage</Text>
                {bookingSuccessSummary.preferredDays.length > 0 ? (
                  <Text style={{ ...TYPE.meta, color: c.text }}>Wunschtage: {bookingSuccessSummary.preferredDays.join(', ')}</Text>
                ) : null}
                {bookingSuccessSummary.preferredTimeWindows.length > 0 ? (
                  <Text style={{ ...TYPE.meta, color: c.text }}>Zeitfenster: {bookingSuccessSummary.preferredTimeWindows.join(', ')}</Text>
                ) : null}
                {bookingSuccessSummary.message ? (
                  <Text style={{ ...TYPE.meta, color: c.muted }} numberOfLines={3}>{bookingSuccessSummary.message}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.noticeBox, { backgroundColor: c.primaryBg, borderColor: c.border }]}>
              <View style={[styles.lockBadge, { backgroundColor: c.card }]}>
                <Ionicons name="time-outline" size={16} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.noticeTitle, { color: c.text }]}>Antwortzeit</Text>
                <Text style={[styles.noticeBody, { color: c.muted }]}>
                  Der Therapeut hat in der Regel bis zu 24 Stunden Zeit, um auf deine Anfrage zu reagieren.
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.registerBtn, { marginTop: 0, backgroundColor: c.primary }]}
              onPress={() => setShowBookingSuccessModal(false)}
            >
              <Text style={styles.registerBtnText}>Verstanden</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}
