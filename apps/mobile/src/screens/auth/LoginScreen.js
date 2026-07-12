import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getBaseUrl,
  normalizeTherapistProfile,
  RADIUS,
  SPACE,
  softenErrorMessage,
  TUNNEL_HEADERS,
} from '../../utils/app-utils';
import { useAuth } from '../../context/AuthContext';
import { useTherapyData } from '../../context/TherapyContext';
import { ROOT_ROUTES } from '../../navigation/route-names';
import { SocialAuthButtons } from '../../components/auth/SocialAuthButtons';

const LABEL_STYLE = { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' };

export function LoginScreen({ c, styles, t, onClose, bookingTargetTherapist, onBookingReady, showBackButton = true }) {
  const navigation = useNavigation();
  const { loginAsTherapist, loginAsPatient } = useAuth();
  const { loadFavorites, loadMyAppointments, loadIncomingBookings } = useTherapyData();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState('login'); // 'login' | 'forgotPassword'
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
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
      if (!profileRes.ok) { setLoginError(t('alertInvalidCredentials')); return; }
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

  const handleForgotPassword = async () => {
    const email = loginEmail.trim();
    setLoginError('');
    setLoginNotice('');
    if (!email) { setLoginError(t('forgotPasswordEmailMissing')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setLoginError(t('forgotPasswordEmailInvalid')); return; }
    setForgotLoading(true);
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
      setForgotLoading(false);
    }
  };

  // ── Shared shell ────────────────────────────────────────────────────────────
  const topPad = insets.top + SPACE.lg;

  const Logo = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACE.xl }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>R</Text>
      </View>
      <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>Revio</Text>
    </View>
  );

  // ── Forgot Password View ─────────────────────────────────────────────────────
  if (mode === 'forgotPassword') {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: topPad, paddingHorizontal: SPACE.lg }}>
        <Pressable onPress={() => { setLoginError(''); setLoginNotice(''); setMode('login'); }} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACE.lg }}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Zurueck</Text>
        </Pressable>

        <Text style={{ fontSize: 30, fontWeight: '800', color: c.text, marginBottom: 8 }}>Passwort zuruecksetzen</Text>
        <Text style={{ fontSize: 15, color: c.muted, marginBottom: SPACE.xl, lineHeight: 22 }}>
          Gib deine E-Mail-Adresse ein — wir senden dir einen Link zum Zuruecksetzen.
        </Text>

        <Text style={[LABEL_STYLE, { color: c.muted, marginBottom: 7 }]}>E-MAIL</Text>
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

        {loginNotice ? (
          <View style={[styles.noticeBox, { backgroundColor: c.successBg, borderColor: c.success, marginTop: 16 }]}>
            <Text style={{ color: c.success, flex: 1 }}>{loginNotice}</Text>
          </View>
        ) : null}
        {loginError ? (
          <View style={[styles.noticeBox, { backgroundColor: c.errorBg, borderColor: c.error, marginTop: 16 }]}>
            <Text style={{ color: c.error, flex: 1 }}>{softenErrorMessage(loginError)}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleForgotPassword}
          disabled={forgotLoading}
          style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', marginTop: SPACE.lg }}
        >
          {forgotLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Link senden</Text>}
        </Pressable>
      </View>
    );
  }

  // ── Login View ───────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: topPad, paddingHorizontal: SPACE.lg }}>
      <Logo />

      <Text style={{ fontSize: 30, fontWeight: '800', color: c.text, marginBottom: 6 }}>Willkommen zurueck</Text>
      <Text style={{ fontSize: 15, color: c.muted, marginBottom: SPACE.xl }}>Melde dich an, um fortzufahren.</Text>

      {/* Fields */}
      <View style={{ gap: 14, marginBottom: SPACE.lg }}>
        <View>
          <Text style={[LABEL_STYLE, { color: c.muted, marginBottom: 7 }]}>E-MAIL</Text>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <Text style={[LABEL_STYLE, { color: c.muted }]}>PASSWORT</Text>
            <Pressable onPress={() => { setLoginError(''); setLoginNotice(''); setMode('forgotPassword'); }} hitSlop={8}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Passwort vergessen?</Text>
            </Pressable>
          </View>
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

      {loginNotice ? (
        <View style={[styles.noticeBox, { backgroundColor: c.successBg, borderColor: c.success, marginBottom: 12 }]}>
          <Text style={{ color: c.success, flex: 1 }}>{loginNotice}</Text>
        </View>
      ) : null}
      {loginError ? (
        <View style={[styles.noticeBox, { backgroundColor: c.errorBg, borderColor: c.error, marginBottom: 12 }]}>
          <Text style={{ color: c.error, flex: 1 }}>{softenErrorMessage(loginError)}</Text>
        </View>
      ) : null}

      {/* Anmelden */}
      <Pressable
        onPress={() => loginWithCredentials(loginEmail, loginPassword)}
        disabled={loginLoading}
        style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', marginBottom: SPACE.lg }}
      >
        {loginLoading
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Anmelden</Text>}
      </Pressable>

      {/* Social */}
      <SocialAuthButtons c={c} />

      {/* Register link */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: SPACE.lg }}>
        <Text style={{ fontSize: 14, color: c.muted }}>Noch kein Konto?</Text>
        <Pressable onPress={() => navigation.navigate(ROOT_ROUTES.REGISTRATION)} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>Jetzt registrieren</Text>
        </Pressable>
      </View>

      {/* Demo */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SPACE.xl }}>
        <Text style={{ fontSize: 13, color: c.muted }}>Demo ausprobieren:</Text>
        <Pressable
          onPress={() => loginWithCredentials('demo.patient@revio.de', 'Demo1234!')}
          style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>Patient</Text>
        </Pressable>
        <Pressable
          onPress={() => loginWithCredentials('demo.physio@revio.de', 'Demo1234!')}
          style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.text }}>Physiotherapeut</Text>
        </Pressable>
      </View>
    </View>
  );
}
