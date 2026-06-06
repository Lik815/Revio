import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function CancelAppointmentModal({ visible, onClose, onConfirm, appointment, c }) {
  const isConfirmed = appointment?.status === 'CONFIRMED';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 20 }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close-circle" size={34} color="#DC2626" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                Termin stornieren
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 21 }}>
              {isConfirmed
                ? 'Möchtest du diesen bestätigten Termin wirklich stornieren? Der Therapeut wird benachrichtigt.'
                : 'Möchtest du diese Anfrage wirklich stornieren?'}
            </Text>
            <View style={{ gap: 10 }}>
              <Pressable
                style={{ backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                onPress={onConfirm}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Stornieren</Text>
              </Pressable>
              <Pressable
                style={{ backgroundColor: c.mutedBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                onPress={onClose}
              >
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>Abbrechen</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
