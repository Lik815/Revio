import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BackButton } from '../../../../components/BackButton';

// Step 3 — confirm the 6-digit OTP. Supports resend and changing the email
// (which sends the user back to the account step).
export function OtpVerifyStep({
  email, code, onChangeCode,
  error, loading,
  onConfirm, onResend, onChangeEmail, onBack,
  c, t, styles,
}) {
  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <BackButton c={c} label={t('backBtn')} onPress={onBack} />

      <View style={{ paddingTop: 8, paddingBottom: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: c.text }}>E-Mail bestätigen</Text>
        <Text style={{ fontSize: 14, color: c.muted, marginTop: 6, lineHeight: 20 }}>
          {`Wir haben einen 6-stelligen Code an ${email} gesendet.`}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={code}
            onChangeText={onChangeCode}
            placeholder="000000"
            placeholderTextColor={c.muted}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.regInput, { flex: 1, backgroundColor: c.card, borderColor: c.border, color: c.text, letterSpacing: 6, fontSize: 20, textAlign: 'center' }]}
          />
          <Pressable
            onPress={onConfirm}
            disabled={code.length !== 6 || loading}
            style={[styles.regInput, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, backgroundColor: code.length === 6 ? c.primary : c.border }]}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{loading ? '...' : 'Bestätigen'}</Text>
          </Pressable>
        </View>

        {!!error && <Text style={{ color: c.error, fontSize: 13 }}>{error}</Text>}

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={onResend}>
            <Text style={{ color: c.primary, fontSize: 13 }}>Code erneut senden</Text>
          </Pressable>
          <Pressable onPress={onChangeEmail}>
            <Text style={{ color: c.muted, fontSize: 13 }}>Andere E-Mail</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
