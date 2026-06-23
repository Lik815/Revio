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
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: SPACE.md, marginBottom: SPACE.sm, ...SHADOW.card }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.primary }}>{initialsOf(patient.fullName)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }} numberOfLines={1}>{patient.fullName}</Text>
        {patient.phone ? (
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={1}>{patient.phone}</Text>
        ) : patient.email ? (
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={1}>{patient.email}</Text>
        ) : null}
        {meta ? (
          <Text style={{ fontSize: 12, color: c.primary, fontWeight: '600', marginTop: 3 }} numberOfLines={1}>{meta}</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ fontSize: 11, color: c.muted, fontWeight: '600' }}>
          {patient.bookingCount} {patient.bookingCount === 1 ? 'Termin' : 'Termine'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={c.muted} />
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
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, minHeight: 44, paddingLeft: 12, marginBottom: SPACE.md, ...SHADOW.card }}>
      <Ionicons name="search-outline" size={18} color={c.muted} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Patienten suchen..."
        placeholderTextColor={c.muted}
        style={{ flex: 1, color: c.text, fontSize: 14, paddingHorizontal: 10, paddingVertical: 0 }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={() => setUpcomingOnly((value) => !value)}
        hitSlop={8}
        style={{ width: 44, alignSelf: 'stretch', borderLeftWidth: 1, borderLeftColor: c.border, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md, backgroundColor: upcomingOnly ? c.primaryBg : 'transparent' }}
      >
        <Ionicons name="options-outline" size={18} color={upcomingOnly ? c.primary : c.text} />
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
