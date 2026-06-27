import React from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function DeleteFreeSlotsModal({ visible, count, loading, onClose, onConfirm, c }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(16, 37, 49, 0.42)',
          justifyContent: 'center',
          padding: 22,
        }}
      >
        <Pressable
          disabled={loading}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 30,
            padding: 22,
            gap: 18,
            borderWidth: 1,
            borderColor: c.border,
            shadowColor: '#102531',
            shadowOpacity: 0.18,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 16 },
            elevation: 18,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                backgroundColor: '#FFF1F1',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={26} color={c.error} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 22, lineHeight: 27, fontWeight: '800', color: c.text }}>
                Freie Termine löschen?
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: c.muted }}>
                Du löschst alle aktuell freien Termine. Gebuchte Termine bleiben bestehen.
              </Text>
            </View>
          </View>

          <View
            style={{
              borderRadius: 18,
              backgroundColor: c.mutedBg,
              borderWidth: 1,
              borderColor: c.border,
              padding: 16,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: c.muted, textTransform: 'uppercase' }}>
              Betroffen
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: c.text }}>
              {count} freie Termine
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 19, color: c.muted }}>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              disabled={loading}
              onPress={onClose}
              style={{
                flex: 1,
                minHeight: 54,
                borderRadius: 18,
                backgroundColor: c.mutedBg,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading ? 0.55 : 1,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: c.text }}>Abbrechen</Text>
            </Pressable>
            <Pressable
              disabled={loading}
              onPress={onConfirm}
              style={{
                flex: 1,
                minHeight: 54,
                borderRadius: 18,
                backgroundColor: c.error,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading ? 0.72 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Löschen</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
