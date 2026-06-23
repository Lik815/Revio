import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function SlotCreatedModal({ visible, onClose, slot, result, c }) {
  const createdCount = result?.created?.length ?? 0;
  const skippedCount = result?.skipped?.length ?? 0;
  const rejectedCount = result?.rejected?.length ?? 0;
  const isResultMode = !!result;
  const hasCreated = !isResultMode || createdCount > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: hasCreated ? c.accentBg : c.mutedBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={hasCreated ? 'calendar-outline' : 'alert-circle-outline'} size={32} color={hasCreated ? c.accent : c.muted} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                {isResultMode ? (hasCreated ? 'Termine angelegt' : 'Keine Termine angelegt') : 'Termin erstellt'}
              </Text>
            </View>

            {isResultMode ? (
              <View style={{ gap: 8 }}>
                {createdCount > 0 ? (
                  <View style={{ backgroundColor: c.primaryBg, borderRadius: 12, padding: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: c.primary }}>
                      {createdCount === 1 ? '1 Termin angelegt' : `${createdCount} Termine angelegt`}
                    </Text>
                  </View>
                ) : null}
                {skippedCount > 0 ? (
                  <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center' }}>
                    {skippedCount} {skippedCount === 1 ? 'Termin war' : 'Termine waren'} bereits vorhanden — übersprungen
                  </Text>
                ) : null}
                {rejectedCount > 0 ? (
                  <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center' }}>
                    {rejectedCount} {rejectedCount === 1 ? 'Termin lag' : 'Termine lagen'} in der Vergangenheit
                  </Text>
                ) : null}
              </View>
            ) : slot?.startsAt ? (
              <View style={{ backgroundColor: c.primaryBg, borderRadius: 12, padding: 16, alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: c.primary }}>
                  {new Date(slot.startsAt).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                </Text>
                <Text style={{ fontSize: 15, color: c.primary }}>
                  {new Date(slot.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · {slot.durationMin ?? 20} Min.
                </Text>
              </View>
            ) : null}

            {hasCreated ? (
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
                {isResultMode ? 'Die Termine sind jetzt für Patienten sichtbar und buchbar.' : 'Der Termin ist jetzt für Patienten sichtbar und buchbar.'}
              </Text>
            ) : null}

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
