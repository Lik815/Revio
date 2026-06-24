import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS } from '../utils/app-utils';
import { TherapistSlotComposer } from '../components/SlotComposer';
import { MAX_SLOTS as SERIES_MAX_SLOTS, SeriesSlotComposer } from '../components/SeriesSlotComposer';

export function SlotComposerModal({ visible, onClose, onAddSlot, onAddSlots, error, c }) {
  const [mode, setMode] = useState('single');
  const [seriesState, setSeriesState] = useState({ canSubmit: false, count: 0, overLimit: false, ctaLabel: 'Serie anlegen' });
  const seriesRef = useRef(null);

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

          <ScrollView style={{ maxHeight: '72%' }} contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
            {mode === 'single' ? (
              <TherapistSlotComposer c={c} onAddSlot={onAddSlot} />
            ) : (
              <SeriesSlotComposer ref={seriesRef} c={c} onAddSlots={onAddSlots} onStateChange={setSeriesState} />
            )}
          </ScrollView>

          {mode === 'series' && (
            <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 8 }}>
              {seriesState.overLimit ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.errorBg ?? '#FEF2F2', borderRadius: RADIUS.sm, padding: 8 }}>
                  <Ionicons name="alert-circle-outline" size={14} color={c.error} />
                  <Text style={{ fontSize: 12, color: c.error, flex: 1 }}>Maximal {SERIES_MAX_SLOTS} Termine pro Serie — bitte Zeitraum eingrenzen.</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => seriesRef.current?.submit()}
                disabled={!seriesState.canSubmit}
                style={{ backgroundColor: seriesState.canSubmit ? c.primary : c.border, borderRadius: RADIUS.sm, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                  {seriesState.ctaLabel}
                </Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
