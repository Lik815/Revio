import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOW, SPACE } from '../../utils/app-utils';

function initialsOf(fullName) {
  return (fullName ?? '?').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatPatientMeta(patient) {
  if (patient.nextAppointmentAt) {
    const d = new Date(patient.nextAppointmentAt);
    return `Nächster Termin: ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`;
  }
  if (patient.lastBookingAt) {
    const d = new Date(patient.lastBookingAt);
    return `Letzter Termin: ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`;
  }
  return null;
}

function PatientListRow({ c, patient, onPress }) {
  const meta = formatPatientMeta(patient);
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 18,
        backgroundColor: c.card,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: c.border,
        paddingVertical: 22,
        paddingHorizontal: 18,
        marginBottom: 16,
        ...SHADOW.card,
      }}
    >
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 21, fontWeight: '800', color: c.primary }}>{initialsOf(patient.fullName)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 18, lineHeight: 23, fontWeight: '800', color: c.text }} numberOfLines={1}>{patient.fullName}</Text>
        {patient.phone ? (
          <Text style={{ fontSize: 14, color: c.textMuted ?? c.muted, marginTop: 3 }} numberOfLines={1}>{patient.phone}</Text>
        ) : patient.email ? (
          <Text style={{ fontSize: 14, color: c.textMuted ?? c.muted, marginTop: 3 }} numberOfLines={1}>{patient.email}</Text>
        ) : null}
        {meta ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Ionicons name="calendar-outline" size={15} color={c.muted} />
            <Text style={{ fontSize: 14, color: c.primary, fontWeight: '700' }} numberOfLines={1}>{meta}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 14 }}>
        <Text style={{ fontSize: 15, color: c.textMuted ?? c.muted, fontWeight: '600' }}>
          {patient.bookingCount} {patient.bookingCount === 1 ? 'Termin' : 'Termine'}
        </Text>
        <Ionicons name="chevron-forward" size={24} color={c.muted} />
      </View>
    </Pressable>
  );
}

export function PatientsPane({ patients, patientsLoading, patientsLastLoadedAt, onSelectPatient, c }) {
  const [query, setQuery] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const showLoading = patientsLoading && patientsLastLoadedAt === 0;
  const safePatients = Array.isArray(patients) ? patients : [];
  const filteredPatients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return safePatients
      .filter((patient) => {
        if (upcomingOnly && !patient.nextAppointmentAt) return false;
        if (!needle) return true;
        return [patient.fullName, patient.phone, patient.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (!upcomingOnly) return 0;
        return new Date(a.nextAppointmentAt ?? 0) - new Date(b.nextAppointmentAt ?? 0);
      });
  }, [query, safePatients, upcomingOnly]);

  const renderSearch = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, minHeight: 66, paddingLeft: 18, marginBottom: 22, ...SHADOW.card }}>
      <Ionicons name="search-outline" size={26} color={c.textMuted ?? c.muted} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Patienten suchen..."
        placeholderTextColor={c.textMuted ?? c.muted}
        style={{ flex: 1, color: c.text, fontSize: 18, fontWeight: '500', paddingHorizontal: 14, paddingVertical: 0 }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={() => setUpcomingOnly((value) => !value)}
        hitSlop={8}
        style={{ width: 64, alignSelf: 'stretch', borderLeftWidth: 1, borderLeftColor: c.border, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg, backgroundColor: upcomingOnly ? c.primaryBg : 'transparent' }}
      >
        <Ionicons name="options-outline" size={25} color={upcomingOnly ? c.primary : c.text} />
      </Pressable>
    </View>
  );

  if (showLoading) {
    return (
      <>
        {renderSearch()}
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      </>
    );
  }

  if (safePatients.length === 0) {
    return (
      <>
        {renderSearch()}
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center', gap: 8 }}>
          <Ionicons name="people-outline" size={36} color={c.muted} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, textAlign: 'center' }}>Noch keine Patienten</Text>
          <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
            Sobald jemand einen Termin bei dir bucht, erscheint die Person hier.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      {renderSearch()}
      {filteredPatients.length === 0 ? (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 8 }}>
          <Ionicons name="search-outline" size={30} color={c.muted} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'center' }}>Keine passenden Patienten</Text>
        </View>
      ) : filteredPatients.map((patient) => (
        <PatientListRow key={patient.id} c={c} patient={patient} onPress={() => onSelectPatient(patient.id)} />
      ))}
    </>
  );
}
