import React from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS } from '../utils/app-utils';

const LEARN_MORE_URL = 'https://revio.app';

export function NewsAnnouncementModal({ visible, onClose, c }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }} onPress={() => {}}>
          <Pressable onPress={onClose} hitSlop={12} style={{ alignSelf: 'flex-end', marginBottom: -8 }}>
            <Ionicons name="close" size={22} color={c.muted} />
          </Pressable>

          <View style={{ alignItems: 'center', gap: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="rocket-outline" size={28} color={c.primary} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: '700', color: c.text, textAlign: 'center' }}>
              REVIO geht ab Oktober live!
            </Text>
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
              Wir arbeiten an REVIO – dem nächsten Schritt für deine Praxis-App. Ab Oktober erwarten dich neue
              Funktionen für Therapeuten und ihre Kunden. Sei dabei und verpasse keine Neuigkeit aus App und
              Community.
            </Text>
          </View>

          <Pressable onPress={() => Linking.openURL(LEARN_MORE_URL)}
            style={({ pressed }) => ({
              borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
              borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1,
            })}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>Mehr erfahren</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
