import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function ProfileSavedModal({ visible, onClose, title, body, c, t }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark-circle" size={34} color={c.primary} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                {title || t('profileSavedModalTitle')}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 21 }}>
              {body || t('profileSavedModalBody')}
            </Text>
            <Pressable
              style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              onPress={onClose}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('doneBtn')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
