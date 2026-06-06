import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function SlotCreatedModal({ visible, onClose, slot, c }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.accentBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar-outline" size={32} color={c.accent} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                Termin erstellt
              </Text>
            </View>
            {slot?.startsAt ? (
              <View style={{ backgroundColor: c.primaryBg, borderRadius: 12, padding: 16, alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: c.primary }}>
                  {new Date(slot.startsAt).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                </Text>
                <Text style={{ fontSize: 15, color: c.primary }}>
                  {new Date(slot.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · {slot.durationMin ?? 20} Min.
                </Text>
              </View>
            ) : null}
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
              Der Termin ist jetzt für Patienten sichtbar und buchbar.
            </Text>
            <Pressable
              style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              onPress={onClose}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Fertig</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
