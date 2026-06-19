import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';

export function AuthPrimaryButton({ label, onPress, disabled, icon, c, styles, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.registerBtn,
        { backgroundColor: disabled ? c.border : c.primary, flexDirection: 'row', gap: 8 },
        style,
      ]}
    >
      <Text style={styles.registerBtnText}>{label}</Text>
      {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
    </Pressable>
  );
}
