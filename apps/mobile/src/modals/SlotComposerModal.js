import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS } from '../utils/app-utils';
import { TherapistSlotComposer } from '../components/SlotComposer';
import { SeriesSlotComposer } from '../components/SeriesSlotComposer';

export function SlotComposerModal({ visible, onClose, onAddSlot, onAddSlots, error, c }) {
  const [mode, setMode] = useState('single');

  useEffect(() => {
    if (!visible) setMode('single');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: '88%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, flex: 1 }}>
              {mode === 'single' ? 'Neuen Termin anlegen' : 'Serie anlegen'}
            </Text>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={c.muted} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', backgroundColor: c.mutedBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: c.border, padding: 4 }}>
              {[{ key: 'single', label: 'Einzeltermin' }, { key: 'series', label: 'Serie' }].map(({ key, label }) => {
                const active = mode === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setMode(key)}
                    style={{ flex: 1, borderRadius: RADIUS.full, paddingVertical: 10, alignItems: 'center', backgroundColor: active ? c.primary : 'transparent' }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? '#fff' : c.muted }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {!!error && (
            <View style={{ marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.errorBg ?? '#FEF2F2', borderRadius: RADIUS.sm, padding: 10 }}>
              <Ionicons name="alert-circle-outline" size={14} color={c.error} />
              <Text style={{ fontSize: 12, color: c.error, flex: 1 }}>{error}</Text>
            </View>
          )}

          <ScrollView style={{ maxHeight: '70%' }} contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
            {mode === 'single' ? (
              <TherapistSlotComposer c={c} onAddSlot={onAddSlot} />
            ) : (
              <SeriesSlotComposer c={c} onAddSlots={onAddSlots} />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
