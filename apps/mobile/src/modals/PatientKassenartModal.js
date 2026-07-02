import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';

const OPTIONS = [
  { key: 'gesetzlich', label: 'Gesetzlich' },
  { key: 'privat', label: 'Privat' },
  { key: 'selbstzahler', label: 'Selbstzahler' },
];

export function PatientKassenartModal({ visible, onClose, authToken, currentKassenart, onSaved, c }) {
  const [selected, setSelected] = useState(currentKassenart ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelected(currentKassenart ?? null);
      setError('');
      setSuccess(false);
    }
  }, [visible, currentKassenart]);

  const handleClose = () => { setError(''); setSuccess(false); onClose(); };

  const handleSubmit = async () => {
    if (!selected) { setError('Bitte eine Versicherungsart auswählen.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ kassenart: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message ?? 'Konnte nicht gespeichert werden.'); return; }
      setSuccess(true);
      onSaved(data.kassenart ?? selected);
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 }} onPress={handleClose}>
        <Pressable style={{ backgroundColor: c.card, borderRadius: 18, padding: 24 }} onPress={() => {}}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, marginBottom: 16 }}>Versicherungsart</Text>

          {success ? (
            <Text style={{ color: c.success ?? '#1A7A40', fontSize: 15, marginBottom: 16 }}>Gespeichert.</Text>
          ) : (
            <View style={{ gap: 8, marginBottom: 4 }}>
              {OPTIONS.map((opt) => {
                const isSelected = selected === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setSelected(opt.key)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      paddingVertical: 13, paddingHorizontal: 14,
                      borderRadius: RADIUS.md, borderWidth: 1.5,
                      borderColor: isSelected ? c.primary : c.border,
                      backgroundColor: isSelected ? (c.primaryBg ?? c.mutedBg) : c.mutedBg,
                    }}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                      borderColor: isSelected ? c.primary : c.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} />}
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '400', color: isSelected ? c.primary : c.text }}>
                      {opt.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={16} color={c.primary} style={{ marginLeft: 'auto' }} />}
                  </Pressable>
                );
              })}
            </View>
          )}

          {!!error && <Text style={{ color: c.error, fontSize: 13, marginTop: 8 }}>{error}</Text>}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Pressable
              onPress={handleClose}
              style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 13, alignItems: 'center' }}
            >
              <Text style={{ color: c.text, fontWeight: '600' }}>{success ? 'Schliessen' : 'Abbrechen'}</Text>
            </Pressable>
            {!success && (
              <Pressable
                onPress={handleSubmit}
                disabled={loading || !selected}
                style={{ flex: 1, borderRadius: 12, backgroundColor: selected ? c.primary : c.border, paddingVertical: 13, alignItems: 'center' }}
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Speichern</Text>}
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
