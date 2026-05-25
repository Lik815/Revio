import React from 'react';
import { Animated, Text, View } from 'react-native';

/**
 * Props:
 *   message   – string | null — when truthy the toast is visible
 *   anim      – Animated.Value — translateY animation value from useToast hook
 *   c         – color theme object
 */
export function ToastOverlay({ message, anim, c }) {
  if (!message) return null;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 52,
        left: 16,
        right: 16,
        zIndex: 9999,
        transform: [{ translateY: anim }],
      }}
      pointerEvents="none"
    >
      <View
        style={{
          backgroundColor: c.text,
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Text style={{ color: c.background, fontSize: 14, fontWeight: '600', flex: 1 }}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
