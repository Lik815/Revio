import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, ScrollView, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, kassenartOptions, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS } from '../../utils/app-utils';
import { TabHeader } from '../../components/TabHeader';
import { STATUS_COLORS } from './AppointmentCards';
import { useConfigOptions } from '../../hooks/use-config-options';

function formatAppointmentDate(appointment) {
  const slotDate = appointment.slot?.startsAt ?? appointment.confirmedSlotAt ?? null;
  if (!slotDate) return 'Termin noch nicht abgestimmt';
  const d = new Date(slotDate);
  const date = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time} Uhr`;
}

function AppointmentRow({ c, appointment }) {
  const { heilmittelOptions } = useConfigOptions();
  const badge = STATUS_COLORS[appointment.status] ?? STATUS_COLORS.EXPIRED;
  const heilmittelLabel = heilmittelOptions.find((opt) => opt.key === appointment.heilmittel)?.label ?? null;
  const kassenartLabel = kassenartOptions.find((opt) => opt.key === appointment.kassenart)?.label ?? null;
  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: SPACE.md, marginBottom: SPACE.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, flex: 1 }}>{formatAppointmentDate(appointment)}</Text>
        <View style={{ backgroundColor: badge.bg, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: badge.text }}>{badge.label}</Text>
        </View>
      </View>
      {heilmittelLabel || kassenartLabel ? (
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 8 }}>
          {[heilmittelLabel, kassenartLabel].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {appointment.message ? (
        <Text style={{ fontSize: 13, color: c.muted, fontStyle: 'italic', marginTop: 8 }}>„{appointment.message}"</Text>
      ) : null}
      {appointment.status === 'DECLINED' && appointment.declinedReason ? (
        <Text style={{ fontSize: 12, color: c.error, marginTop: 8 }}>Grund: {appointment.declinedReason}</Text>
      ) : null}
    </View>
  );
}

export function TherapistPatientDetailScreen({ authToken, patientId, onBack, c }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authToken || !patientId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${getBaseUrl()}/therapist/patients/${patientId}`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Fehler ${res.status}`))))
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch(() => { if (!cancelled) setError('Patient:in konnte nicht geladen werden.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, patientId]);

  const patient = detail?.patient ?? null;
  const appointments = detail?.appointments ?? [];

  return (
    <View style={{ flex: 1 }}>
      <TabHeader c={c} title={patient?.fullName ?? 'Patient:in'} />
      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, paddingTop: SPACE.sm, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={onBack}
          style={{ alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons name="chevron-back" size={16} color={c.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Zurück</Text>
        </Pressable>

        {loading ? (
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : error || !patient ? (
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: c.error, textAlign: 'center' }}>{error || 'Patient:in nicht gefunden.'}</Text>
          </View>
        ) : (
          <>
            {/* ── Kontaktkarte ──────────────────────────────────────────── */}
            <View style={{ backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, padding: SPACE.lg, gap: 10, marginBottom: SPACE.lg, ...SHADOW.card }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: c.text }}>{patient.fullName}</Text>

              {patient.phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${patient.phone}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="call-outline" size={16} color={c.primary} />
                  <Text style={{ fontSize: 14, color: c.primary, fontWeight: '600' }}>{patient.phone}</Text>
                </Pressable>
              ) : null}

              {patient.email ? (
                <Pressable onPress={() => Linking.openURL(`mailto:${patient.email}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="mail-outline" size={16} color={c.primary} />
                  <Text style={{ fontSize: 14, color: c.primary, fontWeight: '600' }}>{patient.email}</Text>
                </Pressable>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location-outline" size={16} color={c.muted} />
                <Text style={{ fontSize: 14, color: c.muted, fontStyle: 'italic' }}>
                  {patient.addressLine ?? 'Adresse noch nicht verfügbar'}
                </Text>
              </View>
            </View>

            {/* ── Terminverlauf ─────────────────────────────────────────── */}
            <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 8 }}>
              Terminverlauf
            </Text>
            {appointments.length === 0 ? (
              <Text style={{ fontSize: 13, color: c.muted }}>Noch keine Termine mit dieser Person.</Text>
            ) : (
              appointments.map((appointment) => (
                <AppointmentRow key={appointment.id} c={c} appointment={appointment} />
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
