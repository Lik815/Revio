import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Modal,
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
    handleLogin,
    loginEmail,
    loginError,
    loginLoading,
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
      </View>

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
    __DEV__,
    c,
    setRegStep,
    setRegSubmitted,
    setShowLogin,
    setShowRegister,
    styles,
    t,
  } = props;
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center', paddingBottom: 16 }}>

      {/* Headline */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 4 }}>{t('forTherapistsTitle')}</Text>
        <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', paddingHorizontal: 16, marginBottom: 6 }}>
          {t('forTherapistsSub')}
        </Text>
        <Pressable onPress={() => setShowInfo(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 12, color: c.muted }}>Mehr erfahren</Text>
          <Ionicons name={showInfo ? 'chevron-up' : 'chevron-down'} size={12} color={c.muted} />
        </Pressable>
        {showInfo && (
          <View style={{ backgroundColor: c.mutedBg, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 12, color: c.muted, lineHeight: 18, textAlign: 'center' }}>
              {t('registrationInfoBody')}{__DEV__ ? t('registrationInfoBodyDev') : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Steps */}
      <View style={{ gap: 7, marginBottom: 20 }}>
        {[
          { icon: 'mail-outline', title: t('regStep1Title'), body: t('regStep1Body') },
          { icon: 'person-outline', title: t('regStep2Title'), body: t('regStep2Body') },
          { icon: 'checkmark-circle-outline', title: t('regStep3Title'), body: t('regStep3Body') },
          { icon: 'search-outline', title: t('regStep4Title'), body: t('regStep4Body') },
        ].map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, paddingVertical: 8, paddingHorizontal: 12 }}>
            <View style={{ width: 30, height: 30, borderRadius: RADIUS.full, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={step.icon} size={15} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>{step.title}</Text>
              <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{step.body}</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.primary }}>{i + 1}</Text>
          </View>
        ))}
      </View>

      <Pressable style={[styles.registerBtn, { backgroundColor: c.primary }]} onPress={() => { setRegStep(1); setRegSubmitted(false); setShowRegister(true); }}>
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

