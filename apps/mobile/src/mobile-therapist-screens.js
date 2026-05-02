import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  RADIUS,
  regSpecOptions,
  softenErrorMessage,
  TYPE,
} from './mobile-utils';

export function LoginScreen(props) {
  const {
    c,
    forgotPasswordLoading,
    handleLogin,
    handleForgotPassword,
    loginEmail,
    loginError,
    loginLoading,
    loginNotice,
    loginPassword,
    setLoginEmail,
    setLoginPassword,
    setShowLogin,
    styles,
    t,
  } = props;
  const [showPassword, setShowPassword] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => setShowLogin(false)} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
      </Pressable>

      {/* Headline */}
      <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 28 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: c.text, marginBottom: 6 }}>Willkommen zurück</Text>
        <Pressable onPress={() => setShowInfo(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13, color: c.muted }}>Mehr erfahren</Text>
          <Ionicons name={showInfo ? 'chevron-up' : 'chevron-down'} size={13} color={c.muted} />
        </Pressable>
        {showInfo && (
          <View style={{ backgroundColor: c.mutedBg, borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 13, color: c.muted, lineHeight: 20, textAlign: 'center' }}>
              {t('loginInfoBody')}
            </Text>
          </View>
        )}
      </View>

      {/* Inputs */}
      <View style={{ gap: 14 }}>
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, marginBottom: 7, letterSpacing: 0.8, textTransform: 'uppercase' }}>{t('emailLabel')}</Text>
          <TextInput
            style={[styles.regInput, { color: c.text, borderColor: loginEmail.length > 0 ? c.primary : c.border, backgroundColor: c.card }]}
            value={loginEmail}
            onChangeText={setLoginEmail}
            placeholder="deine@email.de"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
        </View>
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, marginBottom: 7, letterSpacing: 0.8, textTransform: 'uppercase' }}>{t('passwordLabel')}</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[styles.regInput, { color: c.text, borderColor: loginPassword.length > 0 ? c.primary : c.border, backgroundColor: c.card, paddingRight: 44 }]}
              value={loginPassword}
              onChangeText={setLoginPassword}
              placeholder="••••••••"
              placeholderTextColor={c.muted}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="current-password"
            />
            <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
            </Pressable>
          </View>
        </View>
        <Pressable
          onPress={handleForgotPassword}
          disabled={forgotPasswordLoading}
          style={{ alignSelf: 'flex-end', paddingVertical: 4 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: forgotPasswordLoading ? c.muted : c.primary }}>
            {forgotPasswordLoading ? t('forgotPasswordLoading') : t('forgotPasswordLink')}
          </Text>
        </Pressable>
      </View>

      {loginNotice ? (
        <View style={[styles.noticeBox, { backgroundColor: c.successBg, borderColor: c.success, marginTop: 12 }]}>
          <Text style={{ color: c.success, flex: 1 }}>{loginNotice}</Text>
        </View>
      ) : null}

      {loginError ? (
        <View style={[styles.noticeBox, { backgroundColor: c.errorBg, borderColor: c.error, marginTop: 12 }]}>
          <Text style={{ color: c.error, flex: 1 }}>{softenErrorMessage(loginError)}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.registerBtn, { backgroundColor: loginLoading ? c.border : c.primary, marginTop: 24 }]}
        onPress={handleLogin}
        disabled={loginLoading}
      >
        <Text style={styles.registerBtnText}>{loginLoading ? t('loginLoading') : t('loginAction')}</Text>
      </Pressable>
    </ScrollView>
  );
}

export function TherapistLandingScreen(props) {
  const {
    c,
    setShowLogin,
    setShowSignup,
    styles,
    t,
  } = props;
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center', paddingBottom: 16 }}>

      {/* Headline */}
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 8, textAlign: 'center' }}>{t('landingTitle')}</Text>
        <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
          {t('landingSub')}
        </Text>
      </View>

      {/* Feature cards */}
      <View style={{ gap: 10, marginBottom: 28 }}>
        {[
          { icon: 'search-outline', title: t('landingFeature1Title'), body: t('landingFeature1Body') },
          { icon: 'person-outline', title: t('landingFeature2Title'), body: t('landingFeature2Body') },
          { icon: 'shield-checkmark-outline', title: t('landingFeature3Title'), body: t('landingFeature3Body') },
        ].map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, paddingVertical: 12, paddingHorizontal: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={item.icon} size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }}>{item.title}</Text>
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.registerBtn, { backgroundColor: c.primary }]}
        onPress={() => setShowSignup(true)}
      >
        <Text style={styles.registerBtnText}>{t('registerBtn')}</Text>
      </Pressable>

      <Pressable
        style={[styles.registerBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, marginTop: 8 }]}
        onPress={() => setShowLogin(true)}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{t('loginAction')}</Text>
      </Pressable>
    </View>
  );
}

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

      {/* Divider */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <Text style={{ fontSize: 12, color: c.muted }}>{t('signupOrWith')}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>

      {/* Google */}
      <Pressable
        style={[styles.registerBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: 'row', gap: 10, marginTop: 0 }]}
        onPress={() => {}}
      >
        <Text style={{ fontWeight: '700', fontSize: 17, color: '#4285F4' }}>G</Text>
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{t('signupWithGoogle')}</Text>
      </Pressable>

      {/* Apple — iOS only */}
      {Platform.OS === 'ios' && (
        <Pressable
          style={[styles.registerBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: 'row', gap: 10, marginTop: 10 }]}
          onPress={() => {}}
        >
          <Ionicons name="logo-apple" size={20} color={c.text} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{t('signupWithApple')}</Text>
        </Pressable>
      )}

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
