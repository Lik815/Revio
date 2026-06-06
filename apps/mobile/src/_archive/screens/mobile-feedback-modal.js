import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator, Keyboard, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, TYPE, getBaseUrl, TUNNEL_HEADERS } from '../../utils/app-utils';

const ICON_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function FeedbackModal({ visible, onClose, authToken, authenticatedEmail, c, t }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (visible && authenticatedEmail) setEmail(authenticatedEmail);
    if (!visible) { setSubmitted(false); setMessage(''); setError(''); }
  }, [authenticatedEmail, visible]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKeyboardInset(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardInset(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleClose = () => { setError(''); setLoading(false); setSubmitted(false); setMessage(''); onClose(); };

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    const trimmedEmail = email.trim();
    if (!trimmedMessage) { setError(t('feedbackMessageRequired')); return; }
    if (!authenticatedEmail && !isValidEmail(trimmedEmail)) { setError(t('feedbackEmailRequired')); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${getBaseUrl()}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ ...(authenticatedEmail ? {} : { email: trimmedEmail }), message: trimmedMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const combined = `${data?.error ?? ''} ${data?.message ?? ''}`.trim();
        if (/AppFeedback|P2021|does not exist/i.test(combined)) {
          setError(t('feedbackTemporarilyUnavailable'));
        } else {
          setError(data?.message || data?.error || t('feedbackSubmitError'));
        }
        return;
      }
      if (!authenticatedEmail) setEmail('');
      setSubmitted(true);
    } catch {
      setError(t('feedbackSubmitError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={handleClose} />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '82%', marginBottom: keyboardInset }}>

          {submitted ? (
            /* ── Success view ── */
            <View style={{ padding: 32, alignItems: 'center', gap: 20 }}>
              <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: c.accentBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark-circle" size={40} color={c.accent} />
              </View>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'center' }}>
                  {t('feedbackSuccessTitle')}
                </Text>
                <Text style={{ fontSize: 15, color: c.muted, textAlign: 'center', lineHeight: 22 }}>
                  {t('feedbackSuccessBody')}
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 14, width: '100%', alignItems: 'center', marginTop: 8 }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Fertig</Text>
              </Pressable>
            </View>
          ) : (
            /* ── Form view ── */
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{t('appFeedbackTitle')}</Text>
                <Pressable onPress={handleClose} hitSlop={ICON_HIT_SLOP}>
                  <Ionicons name="close" size={22} color={c.muted} />
                </Pressable>
              </View>
              <Text style={{ color: c.muted, lineHeight: 20, marginBottom: 16 }}>{t('appFeedbackBody')}</Text>
              <Text style={{ ...TYPE.label, color: c.text, marginBottom: 8 }}>{t('feedbackEmailLabel')}</Text>
              <TextInput value={authenticatedEmail || email} onChangeText={setEmail} editable={!authenticatedEmail}
                autoCapitalize="none" keyboardType="email-address" placeholder={t('feedbackEmailPlaceholder')}
                placeholderTextColor={c.muted}
                style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: authenticatedEmail ? c.muted : c.text, opacity: authenticatedEmail ? 0.8 : 1, marginTop: 0 }]} />
              {authenticatedEmail ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>{t('feedbackEmailHintLoggedIn')}</Text> : null}
              <Text style={{ ...TYPE.label, color: c.text, marginTop: 18, marginBottom: 8 }}>{t('feedbackMessageLabel')}</Text>
              <TextInput value={message} onChangeText={setMessage} multiline textAlignVertical="top"
                placeholder={t('feedbackMessagePlaceholder')} placeholderTextColor={c.muted}
                style={[styles.input, { minHeight: 120, backgroundColor: c.card, borderColor: c.border, color: c.text, paddingTop: 14, marginTop: 0 }]} />
              {!!error && <Text style={{ color: c.error, fontSize: 13, marginTop: 12 }}>{error}</Text>}
              <Pressable onPress={handleSubmit} disabled={loading}
                style={[styles.btn, { backgroundColor: loading ? c.border : c.primary, marginTop: 18, opacity: loading ? 0.8 : 1 }]}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>{t('feedbackSend')}</Text>}
              </Pressable>
            </ScrollView>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, fontSize: TYPE.body.fontSize, outlineWidth: 0 },
  btn: { borderRadius: RADIUS.md, paddingVertical: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { ...TYPE.heading, color: '#FFFFFF' },
});
