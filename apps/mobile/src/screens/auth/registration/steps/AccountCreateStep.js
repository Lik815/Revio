import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../../../../components/BackButton';
import { ICON_HIT_SLOP } from '../../../../utils/app-utils';

// Step 2 — email + password + terms. On submit it sends the OTP; the parent
// advances to OtpVerifyStep. No account exists yet at this point.
export function AccountCreateStep({
  email, onChangeEmail,
  password, onChangePassword,
  passwordConfirm, onChangePasswordConfirm,
  showPassword, onToggleShowPassword,
  showPasswordConfirm, onToggleShowPasswordConfirm,
  terms, onToggleTerms,
  error, loading,
  onSubmit, onBack, onShowLogin,
  c, t, styles,
}) {
  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <BackButton c={c} label={t('backBtn')} onPress={onBack} />

      <View style={{ paddingTop: 8, paddingBottom: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: c.text }}>{t('createAccountTitle')}</Text>
        <Text style={{ fontSize: 14, color: c.muted, marginTop: 6, lineHeight: 20 }}>{t('emailVerificationSubtitle')}</Text>
      </View>

      <View style={{ gap: 12 }}>
        <TextInput
          value={email}
          onChangeText={onChangeEmail}
          placeholder={t('emailLabel')}
          placeholderTextColor={c.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        />

        <View style={{ position: 'relative' }}>
          <TextInput
            value={password}
            onChangeText={onChangePassword}
            placeholder={t('signupPasswordPlaceholder')}
            placeholderTextColor={c.muted}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text, paddingRight: 44 }]}
          />
          <Pressable onPress={onToggleShowPassword} hitSlop={ICON_HIT_SLOP} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        </View>

        <View style={{ position: 'relative' }}>
          <TextInput
            value={passwordConfirm}
            onChangeText={onChangePasswordConfirm}
            placeholder={t('signupPasswordConfirmPlaceholder')}
            placeholderTextColor={c.muted}
            secureTextEntry={!showPasswordConfirm}
            textContentType="newPassword"
            autoComplete="new-password"
            style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text, paddingRight: 44 }]}
          />
          <Pressable onPress={onToggleShowPasswordConfirm} hitSlop={ICON_HIT_SLOP} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name={showPasswordConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        </View>

        {passwordConfirm.length > 0 && password !== passwordConfirm && (
          <Text style={{ color: c.error, fontSize: 13 }}>{t('passwordsMismatch')}</Text>
        )}
        {password.length > 0 && password.length < 8 && (
          <Text style={{ color: c.error, fontSize: 13 }}>Mindestens 8 Zeichen.</Text>
        )}

        <Pressable onPress={onToggleTerms} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: terms ? c.primary : c.border, backgroundColor: terms ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {terms && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={{ flex: 1, fontSize: 13, color: c.muted }}>{t('termsCheckbox')}</Text>
        </Pressable>

        {!!error && <Text style={{ color: c.error, fontSize: 13 }}>{error}</Text>}

        <Pressable
          onPress={onSubmit}
          disabled={loading}
          style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 8, opacity: loading ? 0.6 : 1 }]}
        >
          <Text style={styles.registerBtnText}>{loading ? '...' : t('regContinue')}</Text>
        </Pressable>

        <Pressable style={{ marginTop: 4, alignSelf: 'flex-end' }} onPress={onShowLogin}>
          <Text style={{ color: c.muted, fontSize: 13 }}>{t('alreadyHaveAccount')} {t('loginAction')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
