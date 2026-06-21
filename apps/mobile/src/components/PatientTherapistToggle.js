import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { RADIUS } from '../utils/app-utils';

export function PatientTherapistToggle({ c, value, onChange, terminCount, patientCount }) {
  const segments = [
    { key: 'termine', label: `Termine (${terminCount})` },
    { key: 'patienten', label: `Patient:innen (${patientCount})` },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.full,
      padding: 4,
      marginBottom: 16,
    }}>
      {segments.map(({ key, label }) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={{
              flex: 1,
              borderRadius: RADIUS.full,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: active ? c.primary : 'transparent',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? '#fff' : c.muted }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
