import React, { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { RADIUS } from './mobile-utils';

export function DeleteAccountModal({ visible, onClose, onConfirmed, loggedInTherapist, loggedInPatient, c, t }) {
  const [nameInput, setNameInput] = useState('');

  const expectedLastName = loggedInTherapist
    ? (loggedInTherapist.fullName?.split(' ').slice(-1)[0] ?? '')
    : (loggedInPatient?.lastName ?? '');

  const confirmed = expectedLastName
    ? nameInput.trim().toLowerCase() === expectedLastName.toLowerCase()
    : true;

  const handleConfirm = () => {
    onClose();
    onConfirmed();
    setNameInput('');
  };

  const handleClose = () => { setNameInput(''); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={handleClose}>
        <Pressable style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }} onPress={() => {}}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: c.error, textAlign: 'center' }}>{t('deleteAccountConfirmTitle')}</Text>
          <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>{t('deleteAccountConfirmMsg')}</Text>
          {expectedLastName ? (
            <View style={{ backgroundColor: c.errorBg, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: c.error }}>
              <Text style={{ fontSize: 13, color: c.error, marginBottom: 10 }}>{t('enterLastNameConfirm')}</Text>
              <TextInput value={nameInput} onChangeText={setNameInput} placeholder={expectedLastName}
                placeholderTextColor={c.muted} autoCapitalize="words"
                style={{ backgroundColor: c.background, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.error, color: c.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 }} />
            </View>
          ) : null}
          <Pressable onPress={handleConfirm} disabled={!confirmed}
            style={({ pressed }) => ({
              backgroundColor: c.error, borderRadius: RADIUS.md, paddingVertical: 14,
              alignItems: 'center', opacity: confirmed ? (pressed ? 0.7 : 1) : 0.35,
            })}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('deleteAccountFinal')}</Text>
          </Pressable>
          <Pressable onPress={handleClose} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>{t('cancelBtn')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
