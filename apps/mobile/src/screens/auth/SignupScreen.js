import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { TYPE } from '../../utils/app-utils';

// SignupScreen removed — replaced by inline OTP+Password pre-step in App.js
export function SignupScreen(props) {
  const {
    c,
    styles,
    t,
    setShowLogin,
    setShowSignup,
    setShowRoleSelect,
    signupEmail,
    setSignupEmail,
    signupPassword,
    setSignupPassword,
    signupTerms,
    setSignupTerms,
    signupError,
    setSignupError,
  } = props;

  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    if (!signupEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) {
      setSignupError(t('signupErrorEmail'));
      return false;
    }
    if (signupPassword.length < 8) {
      setSignupError(t('signupErrorPassword'));
      return false;
    }
    if (!signupTerms) {
      setSignupError(t('signupErrorTerms'));
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    setSignupError('');
    if (!validate()) return;
    setShowRoleSelect(true);
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Back */}
      <Pressable onPress={() => setShowSignup(false)} style={{ paddingVertical: 8, marginBottom: 8, alignSelf: 'flex-start' }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-back" size={24} color={c.text} />
      </Pressable>

      {/* Heading */}
      <Text style={{ fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 28 }}>{t('signupTitle')}</Text>

      {/* Email */}
      <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 6 }}>E-MAIL</Text>
      <TextInput
        style={[styles.regInput, { color: c.text, borderColor: signupEmail ? c.primary : c.border, backgroundColor: c.mutedBg, marginBottom: 16 }]}
        placeholder="deine@email.de"
        placeholderTextColor={c.muted}
        value={signupEmail}
        onChangeText={setSignupEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />

      {/* Password */}
      <Text style={{ ...TYPE.label, color: c.muted, marginBottom: 6 }}>PASSWORT</Text>
      <View style={{ position: 'relative', marginBottom: 20 }}>
        <TextInput
          style={[styles.regInput, { color: c.text, borderColor: signupPassword ? c.primary : c.border, backgroundColor: c.mutedBg, paddingRight: 44, marginTop: 0 }]}
          placeholder={t('signupPasswordPlaceholder')}
          placeholderTextColor={c.muted}
          value={signupPassword}
          onChangeText={setSignupPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <Pressable onPress={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
        </Pressable>
      </View>

      {/* Terms */}
      <Pressable
        onPress={() => setSignupTerms(v => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}
      >
        <View style={{
          width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
          borderColor: signupTerms ? c.primary : c.border,
          backgroundColor: signupTerms ? c.primary : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {signupTerms && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
        </View>
        <Text style={{ fontSize: 13, color: c.muted, flex: 1, lineHeight: 18 }}>{t('signupTermsText')}</Text>
      </Pressable>

      {/* Error */}
      {!!signupError && (
        <View style={[styles.noticeBox, { backgroundColor: c.errorBg, borderColor: c.error, marginBottom: 16 }]}>
          <Ionicons name="alert-circle-outline" size={18} color={c.error} />
          <Text style={{ fontSize: 14, color: c.error, flex: 1 }}>{signupError}</Text>
        </View>
      )}

      {/* CTA */}
      <Pressable
        style={[styles.registerBtn, { backgroundColor: c.primary }]}
        onPress={handleContinue}
      >
        <Text style={styles.registerBtnText}>{t('registerBtn')}</Text>
      </Pressable>

      {/* Login link */}
      <Pressable
        style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 28, paddingVertical: 8 }}
        onPress={() => { setShowSignup(false); setShowLogin(true); }}
      >
        <Text style={{ fontSize: 14, color: c.muted }}>{t('signupHaveAccount')}</Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>{t('loginAction')}</Text>
      </Pressable>
    </ScrollView>
  );
}
