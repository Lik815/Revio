import React, { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl, ICON_HIT_SLOP, TUNNEL_HEADERS } from './mobile-utils';

export function PatientSignupFlow({
  visible,
  onClose,
  onSignedUp,
  onShowLogin,
  onSelectTherapist,
  c, t, styles,
}) {
  const [showSignup, setShowSignup] = useState(false);
  const [showRoleSelect, setShowRoleSelect] = useState(true);
  const [showPatientName, setShowPatientName] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [signupOtpCode, setSignupOtpCode] = useState('');
  const [signupOtpError, setSignupOtpError] = useState('');
  const [signupOtpLoading, setSignupOtpLoading] = useState(false);
  const [signupEmailVerified, setSignupEmailVerified] = useState(false);
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupPasswordConfirm, setShowSignupPasswordConfirm] = useState(false);
  const [signupTerms, setSignupTerms] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [patientRegFirstName, setPatientRegFirstName] = useState('');
  const [patientRegLastName, setPatientRegLastName] = useState('');
  const [patientRegLoading, setPatientRegLoading] = useState(false);
  const [patientRegError, setPatientRegError] = useState('');

  if (!visible) return null;

  const resetSignupState = () => {
    setSignupEmail('');
    setSignupOtpSent(false);
    setSignupOtpCode('');
    setSignupOtpError('');
    setSignupOtpLoading(false);
    setSignupEmailVerified(false);
    setSignupPassword('');
    setSignupPasswordConfirm('');
    setShowSignupPassword(false);
    setShowSignupPasswordConfirm(false);
    setSignupTerms(false);
    setSignupError('');
    setShowRoleSelect(true);
    setShowSignup(false);
    setShowPatientName(false);
    setPatientRegFirstName('');
    setPatientRegLastName('');
    setPatientRegError('');
  };

