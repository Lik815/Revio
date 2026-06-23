import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Pressable, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { kassenartOptions, RADIUS, SHADOW, SPACE } from '../../utils/app-utils';
import { TabHeader } from '../../components/TabHeader';
import { STATUS_COLORS } from './AppointmentCards';
import { useConfigOptions } from '../../hooks/use-config-options';
import { useTherapyData } from '../../context/TherapyContext';
import { markMounted } from '../../utils/perf-log';

function formatAppointmentDate(appointment) {
  const slotDate = appointment.slot?.startsAt ?? appointment.confirmedSlotAt ?? null;
  if (!slotDate) return 'Termin noch nicht abgestimmt';
  const d = new Date(slotDate);
  const date = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time} Uhr`;
}

const AppointmentRow = React.memo(function AppointmentRow({ c, appointment, onSelect }) {
  const { heilmittelOptions } = useConfigOptions();
  const badge = STATUS_COLORS[appointment.status] ?? STATUS_COLORS.EXPIRED;
  const heilmittelLabel = heilmittelOptions.find((opt) => opt.key === appointment.heilmittel)?.label ?? null;
  const kassenartLabel = appointment.kassenart
    ? kassenartOptions.find((opt) => opt.key === appointment.kassenart)?.label ?? null
    : null;
  return (
    <Pressable
      onPress={() => onSelect(appointment)}
      style={{ backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: SPACE.md, marginBottom: SPACE.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, flex: 1 }}>{formatAppointmentDate(appointment)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ backgroundColor: badge.bg, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: badge.text }}>{badge.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.muted} />
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
    </Pressable>
  );
});

export function TherapistPatientDetailScreen({ authToken, patientId, onBack, onSelectAppointment, c }) {
  const { patients, patientDetails, loadPatientDetail } = useTherapyData();

  const cached = patientDetails[patientId] ?? null;
  const listSummary = useMemo(
    () => patients.find((p) => p.id === patientId) ?? null,
    [patients, patientId],
  );

  const patient = cached?.patient ?? listSummary ?? null;
  const appointments = cached?.appointments ?? [];
  const hadInstantData = !!patient;

  const [historyLoading, setHistoryLoading] = useState(!cached);
  const [hardError, setHardError] = useState('');

  // Mark once whether the screen could paint immediately from cached/list data,
  // or had nothing to show until the background fetch below resolved.
  useEffect(() => {
    markMounted(patientId, hadInstantData ? 'PatientDetail (instant render from cache)' : 'PatientDetail (no cache yet)');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authToken || !patientId) return;
    let cancelled = false;
    setHistoryLoading(true);
    loadPatientDetail(authToken, patientId).then((data) => {
      if (cancelled) return;
      if (!data && !patient) setHardError('Patient:in konnte nicht geladen werden.');
      else setHardError('');
    }).finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, patientId, loadPatientDetail]);

  const handleSelectAppointment = useCallback((appointment) => {
    onSelectAppointment?.(appointment, patient);
  }, [onSelectAppointment, patient]);

  const showHistorySkeleton = historyLoading && appointments.length === 0;

  const renderHeader = () => (
    <>
      <Pressable
        onPress={onBack}
        style={{ alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Ionicons name="chevron-back" size={16} color={c.primary} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Zurück</Text>
      </Pressable>

      {patient ? (
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
      ) : (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, paddingVertical: 32, alignItems: 'center', marginBottom: SPACE.lg }}>
          <ActivityIndicator color={c.primary} />
        </View>
      )}

      {patient ? (
        <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: c.muted, textTransform: 'uppercase', marginBottom: 8 }}>
          Terminverlauf
        </Text>
      ) : null}
    </>
  );

  const renderEmpty = () => {
    if (!patient) {
      return hardError ? (
        <Text style={{ fontSize: 14, color: c.error, textAlign: 'center' }}>{hardError}</Text>
      ) : null;
    }
    if (showHistorySkeleton) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      );
    }
    return <Text style={{ fontSize: 13, color: c.muted }}>Noch keine Termine mit dieser Person.</Text>;
  };

  return (
    <View style={{ flex: 1 }}>
      <TabHeader c={c} title={patient?.fullName ?? 'Patient:in'} />
      <FlatList
        data={patient ? appointments : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AppointmentRow c={c} appointment={item} onSelect={handleSelectAppointment} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ padding: SPACE.xl, paddingTop: SPACE.sm, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
