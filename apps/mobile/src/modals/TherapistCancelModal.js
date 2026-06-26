import React, { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function TherapistCancelModal({ visible, onClose, onConfirm, booking, c }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!visible) setReason('');
  }, [visible]);

  const canConfirm = reason.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 20 }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar-clear-outline" size={30} color="#DC2626" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                Termin absagen
              </Text>
            </View>
            {booking && (
              <View style={{ backgroundColor: c.mutedBg, borderRadius: 12, padding: 14, gap: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
                  {booking.patientName ?? 'Patient'}
                </Text>
                {booking.patientPhone ? (
                  <Text style={{ fontSize: 13, color: c.muted }}>{booking.patientPhone}</Text>
                ) : null}
              </View>
            )}
            <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 21 }}>
              Bitte gib einen Grund an. Der Patient wird informiert.
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Grund der Absage"
              placeholderTextColor={c.muted}
              multiline
              style={{
                borderWidth: 1, borderColor: c.border, borderRadius: 12,
                backgroundColor: c.mutedBg, color: c.text, fontSize: 14,
                padding: 12, minHeight: 70, textAlignVertical: 'top',
              }}
            />
            <View style={{ gap: 10 }}>
              <Pressable
                disabled={!canConfirm}
                style={{ backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: canConfirm ? 1 : 0.4 }}
                onPress={() => onConfirm(reason.trim())}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Absagen</Text>
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
