import React, { useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, ScrollView, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { kassenartOptions, RADIUS, SHADOW } from '../../utils/app-utils';
import { STATUS_COLORS } from './AppointmentCards';
import { useConfigOptions } from '../../hooks/use-config-options';
import { DeclineBookingModal } from '../../modals/DeclineBookingModal';
import { markMounted } from '../../utils/perf-log';
import { useEffect } from 'react';

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function SectionCard({ icon, label, children, c }) {
  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, marginBottom: 12, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border }}>
        <Ionicons name={icon} size={15} color={c.muted} />
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({ icon, label, value, onPress, muted, info, c, noBorder }) {
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: noBorder ? 0 : 1, borderColor: c.border }}>
      <Ionicons name={icon} size={18} color={muted ? c.muted : c.text} />
      <View style={{ flex: 1 }}>
        {label ? <Text style={{ fontSize: 11, color: c.muted, marginBottom: 2 }}>{label}</Text> : null}
        <Text style={{ fontSize: 15, fontWeight: '600', color: muted ? c.muted : c.text }}>{value}</Text>
      </View>
      {info
        ? <Ionicons name="information-circle-outline" size={18} color={c.muted} />
        : onPress
          ? <Ionicons name="chevron-forward" size={16} color={c.muted} />
          : null}
    </View>
  );
  if (onPress && !muted) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

