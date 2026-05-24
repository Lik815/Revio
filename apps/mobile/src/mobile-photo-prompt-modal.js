import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function PhotoPromptModal({ visible, onGoToProfile, onDismiss, c, t }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={onDismiss}>
        <Pressable style={{ backgroundColor: c.card, borderRadius: 20, padding: 28, width: '100%', alignItems: 'center', gap: 12 }} onPress={() => {}}>
          <Ionicons name="camera-outline" size={52} color={c.muted} />
          <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, textAlign: 'center' }}>{t('addProfilePhoto')}</Text>
          <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
            {t('photoTrustNotice')}
          </Text>
          <Pressable
            onPress={onGoToProfile}
            style={{ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginTop: 4 }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('choosePhoto')}</Text>
          </Pressable>
          <Pressable onPress={onDismiss} style={{ paddingVertical: 10 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>{t('laterBtn')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
