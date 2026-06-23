import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function DeclineBookingModal({ visible, onClose, onConfirm, booking, loading, error, c }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 18 }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close-circle-outline" size={30} color="#DC2626" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                Anfrage ablehnen
              </Text>
            </View>

            {booking ? (
              <View style={{ backgroundColor: c.mutedBg, borderRadius: 12, padding: 14, gap: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
                  {booking.patientName ?? 'Patient'}
                </Text>
                {booking.patientPhone ? (
                  <Text style={{ fontSize: 13, color: c.muted }}>{booking.patientPhone}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted }}>Grund (optional)</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="z. B. Termin ist nicht mehr verfügbar"
                placeholderTextColor={c.muted}
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.mutedBg,
                  color: c.text, fontSize: 14, padding: 12, minHeight: 72, textAlignVertical: 'top',
                }}
              />
            </View>

            {!!error && <Text style={{ fontSize: 13, color: '#DC2626', textAlign: 'center' }}>{error}</Text>}

            <View style={{ gap: 10 }}>
              <Pressable
                disabled={loading}
                style={{ backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: loading ? 0.7 : 1 }}
                onPress={() => onConfirm(reason)}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Ablehnung senden</Text>}
              </Pressable>
              <Pressable
                disabled={loading}
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
