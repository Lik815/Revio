import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS } from '../../utils/app-utils';

function SocialButton({ icon, label, onPress, c }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: RADIUS.md,
        borderWidth: 1.5,
        borderColor: c.border,
        backgroundColor: pressed ? c.mutedBg : c.card,
      })}
    >
      <Ionicons name={icon} size={18} color={c.text} />
      <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{label}</Text>
    </Pressable>
  );
}

export function SocialAuthButtons({ c }) {
  const comingSoon = () => Alert.alert('Bald verfuegbar', 'Diese Anmeldemethode ist noch nicht aktiv.');

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <Text style={{ fontSize: 12, color: c.muted }}>oder weiter mit</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SocialButton icon="logo-google" label="Google" onPress={comingSoon} c={c} />
        <SocialButton icon="logo-apple" label="Apple" onPress={comingSoon} c={c} />
      </View>
    </View>
  );
}
