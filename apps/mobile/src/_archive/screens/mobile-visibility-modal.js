import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function VisibilityModal({ visible, onClose, onChoice, loading, c, t }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>{t('makeProfileVisible')}</Text>
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
              {t('visibilityQuestion')}
            </Text>
            <Pressable
              style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: loading ? 0.6 : 1 }}
              onPress={() => onChoice('visible')}
              disabled={loading}
            >
              <Ionicons name="eye-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('visibleLabel')}</Text>
            </Pressable>
            <Pressable
              style={{ backgroundColor: c.mutedBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: c.border, opacity: loading ? 0.6 : 1 }}
              onPress={() => onChoice('hidden')}
              disabled={loading}
            >
              <Ionicons name="eye-off-outline" size={20} color={c.text} />
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{t('hiddenLabel')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
