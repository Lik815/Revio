import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { RADIUS } from '../utils/app-utils';

export function PatientTherapistToggle({ c, value, onChange, terminCount, patientCount }) {
  const segments = [
    { key: 'termine', label: `Termine (${terminCount})` },
    { key: 'patienten', label: `Patienten (${patientCount})` },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.full,
      padding: 5,
      marginBottom: 22,
      minHeight: 64,
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
              paddingVertical: 14,
              alignItems: 'center',
              backgroundColor: active ? c.primary : 'transparent',
              shadowColor: active ? '#1C2B33' : 'transparent',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: active ? 0.12 : 0,
              shadowRadius: active ? 12 : 0,
              elevation: active ? 3 : 0,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '800', color: active ? '#fff' : (c.textMuted ?? c.muted) }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
