import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { NotificationCard } from '../components/NotificationCard';

export function NotificationSheet({
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
  const items = (notifications ?? []).filter((n) => !dismissedNotifIds.has(n.id));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onClose}
      />

      {/* Sheet */}
      <View
        style={{
          backgroundColor: c.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '80%',
        }}
      >
        {/* Handle */}
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: c.border,
            alignSelf: 'center',
            marginTop: 12,
            marginBottom: 4,
          }}
        />

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>
            {t('notificationsTitle')}
          </Text>
          {items.length > 0 ? (
            <Pressable onPress={dismissAllNotifications} hitSlop={10}>
              <Text style={{ fontSize: 13, color: c.muted }}>
                {t('clearAllBtn') ?? 'Alle löschen'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Empty state */}
        {items.length === 0 ? (
          <View
            style={{
              paddingVertical: 52,
              paddingHorizontal: 20,
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>
              Keine neuen Benachrichtigungen
            </Text>
            <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', lineHeight: 19 }}>
              {t('noNotifications')}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 44 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {items.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                onPress={() => onPressNotification(n)}
                onDismiss={() => dismissNotification(n.id)}
                c={c}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
