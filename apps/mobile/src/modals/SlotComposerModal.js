import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TherapistSlotComposer } from '../components/SlotComposer';

export function SlotComposerModal({ visible, onClose, onAddSlot, c }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, flex: 1 }}>Neuen Termin anlegen</Text>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={c.muted} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20 }}>
            <TherapistSlotComposer c={c} onAddSlot={onAddSlot} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
