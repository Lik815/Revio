import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, ScrollView, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { kassenartOptions, SHADOW, SPACE } from '../../utils/app-utils';
import { STATUS_COLORS } from './AppointmentCards';
import { TabHeader } from '../../components/TabHeader';
import { useConfigOptions } from '../../hooks/use-config-options';
import { DeclineBookingModal } from '../../modals/DeclineBookingModal';
import { markMounted } from '../../utils/perf-log';

function formatDateParts(appointment) {
  const slotDate = appointment?.slot?.startsAt ?? appointment?.confirmedSlotAt ?? null;
  const durationMin = appointment?.slot?.durationMin ?? 20;
  const date = slotDate ? new Date(slotDate) : null;

  return {
    bigDateLabel: date
      ? date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Termin',
    weekdayDateLabel: date
      ? date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Terminzeit wird noch abgestimmt',
    timeLabel: date
      ? `${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr (${durationMin} Min)`
      : `${durationMin} Min`,
  };
}

export function TherapistAppointmentDetail({
  appointment,
  patient,
  onBack,
  onRespond,
  onCancelRequest,
  c,
  styles,
}) {
  const badge = STATUS_COLORS[appointment?.status] ?? STATUS_COLORS.EXPIRED;
  const { heilmittelOptions } = useConfigOptions();
  const [loading, setLoading] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [error, setError] = useState('');
  const heilmittelLabel = heilmittelOptions.find((opt) => opt.key === appointment?.heilmittel)?.label ?? null;
  const kassenartLabel = appointment?.kassenart
    ? kassenartOptions.find((opt) => opt.key === appointment.kassenart)?.label ?? null
    : null;
  const hasMessage = typeof appointment?.message === 'string' && appointment.message.trim().length > 0;
  const isPending = appointment?.status === 'PENDING';
  const isConfirmed = appointment?.status === 'CONFIRMED';

  // First content is the appointment/patient passed in via props — no fetch gates the initial paint.
  useEffect(() => {
    markMounted(appointment?.id, 'TherapistAppointmentDetail (no blocking fetch)');
  }, []);

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

  const { bigDateLabel, weekdayDateLabel, timeLabel } = formatDateParts(appointment);

  const statusIcon = appointment?.status === 'CONFIRMED'
    ? 'checkmark-circle-outline'
    : appointment?.status === 'PENDING'
      ? 'time-outline'
      : appointment?.status === 'CANCELLED'
        ? 'ban-outline'
        : 'close-circle-outline';

  return (
    <View style={{ flex: 1 }}>
      <TabHeader c={c} title="Termin" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 12, paddingTop: SPACE.sm }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={onBack}
            style={{ alignSelf: 'flex-start', paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Ionicons name="chevron-back" size={16} color={c.primary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Zurück</Text>
          </Pressable>

          <View style={{ backgroundColor: c.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: c.border, gap: 14, ...SHADOW.card }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: badge.bg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, gap: 6 }}>
              <Ionicons name={statusIcon} size={14} color={badge.text} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: badge.text }}>{badge.label}</Text>
            </View>

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
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
                <Ionicons name="calendar-outline" size={24} color={c.primary} />
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: c.border }} />

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Patient</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{patient?.fullName ?? 'Patient'}</Text>

              {patient?.phone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${patient.phone}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Ionicons name="call" size={13} color={c.primary} />
                  <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>{patient.phone}</Text>
                </Pressable>
              ) : null}

              {patient?.email ? (
                <Pressable
                  onPress={() => Linking.openURL(`mailto:${patient.email}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Ionicons name="mail-outline" size={13} color={c.primary} />
                  <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>{patient.email}</Text>
                </Pressable>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5 }}>
                <Ionicons name="location-outline" size={13} color={c.muted} style={{ marginTop: 2 }} />
                <Text style={{ fontSize: 13, color: c.muted }}>
                  {patient?.addressLine ?? 'Adresse noch nicht verfügbar'}
                </Text>
              </View>
            </View>

            {hasMessage ? (
              <>
                <View style={{ height: 1, backgroundColor: c.border }} />
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: c.muted, textTransform: 'uppercase' }}>Nachricht</Text>
                  <Text style={{ fontSize: 14, lineHeight: 21, color: c.muted, fontStyle: 'italic' }}>"{appointment.message.trim()}"</Text>
                </View>
              </>
            ) : null}

            {heilmittelLabel || kassenartLabel ? (
              <>
                <View style={{ height: 1, backgroundColor: c.border }} />
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: c.muted, textTransform: 'uppercase' }}>Heilmittel & Versicherung</Text>
                  <Text style={{ fontSize: 14, lineHeight: 21, color: c.text }}>
                    {[heilmittelLabel, kassenartLabel].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </>
            ) : null}

            {appointment?.status === 'DECLINED' && appointment?.declinedReason ? (
              <>
                <View style={{ height: 1, backgroundColor: c.border }} />
                <View style={{ gap: 6, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: '#DC2626', textTransform: 'uppercase' }}>Grund der Absage</Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: '#7F1D1D' }}>{appointment.declinedReason}</Text>
                </View>
              </>
            ) : null}

            {isPending ? (
              <>
                <View style={{ height: 1, backgroundColor: c.border }} />
                {!!error && !showDeclineModal ? (
                  <Text style={{ fontSize: 13, color: c.error ?? '#DC2626' }}>{error}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => setShowDeclineModal(true)}
                    disabled={loading}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.65 : 1 }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: c.muted }}>Ablehnen</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRespond('CONFIRM')}
                    disabled={loading}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.75 : 1 }}
                  >
                    {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Bestätigen</Text>}
                  </Pressable>
                </View>
              </>
            ) : null}

            {isConfirmed && onCancelRequest ? (
              <>
                <View style={{ height: 1, backgroundColor: c.border }} />
                <Pressable
                  onPress={onCancelRequest}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 12, gap: 8, borderWidth: 1.5, borderColor: c.error, backgroundColor: 'transparent' }}
                >
                  <Ionicons name="trash-outline" size={17} color={c.error} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.error }}>Termin absagen</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <DeclineBookingModal
        visible={showDeclineModal}
        onClose={() => { setShowDeclineModal(false); setError(''); }}
        onConfirm={(reason) => handleRespond('DECLINE', reason)}
        booking={{ ...appointment, patientName: patient?.fullName, patientPhone: patient?.phone }}
        loading={loading}
        error={error}
        c={c}
      />
    </View>
  );
}
