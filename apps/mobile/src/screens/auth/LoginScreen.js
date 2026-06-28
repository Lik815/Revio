import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AuthHero } from '../../components/auth/AuthHero';
import { AuthPrimaryButton } from '../../components/auth/AuthPrimaryButton';
import { AuthScreenShell } from '../../components/auth/AuthScreenShell';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getBaseUrl,
  normalizeTherapistProfile,
  SPACE,
  softenErrorMessage,
  TUNNEL_HEADERS,
} from '../../utils/app-utils';
import { useAuth } from '../../context/AuthContext';
import { useTherapyData } from '../../context/TherapyContext';
import { ROOT_ROUTES } from '../../navigation/route-names';

export function LoginScreen({ c, styles, t, onClose, bookingTargetTherapist, onBookingReady, showBackButton = true }) {
  const navigation = useNavigation();
  const { loginAsTherapist, loginAsPatient } = useAuth();
  const { loadFavorites, loadMyAppointments, loadIncomingBookings } = useTherapyData();
  const insets = useSafeAreaInsets();
  const shellTopPadding = showBackButton ? 0 : insets.top + SPACE.md;

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const registerPushToken = async (token) => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
      await fetch(`${getBaseUrl()}/auth/push-token`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expoPushToken }),
      });
    } catch { /* best-effort */ }
  };

  const loginWithCredentials = async (email, password) => {
    setLoginError('');
    setLoginNotice('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.message ?? t('alertInvalidCredentials'));
        return;
      }
      const data = await res.json();
      const token = data.accessToken || data.token;

      const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
      });
      if (!profileRes.ok) {
        setLoginError(t('alertInvalidCredentials'));
        return;
      }
      const profile = await profileRes.json();

      loadFavorites(token);
      if (profile.role === 'patient') {
        await loginAsPatient(token, profile);
        loadMyAppointments(token);
        registerPushToken(token);
        onClose();
        if (bookingTargetTherapist) onBookingReady?.();
        return;
      }
      const therapistProfile = normalizeTherapistProfile(profile);
      await loginAsTherapist(token, therapistProfile);
      loadIncomingBookings(token);
      registerPushToken(token);
      onClose();
    } catch {
      setLoginError(t('alertConnectionError') + '. ' + t('alertConnectionErrorBody'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogin = () => loginWithCredentials(loginEmail, loginPassword);

  const handleForgotPassword = async () => {
    const email = loginEmail.trim();
    setLoginError('');
    setLoginNotice('');
    if (!email) { setLoginError(t('forgotPasswordEmailMissing')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setLoginError(t('forgotPasswordEmailInvalid')); return; }
    setForgotPasswordLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.message ?? t('alertConnectionError'));
        return;
      }
      setLoginNotice(t('forgotPasswordSent'));
    } catch {
      setLoginError(t('alertConnectionError') + '. ' + t('alertConnectionErrorBody'));
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <AuthScreenShell c={c} t={t} onBack={showBackButton ? onClose : undefined} paddingHorizontal={20} paddingTop={shellTopPadding} grow>
      <AuthHero
        align="center"
        title="Willkommen zurück"
        expandable={{ label: 'Mehr erfahren', body: t('loginInfoBody') }}
        c={c}
      />

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

      <AuthPrimaryButton
        label={loginLoading ? t('loginLoading') : t('loginAction')}
        onPress={handleLogin}
        disabled={loginLoading}
        c={c}
        styles={styles}
        style={{ marginTop: 24 }}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 }}>
        <Text style={{ fontSize: 14, color: c.muted }}>Noch kein Konto?</Text>
        <Pressable onPress={() => navigation.navigate(ROOT_ROUTES.REGISTRATION)} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>{t('registerBtn')}</Text>
        </Pressable>
      </View>

      {/* Demo logins */}
      <View style={{ marginTop: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          <Text style={{ fontSize: 12, color: c.muted, fontWeight: '600' }}>DEMO</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => loginWithCredentials('demo.patient@revio.de', 'Demo1234!')}
            style={{ flex: 1, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: c.card }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="person-outline" size={14} color={c.text} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.text }}>Patient</Text>
            </View>
            <Text style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>Demo-Konto</Text>
          </Pressable>
          <Pressable
            onPress={() => loginWithCredentials('demo.physio@revio.de', 'Demo1234!')}
            style={{ flex: 1, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: c.card }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="medical-outline" size={14} color={c.text} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.text }}>Physiotherapeut</Text>
            </View>
            <Text style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>Demo-Konto</Text>
          </Pressable>
        </View>
      </View>
    </AuthScreenShell>
  );
}
