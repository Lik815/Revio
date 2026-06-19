import React, { useEffect, useState } from 'react';
import {
  Image, Linking, Pressable, ScrollView, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, resolveMediaUrl, SHADOW, SPACE, TUNNEL_HEADERS } from '../../utils/app-utils';
import { STATUS_COLORS } from './AppointmentCards';
import { TabHeader } from '../../components/TabHeader';
import { ReviewComposerModal } from '../../components/ReviewComposerModal';

export function AppointmentDetail({
  appointment,
  onBack,
  onOpenTherapist,
  onCancelRequest,
  authToken,
  c, t, styles,
}) {
  const appointment_data = appointment;
  const slotDate = appointment?.slot?.startsAt ?? appointment?.confirmedSlotAt ?? null;
  const durationMin = appointment?.slot?.durationMin ?? 20;
  const badge = STATUS_COLORS[appointment?.status] ?? STATUS_COLORS.EXPIRED;
  const therapist = appointment?.therapist ?? null;
  const therapistName = therapist?.fullName ?? 'Therapeut:in';
  const therapistTitle = therapist?.professionalTitle ?? 'Physiotherapeut:in';
  const therapistPhoto = resolveMediaUrl(therapist?.photo);
  const hasMessage = typeof appointment?.message === 'string' && appointment.message.trim().length > 0;
  const isActive = appointment?.status === 'PENDING' || appointment?.status === 'CONFIRMED';

  const date = slotDate ? new Date(slotDate) : null;
  const bigDateLabel = date
    ? date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Termin';
  const weekdayDateLabel = date
    ? date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Terminzeit wird noch abgestimmt';
  const timeLabel = date
    ? `${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr (${durationMin} Min)`
    : `${durationMin} Min`;

  const statusIcon = appointment?.status === 'CONFIRMED'
    ? 'checkmark-circle-outline'
    : appointment?.status === 'PENDING'
      ? 'time-outline'
      : 'close-circle-outline';

  const isPastConfirmed = appointment?.status === 'CONFIRMED' && date && date.getTime() < Date.now();
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    if (!isPastConfirmed || !authToken || !appointment?.id) return;
    let cancelled = false;
    fetch(`${getBaseUrl()}/bookings/${appointment.id}/review-eligibility`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setReviewEligibility(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isPastConfirmed, authToken, appointment?.id]);

  return (
    <View style={{ flex: 1 }}>
      <TabHeader c={c} title="Termin" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 12, paddingTop: SPACE.sm }]}
        showsVerticalScrollIndicator={false}
      >
    <View style={{ gap: 10 }}>
      <Pressable
        onPress={() => onBack()}
        style={{ alignSelf: 'flex-start', paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Ionicons name="chevron-back" size={16} color={c.primary} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Zurück</Text>
      </Pressable>

      {/* Main Card */}
      <View style={{ backgroundColor: c.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: c.border, gap: 14, ...SHADOW.card }}>

        {/* Status Pill */}
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: badge.bg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, gap: 6 }}>
          <Ionicons name={statusIcon} size={14} color={badge.text} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: badge.text }}>{badge.label}</Text>
        </View>

        {/* Datum + Illustration */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: c.text, lineHeight: 30 }}>{bigDateLabel}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar-outline" size={14} color={c.muted} />
              <Text style={{ fontSize: 13, color: c.muted, fontWeight: '500' }}>{weekdayDateLabel}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="time-outline" size={14} color={c.muted} />
              <Text style={{ fontSize: 13, color: c.muted, fontWeight: '500' }}>{timeLabel}</Text>
            </View>
          </View>
          {/* Illustration */}
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
            <Ionicons name="calendar-outline" size={24} color={c.primary} />
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: c.border }} />

        {/* Therapeut Block */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Therapeut:in</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {therapistPhoto ? (
              <Image source={{ uri: therapistPhoto }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.primaryBg }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-outline" size={22} color={c.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{therapistName}</Text>
              <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{therapistTitle}</Text>
              {therapist?.phone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${therapist.phone}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}
                >
                  <Ionicons name="call" size={13} color={c.primary} />
                  <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>{therapist.phone}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* Nachricht */}
        {hasMessage ? (
          <>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: c.muted, textTransform: 'uppercase' }}>Deine Nachricht</Text>
              <Text style={{ fontSize: 14, lineHeight: 21, color: c.muted, fontStyle: 'italic' }}>"{appointment.message.trim()}"</Text>
            </View>
          </>
        ) : null}

        {/* Ablehnungsgrund */}
        {appointment?.status === 'DECLINED' && appointment?.declinedReason ? (
          <>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <View style={{ gap: 6, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: '#DC2626', textTransform: 'uppercase' }}>Grund der Absage</Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#7F1D1D' }}>{appointment.declinedReason}</Text>
            </View>
          </>
        ) : null}

        {/* Hinweisbox */}
        {isActive ? (
          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: c.primaryBg, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: c.primary + '30' }}>
            <Ionicons name="information-circle-outline" size={18} color={c.primary} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary }}>Wichtiger Hinweis</Text>
              <Text style={{ fontSize: 13, color: c.text, lineHeight: 17 }}>Bitte erscheine 5–10 Minuten vor deinem Termin. Falls du verhindert bist, storniere bitte rechtzeitig.</Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 1, backgroundColor: c.border }} />

        {/* CTAs */}
        <View style={{ gap: 8 }}>
          {therapist ? (
            <Pressable
              onPress={() => {
                onBack();
                if (therapist?.id) onOpenTherapist(therapist.id, therapist);
                else setSelectedTherapist(therapist);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, borderRadius: 999, paddingVertical: 12, gap: 8 }}
            >
              <Ionicons name="person-outline" size={18} color="#fff" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Profil ansehen</Text>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </Pressable>
          ) : null}

          {isActive ? (
            <Pressable
              onPress={() => onCancelRequest()}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingVertical: 11, gap: 8, borderWidth: 1.5, borderColor: c.error, backgroundColor: 'transparent' }}
            >
              <Ionicons name="trash-outline" size={17} color={c.error} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.error }}>Termin stornieren</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Bewertung */}
        {isPastConfirmed && reviewEligibility?.eligible ? (
          <Pressable
            onPress={() => setShowReviewModal(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.success ?? '#5A9E8E', borderRadius: 999, paddingVertical: 14, gap: 8 }}
          >
            <Ionicons name="star-outline" size={17} color="#fff" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{t('writeReviewCta')}</Text>
          </Pressable>
        ) : null}

        {isPastConfirmed && reviewEligibility?.alreadyReviewed ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
      </View>
    </View>
      </ScrollView>

      <ReviewComposerModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        c={c}
        t={t}
        authToken={authToken}
        bookingId={appointment?.id}
        onSubmitted={(review) => {
          setReviewEligibility({ eligible: false, alreadyReviewed: true, review });
          setShowReviewModal(false);
        }}
      />
    </View>
  );
}