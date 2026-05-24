import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ICON_MAP = {
  PROFILE_APPROVED: { name: 'checkmark-circle', colorKey: 'success' },
  PROFILE_CHANGES_REQUESTED: { name: 'create-outline', colorKey: 'primary' },
  PROFILE_REJECTED: { name: 'close-circle', colorKey: 'error' },
  PROFILE_SUSPENDED: { name: 'pause-circle', colorKey: 'error' },
  NEW_BOOKING_REQUEST: { name: 'calendar', colorKey: 'primary' },
  BOOKING_CONFIRMED: { name: 'checkmark-circle', colorKey: 'success' },
  BOOKING_DECLINED: { name: 'close-circle', colorKey: 'error' },
  BOOKING_CANCELLED: { name: 'calendar-clear-outline', colorKey: 'muted' },
  JOIN_REQUEST: { name: 'person-add-outline', colorKey: 'primary' },
  INVITE: { name: 'mail-outline', colorKey: 'primary' },
};

export function NotificationsSheet({
  visible,
  onClose,
  notifications,
  dismissedNotifIds,
  dismissNotification,
  dismissAllNotifications,
  onPressNotification,
  c,
  t,
}) {
  const visible_ = (notifications ?? []).filter((n) => !dismissedNotifIds.has(n.id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
      <View style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, minHeight: 200 }}>
        <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{t('notificationsTitle')}</Text>
          {visible_.length > 0 && (
            <Pressable onPress={dismissAllNotifications} hitSlop={8}>
              <Text style={{ fontSize: 13, color: c.muted }}>{t('clearAllBtn') ?? 'Alle löschen'}</Text>
            </Pressable>
          )}
        </View>
        {visible_.length === 0 ? (
          <Text style={{ color: c.muted, textAlign: 'center', marginTop: 24 }}>{t('noNotifications')}</Text>
        ) : (
          visible_.map((n) => {
            const entry = ICON_MAP[n.type] ?? { name: 'notifications-outline', colorKey: 'primary' };
            const iconColor = entry.colorKey === 'success' ? (c.success ?? '#22c55e') : c[entry.colorKey];
            return (
              <Pressable
                key={n.id}
                onPress={() => onPressNotification(n)}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Ionicons name={entry.name} size={16} color={iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>{n.message}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <Text style={{ color: c.muted, fontSize: 11 }}>
                      {new Date(n.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {n.actionLabel && (
                      <Text style={{ color: c.primary, fontSize: 11, fontWeight: '600' }}>{n.actionLabel} ›</Text>
                    )}
                  </View>
                </View>
                <Pressable onPress={(e) => { e.stopPropagation?.(); dismissNotification(n.id); }} hitSlop={10} style={{ paddingTop: 2 }}>
                  <Ionicons name="close-outline" size={20} color={c.muted} />
                </Pressable>
              </Pressable>
            );
          })
        )}
      </View>
    </Modal>
  );
}
