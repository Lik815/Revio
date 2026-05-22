import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBaseUrl, normalizeTherapistProfile, softenErrorMessage } from './mobile-utils';

const ICON_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

export function InviteClaimScreen({
  loading: externalLoading,
  error: externalError,
  claimData,
  token,
  onClose,
  onClaimed,
  c, t,
  styles: sharedStyles,
}) {
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (externalLoading && !claimData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background }}>
        <Text style={{ color: c.muted, fontSize: 15 }}>{t('inviteChecking')}</Text>
      </View>
    );
  }

  if (externalError && !claimData) {
    return (
      <ScrollView contentContainerStyle={[sharedStyles.scrollContent, { paddingBottom: 40 }]}>
        <View style={[sharedStyles.infoCard, { backgroundColor: c.card, borderColor: c.border, marginTop: 40 }]}>
          <Ionicons name="alert-circle-outline" size={40} color={c.error} style={{ alignSelf: 'center' }} />
          <Text style={[sharedStyles.infoTitle, { color: c.text, textAlign: 'center' }]}>{t('inviteCheckFailed')}</Text>
          <Text style={[sharedStyles.infoBody, { color: c.muted, textAlign: 'center' }]}>{softenErrorMessage(externalError)}</Text>
          <Pressable style={[sharedStyles.registerBtn, { backgroundColor: c.primary, marginTop: 8 }]} onPress={onClose}>
            <Text style={sharedStyles.registerBtnText}>{t('toAppBtn')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (!claimData) return null;

  const { therapist: inviteTherapist, practice: invitePractice } = claimData;

  const handleClaim = async () => {
    if (!password || password.length < 6) { setError(t('passwordMinLength')); return; }
    if (password !== passwordConfirm) { setError(t('passwordsMismatch')); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${getBaseUrl()}/invite/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message ?? t('accountActivationError')); return; }
      onClaimed(data.token);
    } catch {
      setError(t('connectionErrorRetry'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[sharedStyles.scrollContent, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <View style={[sharedStyles.infoCard, { backgroundColor: c.card, borderColor: c.border, marginTop: 20, alignItems: 'center' }]}>
        <Image source={require('../assets/icon.png')} style={{ width: 56, height: 56, borderRadius: 16 }} />
        <Text style={[sharedStyles.infoTitle, { color: c.text, textAlign: 'center', marginTop: 8 }]}>{t('youWereInvited')}</Text>
        <Text style={[sharedStyles.infoBody, { color: c.muted, textAlign: 'center' }]}>
          {t('inviteSetPasswordInfo').replace('{name}', invitePractice.name)}
        </Text>
      </View>
      <View style={[sharedStyles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[sharedStyles.filterSectionTitle, { color: c.muted }]}>{t('yourProfile')}</Text>
        <Text style={[sharedStyles.detailInfoValue, { color: c.text, fontWeight: '700', fontSize: 17 }]}>{inviteTherapist.fullName}</Text>
        <Text style={[sharedStyles.detailInfoValue, { color: c.muted }]}>{inviteTherapist.professionalTitle}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Ionicons name="business-outline" size={14} color={c.muted} />
          <Text style={[sharedStyles.detailInfoValue, { color: c.muted }]}>{invitePractice.name}, {invitePractice.city}</Text>
        </View>
      </View>
      <View style={[sharedStyles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[sharedStyles.filterSectionTitle, { color: c.muted }]}>{t('setPassword')}</Text>
        <View style={{ position: 'relative', marginTop: 6 }}>
          <TextInput style={[sharedStyles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginTop: 0, paddingRight: 44 }]}
            value={password} onChangeText={setPassword} placeholder={t('passwordPlaceholder')}
            placeholderTextColor={c.muted} secureTextEntry={!showPassword} autoCapitalize="none" />
          <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={ICON_HIT_SLOP}
            style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        </View>
        <View style={{ position: 'relative', marginTop: 10 }}>
          <TextInput style={[sharedStyles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginTop: 0, paddingRight: 44 }]}
            value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder={t('passwordConfirmPlaceholder')}
            placeholderTextColor={c.muted} secureTextEntry={!showPasswordConfirm} autoCapitalize="none" />
          <Pressable onPress={() => setShowPasswordConfirm(v => !v)} hitSlop={ICON_HIT_SLOP}
            style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name={showPasswordConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        </View>
        {!!error && <Text style={{ color: c.error, fontSize: 13, marginTop: 8 }}>{softenErrorMessage(error)}</Text>}
        <Pressable style={[sharedStyles.registerBtn, { backgroundColor: loading ? c.border : c.primary, marginTop: 16 }]}
          onPress={handleClaim} disabled={loading}>
          <Text style={sharedStyles.registerBtnText}>{loading ? 'Aktivieren…' : 'Konto aktivieren'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
