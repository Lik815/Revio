import React, { useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { RADIUS, TYPE, getBaseUrl, TUNNEL_HEADERS } from '../../utils/app-utils';

export function ChangePasswordModal({ visible, onClose, authToken, c, t }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); setSuccess(''); };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!current.trim()) { setError(t('changePasswordErrorCurrent')); return; }
    if (next.length < 8) { setError(t('changePasswordErrorTooShort')); return; }
    if (next !== confirm) { setError(t('changePasswordErrorMismatch')); return; }
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message ?? t('changePasswordErrorFail')); return; }
      reset();
      setSuccess(t('changePasswordSuccess'));
    } catch {
      setError(t('alertConnectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 }} onPress={handleClose}>
        <Pressable style={{ backgroundColor: c.card, borderRadius: 18, padding: 24 }} onPress={() => {}}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, marginBottom: 16 }}>{t('changePassword')}</Text>
          <TextInput value={current} onChangeText={setCurrent} placeholder={t('currentPassword')} placeholderTextColor={c.muted}
            secureTextEntry style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]} />
          <TextInput value={next} onChangeText={setNext} placeholder={t('newPassword')} placeholderTextColor={c.muted}
            secureTextEntry style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginTop: 10 }]} />
          <TextInput value={confirm} onChangeText={setConfirm} placeholder={t('confirmNewPassword')} placeholderTextColor={c.muted}
            secureTextEntry style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginTop: 10 }]} />
          {!!error && <Text style={{ color: c.error, fontSize: 13, marginTop: 10 }}>{error}</Text>}
          {!!success && <Text style={{ color: c.success, fontSize: 13, marginTop: 10 }}>{success}</Text>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Pressable onPress={handleClose}
              style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{t('cancelBtn') || 'Abbrechen'}</Text>
            </Pressable>
            <Pressable onPress={handleSubmit} disabled={loading}
              style={{ flex: 1, borderRadius: 12, backgroundColor: loading ? c.mutedBg : c.primary, paddingVertical: 13, alignItems: 'center' }}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{t('saveBtn') || 'Speichern'}</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, fontSize: TYPE.body.fontSize, outlineWidth: 0 },
});
