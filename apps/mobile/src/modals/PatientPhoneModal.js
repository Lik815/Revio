import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RADIUS, getBaseUrl, TUNNEL_HEADERS } from '../utils/app-utils';

export function PatientPhoneModal({ visible, onClose, authToken, currentPhone, onSaved, c }) {
  const [phone, setPhone] = useState(currentPhone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhone(currentPhone ?? '');
      setError('');
      setSuccess(false);
    }
  }, [visible, currentPhone]);

  const handleClose = () => { setError(''); setSuccess(false); onClose(); };

  const handleSubmit = async () => {
    setError('');
    if (!phone.trim()) { setError('Bitte gib eine Telefonnummer ein.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message ?? 'Telefonnummer konnte nicht gespeichert werden.'); return; }
      setSuccess(true);
      onSaved(data.phone ?? phone.trim());
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
          <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, marginBottom: 16 }}>Telefonnummer</Text>
          {success ? (
            <Text style={{ color: c.success ?? '#1A7A40', fontSize: 15, marginBottom: 16 }}>Gespeichert.</Text>
          ) : (
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+49 …"
              placeholderTextColor={c.muted}
              keyboardType="phone-pad"
              style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
            />
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
                disabled={loading}
                style={{ flex: 1, borderRadius: 12, backgroundColor: c.primary, paddingVertical: 13, alignItems: 'center' }}
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

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: RADIUS.sm, fontSize: 15, padding: 12 },
});
