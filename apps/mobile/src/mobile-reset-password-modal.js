import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, TUNNEL_HEADERS } from './utils/app-utils';

export function ResetPasswordModal({ visible, token, onClose, onDone, c }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleClose = () => { setNewPassword(''); setConfirm(''); setError(''); setDone(false); onClose(); };

  const handleSubmit = async () => {
    setError('');
    if (newPassword.length < 8) { setError('Passwort muss mindestens 8 Zeichen lang sein.'); return; }
    if (newPassword !== confirm) { setError('Passwörter stimmen nicht überein.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
        body: JSON.stringify({ token, password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message ?? 'Fehler beim Zurücksetzen.'); return; }
      setDone(true);
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.mutedBg, color: c.text, fontSize: 16, padding: 14, marginBottom: 14 };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, paddingBottom: 48 }}>
          <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
          {done ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 8 }}>Passwort geändert</Text>
              <Text style={{ fontSize: 15, color: c.muted, marginBottom: 24 }}>Du kannst dich jetzt mit deinem neuen Passwort anmelden.</Text>
              <Pressable onPress={() => { handleClose(); onDone(); }}
                style={{ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Zur Anmeldung</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 8 }}>Neues Passwort</Text>
              <Text style={{ fontSize: 15, color: c.muted, marginBottom: 24 }}>Wähle ein neues Passwort für dein Konto.</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted, marginBottom: 6 }}>NEUES PASSWORT</Text>
              <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="Mindestens 8 Zeichen"
                placeholderTextColor={c.muted} secureTextEntry style={inputStyle} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted, marginBottom: 6 }}>PASSWORT BESTÄTIGEN</Text>
              <TextInput value={confirm} onChangeText={setConfirm} placeholder="Passwort wiederholen"
                placeholderTextColor={c.muted} secureTextEntry style={inputStyle} />
              {!!error && (
                <View style={{ backgroundColor: c.errorBg, borderRadius: 10, padding: 12, marginBottom: 14, flexDirection: 'row', gap: 8 }}>
                  <Ionicons name="alert-circle-outline" size={16} color={c.error} />
                  <Text style={{ color: c.error, fontSize: 14, flex: 1 }}>{error}</Text>
                </View>
              )}
              <Pressable disabled={loading} onPress={handleSubmit}
                style={{ backgroundColor: loading ? c.border : c.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Passwort speichern</Text>}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
