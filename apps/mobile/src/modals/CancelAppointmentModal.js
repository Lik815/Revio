import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function CancelAppointmentModal({ visible, onClose, onConfirm, appointment, c }) {
  const isConfirmed = appointment?.status === 'CONFIRMED';
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!visible) setReason('');
  }, [visible]);

  const canConfirm = !isConfirmed || reason.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
                ? 'Warum möchtest du den Termin stornieren? Der Therapeut wird benachrichtigt.'
                : 'Möchtest du diese Anfrage wirklich stornieren?'}
            </Text>
            {isConfirmed ? (
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Grund der Stornierung"
                placeholderTextColor={c.muted}
                multiline
                style={{
                  borderWidth: 1, borderColor: c.border, borderRadius: 12,
                  backgroundColor: c.mutedBg, color: c.text, fontSize: 14,
                  padding: 12, minHeight: 70, textAlignVertical: 'top',
                }}
              />
            ) : null}
            <View style={{ gap: 10 }}>
              <Pressable
                disabled={!canConfirm}
                style={{ backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: canConfirm ? 1 : 0.4 }}
                onPress={() => onConfirm(reason.trim())}
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
      </KeyboardAvoidingView>
    </Modal>
  );
}
