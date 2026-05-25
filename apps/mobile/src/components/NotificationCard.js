import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getNotificationPresentation } from '../utils/notification-presentation';

export function NotificationCard({ notification, onPress, onDismiss, c }) {
  const pres = getNotificationPresentation(notification.type, c);

  const date = new Date(notification.createdAt);
  const dateLabel = date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeLabel = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      {/* Status-Icon */}
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: pres.iconBg,
          borderWidth: 1,
          borderColor: pres.iconBorder,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
          flexShrink: 0,
        }}
      >
        <Ionicons name={pres.icon} size={19} color={pres.iconColor} />
      </View>

      {/* Text */}
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{ fontSize: 14, lineHeight: 20, color: c.text, fontWeight: '500' }}
        >
          {notification.message}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 12, color: c.muted }}>
            {dateLabel}, {timeLabel}
          </Text>
          {notification.actionLabel ? (
            <Text style={{ fontSize: 12, color: pres.iconColor, fontWeight: '600' }}>
              {notification.actionLabel}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Dismiss */}
      <Pressable
        onPress={(e) => { e.stopPropagation?.(); onDismiss(); }}
        hitSlop={12}
        style={{ paddingTop: 2, paddingLeft: 4 }}
      >
        <Ionicons name="close-outline" size={20} color={c.muted} />
      </Pressable>
    </Pressable>
  );
}
