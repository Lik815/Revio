import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getNotificationPresentation } from '../utils/notification-presentation';

export function NotificationCard({ notification, onPress, c, isRead = false }) {
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
        opacity: pressed ? 0.65 : isRead ? 0.6 : 1,
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: c.text, fontWeight: isRead ? '600' : '700' }} numberOfLines={1}>
            {pres.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, color: c.muted }}>{timeLabel}</Text>
            {!isRead ? <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.success ?? '#5A9E8E' }} /> : null}
          </View>
        </View>
        <Text style={{ fontSize: 12, color: c.muted }}>{dateLabel}</Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: c.text, marginTop: 1 }}>
          {notification.message}
        </Text>
        {notification.actionLabel ? (
          <Text style={{ fontSize: 12, color: pres.iconColor, fontWeight: '600', marginTop: 1 }}>
            {notification.actionLabel}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={16} color={c.muted} style={{ marginTop: 3 }} />
    </Pressable>
  );
}
