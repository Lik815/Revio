import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RADIUS, SHADOW, SPACE, TYPE, resolveMediaUrl } from '../../utils/app-utils';

const TherapistAvatar = React.memo(function TherapistAvatar({ therapist, size = 40, c }) {
  const [imgError, setImgError] = useState(false);
  const photo = resolveMediaUrl(therapist?.photo);
  const initials = (therapist?.fullName ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (photo && !imgError) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primaryBg }}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: c.primary }}>{initials}</Text>
    </View>
  );
});

function formatSlot(startsAt, durationMin) {
  if (!startsAt) return '—';
  const d = new Date(startsAt);
  const date = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time} Uhr (${durationMin ?? 20} Min)`;
}

// ─── Status helpers ────────────────────────────────────────────────────────────

export const STATUS_COLORS = {
  PENDING:   { bg: '#FFF9E6', text: '#B78700', label: 'Ausstehend' },
  CONFIRMED: { bg: '#E6F9EE', text: '#1A7A40', label: 'Bestätigt' },
  DECLINED:  { bg: '#FEF2F2', text: '#B91C1C', label: 'Abgelehnt' },
  CANCELLED: { bg: '#F3F4F6', text: '#6B7280', label: 'Storniert' },
  EXPIRED:   { bg: '#F3F4F6', text: '#6B7280', label: 'Abgelaufen' },
};

// ─── PatientNextAppointmentCard ────────────────────────────────────────────────

function PatientStatsRow({ c, kommend, vergangen, activeView, onSelectKommend, onSelectVergangen }) {
  const kommendActive = activeView === 'kommend';
  const vergangenActive = activeView === 'vergangen';
  return (
    <View style={{ flexDirection: 'row' }}>
      <Pressable
        onPress={onSelectKommend}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 14, paddingVertical: 4, borderRightWidth: 1, borderRightColor: c.border, opacity: kommendActive ? 1 : 0.55 }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.successBg ?? '#EAF4F1', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: c.success ?? '#5A9E8E' }}>{kommend}</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: kommendActive ? '800' : '600', color: c.text }}>Kommend</Text>
      </Pressable>
      <Pressable
        onPress={onSelectVergangen}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingVertical: 4, opacity: vergangenActive ? 1 : 0.55 }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.mutedBg ?? '#EDF2F4', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: c.muted }}>{vergangen}</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: vergangenActive ? '800' : '600', color: c.text }}>Vergangen</Text>
      </Pressable>
    </View>
  );
}

export function PatientNextAppointmentCard({
  c,
  appointment,
  kommendCount,
  vergangenCount,
  onOpenDetail,
  onViewTherapist,
  activeView,
  onSelectKommend,
  onSelectVergangen,
}) {
  const slotDate = appointment ? (appointment.startsAt ?? appointment.slot?.startsAt ?? appointment.confirmedSlotAt ?? null) : null;

  if (!appointment || !slotDate) {
    return (
      <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md, ...SHADOW.card }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Nächster Termin</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, marginTop: 6 }}>Kein bevorstehender Termin</Text>
        <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />
        <PatientStatsRow
          c={c}
          kommend={kommendCount}
          vergangen={vergangenCount}
          activeView={activeView}
          onSelectKommend={onSelectKommend}
          onSelectVergangen={onSelectVergangen}
        />
      </View>
    );
  }

  const { therapist } = appointment;
  const d = new Date(slotDate);
  const dateStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const msUntil = d - new Date();
  const hoursUntil = Math.floor(msUntil / 3600000);
  const minsUntil = Math.floor((msUntil % 3600000) / 60000);
  let countdown = null;
  if (msUntil > 0) {
    if (hoursUntil >= 24) {
      const daysUntil = Math.floor(hoursUntil / 24);
      const remainingHours = hoursUntil % 24;
      countdown = remainingHours > 0
        ? `in ${daysUntil} Tag${daysUntil === 1 ? '' : 'en'}, ${remainingHours} Std.`
        : `in ${daysUntil} Tag${daysUntil === 1 ? '' : 'en'}`;
    } else {
      countdown = `in ${hoursUntil} Std. ${minsUntil} Min.`;
    }
  }

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, marginBottom: SPACE.md, ...SHADOW.card }}>
      <Pressable onPress={onOpenDetail} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable onPress={onViewTherapist} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <TherapistAvatar therapist={therapist} size={56} c={c} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Nächster Termin</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: c.text, marginTop: 2 }}>{dateStr} · {timeStr}</Text>
          {therapist?.fullName ? (
            <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>bei {therapist.fullName}</Text>
          ) : null}
          {countdown && <Text style={{ fontSize: 13, fontWeight: '600', color: c.success ?? '#5A9E8E', marginTop: 2 }}>{countdown}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.muted} />
      </Pressable>

      <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />

      <PatientStatsRow
        c={c}
        kommend={kommendCount}
        vergangen={vergangenCount}
        activeView={activeView}
        onSelectKommend={onSelectKommend}
        onSelectVergangen={onSelectVergangen}
      />
    </View>
  );
}

// ─── PatientAppointmentCard (Timeline-Zeile) ───────────────────────────────────

// Colon-gendered "Therapeut:innen-Login" form lives in STATUS_COLORS too, but
// "Storniert" there is shared with the therapist-facing booking cards — only
// override the label for this patient-facing card, not the shared constant.
const PATIENT_STATUS_LABEL_OVERRIDES = { CANCELLED: 'Abgesagt' };

export const PatientAppointmentCard = React.memo(function PatientAppointmentCard({
  c, appointment, onOpenDetail, isPast = false, isFirst = false, isLast = false,
}) {
  const { status, therapist, slot, startsAt, endsAt, confirmedSlotAt } = appointment;
  const badge = STATUS_COLORS[status] ?? STATUS_COLORS.EXPIRED;
  const badgeLabel = PATIENT_STATUS_LABEL_OVERRIDES[status] ?? badge.label;
  const slotDate = startsAt ?? slot?.startsAt ?? confirmedSlotAt ?? null;
  const durationMin = endsAt && startsAt
    ? Math.round((new Date(endsAt) - new Date(startsAt)) / 60_000)
    : (slot?.durationMin ?? 20);
  const isActive = (status === 'CONFIRMED' || status === 'PENDING') && !isPast;
  const dotColor = isActive ? (c.success ?? '#5A9E8E') : c.muted;
  const d = slotDate ? new Date(slotDate) : null;
  const dateStr = d ? d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' }) : '—';
  const timeStr = d ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <View style={{ flexDirection: 'row', marginBottom: 10, opacity: isPast ? 0.7 : 1 }}>
      {/* Timeline-Spur */}
      <View style={{ width: 18, alignItems: 'center' }}>
        <View style={{ width: 2, flex: 1, backgroundColor: isFirst ? 'transparent' : c.border }} />
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor, borderWidth: 2, borderColor: c.background }} />
        <View style={{ width: 2, flex: 1, backgroundColor: isLast ? 'transparent' : c.border }} />
      </View>

      <Pressable
        onPress={onOpenDetail}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 8, backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: SPACE.md, paddingVertical: 12 }}
      >
        {/* Datum + Zeit + Dauer */}
        <View style={{ minWidth: 64 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? c.text : c.muted }} numberOfLines={1}>{dateStr}</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: isActive ? c.text : c.muted, marginTop: 1 }}>{timeStr}</Text>
          <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{durationMin} Min</Text>
        </View>

        {/* Therapeut */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }} numberOfLines={1}>{therapist?.fullName ?? '—'}</Text>
          {therapist?.professionalTitle ? (
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }} numberOfLines={1}>{therapist.professionalTitle}</Text>
          ) : null}
        </View>

        {/* Status + Chevron */}
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={{ backgroundColor: badge.bg, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: badge.text }}>{badgeLabel}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={c.muted} />
        </View>
      </Pressable>
    </View>
  );
});

// ─── TherapistBookingCard ──────────────────────────────────────────────────────

export function TherapistBookingCard({ c, t, request, onRespond, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declinedReason, setDeclinedReason] = useState('');
  const [error, setError] = useState('');

  const isPending = request.status === 'PENDING';
  const slot = request.slot ?? null;
  const slotDate = request.startsAt ?? slot?.startsAt ?? request.confirmedSlotAt ?? null;

  async function handleRespond(action) {
    setError('');
    setLoading(true);
    try {
      const body = action === 'CONFIRM'
        ? { action: 'CONFIRM' }
        : { action: 'DECLINE', declinedReason: declinedReason.trim() || undefined };
      await onRespond(request.id, body);
    } catch (e) {
      setError(e?.message && e.message !== 'failed' ? e.message : 'Fehler beim Speichern.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.sm, ...SHADOW.card }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACE.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...TYPE.label, color: c.text, fontSize: 15 }}>{request.patientName}</Text>
          {request.patientEmail && (
            <Text style={{ ...TYPE.caption, color: c.muted, marginTop: 2 }}>{request.patientEmail}</Text>
          )}
          {request.patientPhone && (
            <Text style={{ ...TYPE.caption, color: c.muted, marginTop: 1 }}>{request.patientPhone}</Text>
          )}
        </View>
        {isPending && (
          <View style={{ backgroundColor: '#FFF9E6', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#B78700' }}>ANFRAGE</Text>
          </View>
        )}
        {!isPending && (
          <View style={{ backgroundColor: STATUS_COLORS[request.status]?.bg ?? '#F3F4F6', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: STATUS_COLORS[request.status]?.text ?? '#6B7280' }}>
              {STATUS_COLORS[request.status]?.label ?? request.status}
            </Text>
          </View>
        )}
      </View>

      {/* Slot */}
      {slotDate && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACE.xs }}>
          <Ionicons name="calendar-outline" size={14} color={c.primary} />
          <Text style={{ ...TYPE.small, color: c.primary, fontWeight: '600' }}>
            {formatSlot(slotDate, slot?.durationMin ?? 20)}
          </Text>
        </View>
      )}

      {/* Message */}
      {!!request.message && (
        <Text style={{ ...TYPE.small, color: c.text, fontStyle: 'italic', marginBottom: SPACE.xs }}>
          „{request.message}"
        </Text>
      )}

      {/* Decline reason input */}
      {isPending && showDecline && (
        <TextInput
          value={declinedReason}
          onChangeText={setDeclinedReason}
          placeholder="Grund (optional)"
          placeholderTextColor={c.muted}
          style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.sm, backgroundColor: c.mutedBg, color: c.text, fontSize: 14, padding: 10, marginTop: SPACE.sm }}
        />
      )}

      {/* Error */}
      {!!error && <Text style={{ ...TYPE.small, color: c.error, marginTop: 6 }}>{error}</Text>}

      {/* Therapeut storniert bestätigten Termin */}
      {request.status === 'CONFIRMED' && onCancel && (
        <Pressable
          onPress={() => Alert.alert(
            'Termin absagen',
            'Möchtest du diesen bestätigten Termin wirklich absagen? Der Patient wird benachrichtigt.',
            [
              { text: 'Nein', style: 'cancel' },
              { text: 'Absagen', style: 'destructive', onPress: onCancel },
            ],
          )}
          style={{ marginTop: SPACE.sm, paddingVertical: 8, alignItems: 'center' }}
        >
          <Text style={{ ...TYPE.label, color: c.error, fontSize: 13 }}>Termin absagen</Text>
        </Pressable>
      )}

      {/* Actions */}
      {isPending && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: SPACE.sm }}>
          {!showDecline ? (
            <Pressable
              onPress={() => setShowDecline(true)}
              style={{ flex: 1, borderWidth: 1, borderColor: c.error, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ ...TYPE.label, color: c.error, fontSize: 14 }}>Ablehnen</Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={loading}
              onPress={() => handleRespond('DECLINE')}
              style={{ flex: 1, borderWidth: 1, borderColor: c.error, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
            >
              {loading
                ? <ActivityIndicator size="small" color={c.error} />
                : <Text style={{ ...TYPE.label, color: c.error, fontSize: 14 }}>Ablehnung senden</Text>
              }
            </Pressable>
          )}

          {!showDecline && (
            <Pressable
              disabled={loading}
              onPress={() => handleRespond('CONFIRM')}
              style={{ flex: 1, backgroundColor: c.primary, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' }}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ ...TYPE.label, color: '#fff', fontSize: 14 }}>Bestätigen</Text>
              }
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
