import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, RADIUS, SHADOW, SPACE, TUNNEL_HEADERS } from '../../utils/app-utils';
import { TabHeader } from '../../components/TabHeader';

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
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{patient.fullName}</Text>
        {patient.phone ? (
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{patient.phone}</Text>
        ) : patient.email ? (
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{patient.email}</Text>
        ) : null}
        {meta ? (
          <Text style={{ fontSize: 12, color: c.primary, fontWeight: '600', marginTop: 3 }}>{meta}</Text>
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

export function TherapistPatientsScreen({ authToken, onBack, onSelectPatient, c }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${getBaseUrl()}/therapist/patients`, {
      headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Fehler ${res.status}`))))
      .then((data) => { if (!cancelled) setPatients(Array.isArray(data.patients) ? data.patients : []); })
      .catch(() => { if (!cancelled) setError('Patient:innen konnten nicht geladen werden.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authToken]);

  return (
    <View style={{ flex: 1 }}>
      <TabHeader c={c} title="Patient:innen" />
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
        ) : error ? (
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14, color: c.error, textAlign: 'center' }}>{error}</Text>
          </View>
        ) : patients.length === 0 ? (
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center', gap: 8 }}>
            <Ionicons name="people-outline" size={36} color={c.muted} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, textAlign: 'center' }}>Noch keine Patient:innen</Text>
            <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
              Sobald jemand einen Termin bei dir bucht, erscheint die Person hier.
            </Text>
          </View>
        ) : (
          patients.map((patient) => (
            <PatientListRow key={patient.id} c={c} patient={patient} onPress={() => onSelectPatient(patient.id)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
