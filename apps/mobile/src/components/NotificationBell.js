import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

/**
 * Props:
 *   onPress    – () => void
 *   badgeCount – number of unread notifications
 *   c          – color theme object
 */
export function NotificationBell({ onPress, badgeCount = 0, c }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        top: 12,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        elevation: 10,
      }}
    >
      <Ionicons name="notifications-outline" size={18} color={c.text} />
      {badgeCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: c.error,
          }}
        />
      )}
    </Pressable>
  );
}
