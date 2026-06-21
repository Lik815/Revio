import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Gate shown before activating bookingMode = FIRST_APPOINTMENT_REQUEST. The
// therapist picks which Heilmittel they treat once here; patients then see
// it automatically on the profile/booking screen without entering anything
// themselves.
export function HeilmittelSelectModal({ visible, onClose, onConfirm, options, loading, error, c }) {
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (visible) setSelected([]);
  }, [visible]);

  const toggle = (key) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16, maxHeight: '82%' }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="medkit-outline" size={30} color={c.primary} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                Welche Heilmittel behandelst du?
              </Text>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
                Patient:innen sehen das automatisch auf deinem Profil und im Buchungsbereich — du musst es nur einmal festlegen.
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {options.map((opt) => {
                  const active = selected.includes(opt.key);
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => toggle(opt.key)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingVertical: 8, paddingHorizontal: 14,
                        borderRadius: 20, borderWidth: 1.5,
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.primaryBg : c.mutedBg,
                      }}
                    >
                      {active && <Ionicons name="checkmark" size={14} color={c.primary} />}
                      <Text style={{ fontSize: 13, color: active ? c.primary : c.muted, fontWeight: active ? '600' : '400' }}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {!!error && <Text style={{ fontSize: 13, color: '#DC2626', textAlign: 'center' }}>{error}</Text>}

            <View style={{ gap: 10 }}>
              <Pressable
                disabled={loading || selected.length === 0}
                style={{
                  backgroundColor: selected.length === 0 ? c.border : c.primary,
                  borderRadius: 14, paddingVertical: 14, alignItems: 'center',
                  opacity: loading ? 0.7 : 1,
                }}
                onPress={() => onConfirm(selected)}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: selected.length === 0 ? c.muted : '#fff', fontSize: 16, fontWeight: '700' }}>
                    Terminanfragen aktivieren
                  </Text>
                )}
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