function ActionTile({ icon, label, color, onPress, c }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, gap: 8 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${color}18`, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: '600', color, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function TherapistAppointmentDetail({
  appointment,
  patient,
  onBack,
  onRespond,
  onCancelRequest,
  onOpenPatient,
  isModal = false,
  c,
  styles,
}) {
  const insets = useSafeAreaInsets();
  const { heilmittelOptions } = useConfigOptions();
  const [loading, setLoading] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    markMounted(appointment?.id, 'TherapistAppointmentDetail (no blocking fetch)');
  }, []);

  const heilmittelLabel = heilmittelOptions.find((opt) => opt.key === appointment?.heilmittel)?.label ?? appointment?.heilmittel ?? null;
  const kassenartLabel = appointment?.kassenart
    ? kassenartOptions.find((opt) => opt.key === appointment.kassenart)?.label ?? null
    : null;

  const isPending = appointment?.status === 'PENDING';
  const isConfirmed = appointment?.status === 'CONFIRMED';
  const statusConfig = STATUS_COLORS[appointment?.status] ?? STATUS_COLORS.EXPIRED;

  const statusIcon = appointment?.status === 'CONFIRMED'
    ? 'checkmark-circle-outline'
    : appointment?.status === 'PENDING'
      ? 'time-outline'
      : appointment?.status === 'CANCELLED'
        ? 'ban-outline'
        : 'close-circle-outline';

  // Zeit & Datum
  const startsAt = appointment?.startsAt ? new Date(appointment.startsAt) : null;
  const endsAt = appointment?.endsAt ? new Date(appointment.endsAt) : null;
  const startTime = startsAt ? startsAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  const endTime = endsAt ? endsAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  const durationMin = endsAt && startsAt
    ? Math.round((endsAt - startsAt) / 60_000)
    : appointment?.slot?.durationMin ?? 20;
  const dateLabel = startsAt
    ? startsAt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const patientName = patient?.fullName ?? appointment?.patientName ?? 'Patient';
  const patientInitials = getInitials(patientName);

  const handleRespond = async (action, declinedReason) => {
    if (!onRespond || !appointment?.id) return;
    setError('');
    setLoading(true);
    try {
      const body = action === 'CONFIRM'
        ? { action: 'CONFIRM' }
        : { action: 'DECLINE', declinedReason: declinedReason?.trim() || undefined };
      await onRespond(appointment.id, body);
      setShowDeclineModal(false);
      onBack?.();
    } catch (e) {
      setError(e?.message ?? 'Fehler beim Speichern.');
    } finally {
      setLoading(false);
    }
  };

  const scrollContent = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
    >
      {/* Hero-Karte */}
      <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: 18, marginBottom: 12, ...SHADOW.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: statusConfig.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, gap: 6, marginBottom: 14 }}>
          <Ionicons name={statusIcon} size={14} color={statusConfig.text} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: statusConfig.text }}>{statusConfig.label}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: c.text, lineHeight: 32 }}>{patientName}</Text>
            {startTime ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={14} color={c.muted} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>
                  {startTime}{endTime ? ` – ${endTime}` : ''}
                </Text>
                <View style={{ backgroundColor: c.mutedBg ?? '#F3F4F6', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>{durationMin} Min</Text>
                </View>
              </View>
            ) : null}
            {dateLabel ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={14} color={c.muted} />
                <Text style={{ fontSize: 13, color: c.muted }}>{dateLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.primaryBg ?? `${c.primary}20`, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: c.primary }}>{patientInitials}</Text>
            </View>
            {onOpenPatient && appointment?.patientUserId ? (
              <Pressable
                onPress={() => onOpenPatient(appointment.patientUserId)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 99, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: c.text }}>Patient oeffnen</Text>
                <Ionicons name="chevron-forward" size={12} color={c.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* Aktions-Zeile */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <ActionTile
          icon="call-outline"
          label="Anrufen"
          color={c.success ?? '#5A9E8E'}
          onPress={() => patient?.phone ? Linking.openURL(`tel:${patient.phone}`) : null}
          c={c}
        />
        <ActionTile
          icon="mail-outline"
          label="E-Mail schreiben"
          color={c.primary}
          onPress={() => patient?.email ? Linking.openURL(`mailto:${patient.email}`) : null}
          c={c}
        />
        <ActionTile
          icon="document-text-outline"
          label="Dokumentation"
          color="#7C3AED"
          onPress={() => {}}
          c={c}
        />
      </View>

      {/* Patient-Sektion */}
      <SectionCard icon="person-outline" label="Patient" c={c}>
        <InfoRow
          icon="call-outline"
          value={patient?.phone ?? 'Keine Telefonnummer'}
          onPress={patient?.phone ? () => Linking.openURL(`tel:${patient.phone}`) : null}
          muted={!patient?.phone}
          noBorder={false}
          c={c}
        />
        <InfoRow
          icon="mail-outline"
          value={patient?.email ?? appointment?.patientEmail ?? 'Keine E-Mail'}
          onPress={(patient?.email || appointment?.patientEmail)
            ? () => Linking.openURL(`mailto:${patient?.email ?? appointment?.patientEmail}`)
            : null}
          muted={!patient?.email && !appointment?.patientEmail}
          noBorder={false}
          c={c}
        />
        <InfoRow
          icon="location-outline"
          value={patient?.addressLine ?? 'Adresse noch nicht verfuegbar'}
          muted={!patient?.addressLine}
          info={!patient?.addressLine}
          noBorder
          c={c}
        />
      </SectionCard>

      {/* Behandlung & Abrechnung */}
      {(heilmittelLabel || kassenartLabel) ? (
        <SectionCard icon="bag-outline" label="Behandlung & Abrechnung" c={c}>
          {heilmittelLabel ? (
            <InfoRow
              icon="document-outline"
              label="Heilmittel"
              value={heilmittelLabel}
              noBorder={!kassenartLabel}
              c={c}
            />
          ) : null}
          {kassenartLabel ? (
            <InfoRow
              icon="shield-checkmark-outline"
              label="Versicherung"
              value={kassenartLabel}
              noBorder
              c={c}
            />
          ) : null}
        </SectionCard>
      ) : null}

      {/* Nachricht des Patienten */}
      {typeof appointment?.message === 'string' && appointment.message.trim().length > 0 ? (
        <SectionCard icon="chatbubble-outline" label="Nachricht" c={c}>
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 14, lineHeight: 21, color: c.muted, fontStyle: 'italic' }}>
              "{appointment.message.trim()}"
            </Text>
          </View>
        </SectionCard>
      ) : null}

      {/* Notiz */}
      <SectionCard icon="create-outline" label="Notiz" c={c}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
          <Text style={{ fontSize: 14, color: c.muted }}>Keine Notiz vorhanden</Text>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="add" size={16} color={c.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Notiz hinzufuegen</Text>
          </Pressable>
        </View>
      </SectionCard>

      {/* Absage-Grund */}
      {appointment?.status === 'DECLINED' && appointment?.declinedReason ? (
        <View style={{ backgroundColor: '#FEF2F2', borderRadius: RADIUS.lg, padding: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Grund der Absage</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: '#7F1D1D' }}>{appointment.declinedReason}</Text>
        </View>
      ) : null}
      {appointment?.status === 'CANCELLED' && appointment?.cancelReason ? (
        <View style={{ backgroundColor: '#FEF2F2', borderRadius: RADIUS.lg, padding: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Grund der Stornierung</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: '#7F1D1D' }}>{appointment.cancelReason}</Text>
        </View>
      ) : null}

      {/* Aktions-Buttons: PENDING */}
      {isPending ? (
        <View style={{ gap: 10 }}>
          {!!error && !showDeclineModal ? (
            <Text style={{ fontSize: 13, color: c.error ?? '#DC2626' }}>{error}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => setShowDeclineModal(true)}
              disabled={loading}
              style={{ flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, alignItems: 'center', opacity: loading ? 0.65 : 1 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.muted }}>Ablehnen</Text>
            </Pressable>
            <Pressable
              onPress={() => handleRespond('CONFIRM')}
              disabled={loading}
              style={{ flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: c.primary, alignItems: 'center', opacity: loading ? 0.75 : 1 }}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Bestaetigen</Text>}
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Termin absagen (nur CONFIRMED) */}
      {isConfirmed && onCancelRequest ? (
        <View style={{ gap: 8 }}>
          <Pressable
            onPress={onCancelRequest}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, paddingVertical: 14, gap: 8, borderWidth: 1.5, borderColor: c.error ?? '#DC2626' }}
          >
            <Ionicons name="trash-outline" size={17} color={c.error ?? '#DC2626'} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.error ?? '#DC2626' }}>Termin absagen</Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center' }}>Diese Aktion kann nicht rueckgaengig gemacht werden.</Text>
        </View>
      ) : null}
    </ScrollView>
  );

  const declineModal = (
    <DeclineBookingModal
      visible={showDeclineModal}
      onClose={() => { setShowDeclineModal(false); setError(''); }}
      onConfirm={(reason) => handleRespond('DECLINE', reason)}
      booking={{ ...appointment, patientName, patientPhone: patient?.phone }}
      loading={loading}
      error={error}
      c={c}
    />
  );

  if (isModal) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.border }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: c.text }}>Termindetail</Text>
          <Pressable onPress={onBack} hitSlop={12} style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color={c.muted} />
          </Pressable>
        </View>
        <View style={{ height: 1, backgroundColor: c.border }} />
        {scrollContent}
        {declineModal}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12, backgroundColor: c.background, borderBottomWidth: 1, borderColor: c.border }}>
        <Pressable onPress={onBack} hitSlop={12} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="chevron-back" size={22} color={c.primary} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '800', color: c.text }}>Termindetail</Text>
      </View>
      {scrollContent}
      {declineModal}
    </View>
  );
}