const handlePatientNameSubmit = async () => {
  setPatientRegError('');
  const email = signupEmail.trim().toLowerCase();
  const firstName = patientRegFirstName.trim();
  const lastName = patientRegLastName.trim();

  if (!firstName || !lastName) {
    setPatientRegError(t('patientRegNameRequired'));
    return;
  }
  setPatientRegLoading(true);
  try {
    const res = await fetch(`${getBaseUrl()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: signupPassword,
        role: 'patient',
        firstName,
        lastName,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setPatientRegError(err.message ?? t('alertConnectionError'));
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.token) {
      await AsyncStorage.setItem('revio_auth_token', data.token);
      await AsyncStorage.setItem('revio_account_type', 'patient');
      onSignedUp?.(data.token);
    }
    setShowSignup(false);
    resetSignupState();
  } catch {
    setPatientRegError(t('alertConnectionError') + '. ' + t('alertConnectionErrorBody'));
  } finally {
    setPatientRegLoading(false);
  }
};

const renderRoleSelect = () => (
  <View style={{ flex: 1, paddingHorizontal: 20 }}>
    <Pressable
      onPress={() => { setShowRoleSelect(false); setShowSignup(true); }}
      style={{ paddingTop: 16, paddingBottom: 4, alignSelf: 'flex-start' }}
    >
      <Text style={{ fontSize: 15, color: c.primary }}>‹ {t('backBtn')}</Text>
    </Pressable>
    <View style={{ paddingTop: 8, paddingBottom: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>{t('registerRoleTitle')}</Text>
      <Text style={{ fontSize: 14, color: c.muted, marginTop: 4 }}>{t('registerRoleBody')}</Text>
    </View>

    <View style={{ gap: 12 }}>
      {/* Patient — filled/primary */}
      <Pressable
        onPress={() => { setShowRoleSelect(false); setShowPatientName(true); }}
        style={({ pressed }) => [{
          backgroundColor: c.primary,
          borderRadius: 16,
          padding: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          opacity: pressed ? 0.8 : 1,
        }]}
      >
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="heart-outline" size={24} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>{t('registerRolePatient')}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{t('registerRolePatientSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.75)" />
      </Pressable>

      {/* Therapeut — outlined */}
      <Pressable
        onPress={() => {
          onSelectTherapist?.();
          resetSignupState();
        }}
        style={({ pressed }) => [{
          backgroundColor: c.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          padding: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          opacity: pressed ? 0.7 : 1,
        }]}
      >
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person-outline" size={24} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{t('registerRoleTherapist')}</Text>
          <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{t('registerRoleTherapistSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.muted} />
      </Pressable>
    </View>
  </View>
);
const renderPatientName = () => (
  <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
    <View style={{ paddingTop: 8, paddingBottom: 24 }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: c.text }}>{t('patientNameTitle')}</Text>
      <Text style={{ fontSize: 14, color: c.muted, marginTop: 6, lineHeight: 20 }}>{t('patientNameSubtitle')}</Text>
    </View>

    <View style={{ gap: 12, marginBottom: 24 }}>
      <TextInput
        style={[styles.regInput, { color: c.text, borderColor: patientRegFirstName ? c.primary : c.border, backgroundColor: c.mutedBg }]}
        placeholder={t('firstName')}
        placeholderTextColor={c.muted}
        value={patientRegFirstName}
        onChangeText={setPatientRegFirstName}
        autoCapitalize="words"
        autoFocus
      />
      <TextInput
        style={[styles.regInput, { color: c.text, borderColor: patientRegLastName ? c.primary : c.border, backgroundColor: c.mutedBg }]}
        placeholder={t('lastName')}
        placeholderTextColor={c.muted}
        value={patientRegLastName}
        onChangeText={setPatientRegLastName}
        autoCapitalize="words"
      />
    </View>

    {!!patientRegError && (
      <View style={[styles.noticeBox, { backgroundColor: c.errorBg, borderColor: c.error, marginBottom: 16 }]}>
        <Ionicons name="alert-circle-outline" size={18} color={c.error} />
        <Text style={{ fontSize: 14, color: c.error, flex: 1 }}>{patientRegError}</Text>
      </View>
    )}

    <Pressable
      style={[styles.registerBtn, { backgroundColor: patientRegLoading ? c.border : c.primary }]}
      onPress={handlePatientNameSubmit}
      disabled={patientRegLoading}
    >
      <Text style={styles.registerBtnText}>{patientRegLoading ? '…' : t('createAccountBtn')}</Text>
    </Pressable>

    <Pressable
      style={{ marginTop: 16, alignItems: 'center', paddingVertical: 10 }}
      onPress={() => { setShowPatientName(false); setShowRoleSelect(true); setPatientRegError(''); }}
    >
      <Text style={{ fontSize: 14, color: c.muted }}>{t('backBtn')}</Text>
    </Pressable>
  </ScrollView>
);

const renderSignup = () => (
  <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
    {/* Back / cancel */}
    <Pressable
      onPress={() => {
        if (signupOtpSent) {
          setSignupOtpSent(false);
          setSignupOtpCode('');
          setSignupOtpError('');
          setSignupOtpLoading(false);
          setSignupEmailVerified(false);
        } else {
          setShowSignup(false);
          resetSignupState();
        }
      }}
      style={{ paddingTop: 16, paddingBottom: 4, alignSelf: 'flex-start' }}
    >
      <Text style={{ fontSize: 15, color: c.primary }}>‹ {signupOtpSent ? t('backBtn') : t('cancelBtn')}</Text>
    </Pressable>

    <View style={{ paddingTop: 8, paddingBottom: 20 }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: c.text }}>
        {signupOtpSent ? 'E-Mail bestätigen' : t('createAccountTitle')}
      </Text>
      <Text style={{ fontSize: 14, color: c.muted, marginTop: 6, lineHeight: 20 }}>
        {signupOtpSent
          ? `Wir haben einen 6-stelligen Code an ${signupEmail} gesendet.`
          : t('emailVerificationSubtitle')}
      </Text>
    </View>

    {/* ── Phase A: E-Mail + Passwort + AGB ─────────────────────────── */}
    {!signupOtpSent && (
      <View style={{ gap: 12 }}>
        <TextInput
          value={signupEmail}
          onChangeText={(v) => { setSignupEmail(v); setSignupOtpError(''); }}
          placeholder={t('emailLabel')}
          placeholderTextColor={c.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        />

        <View style={{ position: 'relative' }}>
          <TextInput
            value={signupPassword}
            onChangeText={setSignupPassword}
            placeholder={t('signupPasswordPlaceholder')}
            placeholderTextColor={c.muted}
            secureTextEntry={!showSignupPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text, paddingRight: 44 }]}
          />
          <Pressable onPress={() => setShowSignupPassword(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name={showSignupPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        </View>

        <View style={{ position: 'relative' }}>
          <TextInput
            value={signupPasswordConfirm}
            onChangeText={setSignupPasswordConfirm}
            placeholder={t('signupPasswordConfirmPlaceholder')}
            placeholderTextColor={c.muted}
            secureTextEntry={!showSignupPasswordConfirm}
            textContentType="newPassword"
            autoComplete="new-password"
            style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text, paddingRight: 44 }]}
          />
          <Pressable onPress={() => setShowSignupPasswordConfirm(v => !v)} hitSlop={ICON_HIT_SLOP} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name={showSignupPasswordConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        </View>

        {signupPasswordConfirm.length > 0 && signupPassword !== signupPasswordConfirm && (
          <Text style={{ color: c.error, fontSize: 13 }}>{t('passwordsMismatch')}</Text>
        )}

        {signupPassword.length > 0 && signupPassword.length < 8 && (
          <Text style={{ color: c.error, fontSize: 13 }}>Mindestens 8 Zeichen.</Text>
        )}

        {/* Terms */}
        <Pressable onPress={() => setSignupTerms(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: signupTerms ? c.primary : c.border, backgroundColor: signupTerms ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {signupTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={{ flex: 1, fontSize: 13, color: c.muted }}>{t('termsCheckbox')}</Text>
        </Pressable>

        {!!signupOtpError && <Text style={{ color: c.error, fontSize: 13 }}>{signupOtpError}</Text>}

        <Pressable
          onPress={async () => {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)) { setSignupOtpError('Bitte gib eine gültige E-Mail ein.'); return; }
            if (signupPassword.length < 8) { setSignupOtpError('Passwort muss mindestens 8 Zeichen haben.'); return; }
            if (signupPassword !== signupPasswordConfirm) { setSignupOtpError(t('passwordsMismatch')); return; }
            if (!signupTerms) { setSignupOtpError(t('termsRequired')); return; }
            setSignupOtpLoading(true); setSignupOtpError('');
            try {
              const res = await fetch(`${getBaseUrl()}/register/send-otp`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: signupEmail.trim().toLowerCase() }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) { setSignupOtpError(data.message ?? 'Fehler beim Senden.'); return; }
              setSignupOtpSent(true);
            } catch { setSignupOtpError('Verbindungsfehler.'); }
            finally { setSignupOtpLoading(false); }
          }}
          disabled={signupOtpLoading}
          style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 8, opacity: signupOtpLoading ? 0.6 : 1 }]}
        >
          <Text style={styles.registerBtnText}>{signupOtpLoading ? '...' : 'Weiter →'}</Text>
        </Pressable>

        <Pressable style={{ marginTop: 4, alignSelf: 'flex-end' }} onPress={() => { setShowSignup(false); onShowLogin(); resetSignupState(); }}>
          <Text style={{ color: c.muted, fontSize: 13 }}>{t('alreadyHaveAccount')} {t('loginAction')}</Text>
        </Pressable>
      </View>
    )}

    {/* ── Phase B: OTP bestätigen ───────────────────────────────────── */}
    {signupOtpSent && (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={signupOtpCode}
            onChangeText={(v) => { setSignupOtpCode(v.replace(/\D/g, '').slice(0, 6)); setSignupOtpError(''); }}
            placeholder="000000"
            placeholderTextColor={c.muted}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.regInput, { flex: 1, backgroundColor: c.card, borderColor: c.border, color: c.text, letterSpacing: 6, fontSize: 20, textAlign: 'center' }]}
          />
          <Pressable
            onPress={async () => {
              if (signupOtpCode.length !== 6) return;
              setSignupOtpLoading(true); setSignupOtpError('');
              try {
                const res = await fetch(`${getBaseUrl()}/register/confirm-otp`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: signupEmail.trim().toLowerCase(), code: signupOtpCode }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) { setSignupOtpError(data.message ?? 'Falscher Code.'); return; }
                setSignupEmailVerified(true);
                setShowSignup(false);
                setShowRoleSelect(true);
              } catch { setSignupOtpError('Verbindungsfehler.'); }
              finally { setSignupOtpLoading(false); }
            }}
            disabled={signupOtpCode.length !== 6 || signupOtpLoading}
            style={[styles.regInput, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, backgroundColor: signupOtpCode.length === 6 ? c.primary : c.border }]}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{signupOtpLoading ? '...' : 'Bestätigen'}</Text>
          </Pressable>
        </View>

        {!!signupOtpError && <Text style={{ color: c.error, fontSize: 13 }}>{signupOtpError}</Text>}

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={async () => {
            setSignupOtpLoading(true); setSignupOtpError('');
            try {
              const res = await fetch(`${getBaseUrl()}/register/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: signupEmail.trim().toLowerCase() }) });
              if (!res.ok) { const d = await res.json().catch(() => ({})); setSignupOtpError(d.message ?? 'Fehler beim Senden.'); }
            } catch { setSignupOtpError('Verbindungsfehler.'); }
            finally { setSignupOtpLoading(false); }
          }}>
            <Text style={{ color: c.primary, fontSize: 13 }}>Code erneut senden</Text>
          </Pressable>
          <Pressable onPress={() => {
            setSignupOtpSent(false);
            setSignupOtpCode('');
            setSignupOtpError('');
            setSignupOtpLoading(false);
            setSignupEmailVerified(false);
          }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>Andere E-Mail</Text>
          </Pressable>
        </View>
      </View>
    )}
  </ScrollView>
);


  if (showPatientName) return renderPatientName();
  if (showSignup) return renderSignup();
  return renderRoleSelect();
}
