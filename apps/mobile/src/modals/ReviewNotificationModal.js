import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function getTitle(notification, t) {
  switch (notification?.type) {
    case 'PROFILE_APPROVED': return t('reviewNotificationApprovedTitle');
    case 'PROFILE_CHANGES_REQUESTED': return t('reviewNotificationChangesTitle');
    case 'PROFILE_REJECTED': return t('reviewNotificationRejectedTitle');
    case 'PROFILE_SUSPENDED': return t('reviewNotificationSuspendedTitle');
    default: return t('notificationsOption');
  }
}

export function ReviewNotificationModal({ visible, notification, onDone, c, t }) {
  const isApproved = notification?.type === 'PROFILE_APPROVED';
  const handleDone = () => onDone?.();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDone}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={handleDone}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons
                  name={isApproved ? 'checkmark-circle' : 'notifications'}
                  size={34}
                  color={isApproved ? c.success : c.primary}
                />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                {getTitle(notification, t)}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 21 }}>
              {notification?.message}
            </Text>
            <Pressable
              style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              onPress={handleDone}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('doneBtn')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
