import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthScreenShell } from '../../../../components/auth/AuthScreenShell';
import { SocialAuthButtons } from '../../../../components/auth/SocialAuthButtons';
import { ICON_HIT_SLOP, RADIUS } from '../../../../utils/app-utils';

const LABEL_STYLE = { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' };

// Step 1 — role toggle + name + email + password. On submit sends the OTP.
export function AccountCreateStep({
  role, onSelectRole,
  name, onChangeName,
  email, onChangeEmail,
  password, onChangePassword,
  showPassword, onToggleShowPassword,
  error, loading,
  onSubmit, onBack, onShowLogin,
  c, t, styles,
}) {
  return (
    <AuthScreenShell c={c} t={t} onBack={onBack}>
      <Text style={{ fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 4 }}>Konto erstellen</Text>
      <Text style={{ fontSize: 15, color: c.muted, marginBottom: 24 }}>In zwei Minuten startklar.</Text>

      {/* Rolle */}
      <View style={{ marginBottom: 20 }}>
        <Text style={[LABEL_STYLE, { color: c.muted, marginBottom: 8 }]}>ICH BIN</Text>
        <View style={{ flexDirection: 'row', backgroundColor: c.mutedBg ?? c.card, borderRadius: RADIUS.md, padding: 3, borderWidth: 1, borderColor: c.border }}>
          {[
            { key: 'patient', label: 'Patient:in' },
            { key: 'therapist', label: 'Physiotherapeut:in' },
          ].map((item) => (
            <Pressable
              key={item.key}
              onPress={() => onSelectRole(item.key)}
              style={{
                flex: 1,
                paddingVertical: 9,
                alignItems: 'center',
                borderRadius: RADIUS.sm - 2,
                backgroundColor: role === item.key ? c.primary : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: role === item.key ? '700' : '500', color: role === item.key ? '#fff' : c.muted }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Name */}
      <View style={{ marginBottom: 14 }}>
        <Text style={[LABEL_STYLE, { color: c.muted, marginBottom: 7 }]}>NAME</Text>
        <TextInput
          value={name}
          onChangeText={onChangeName}
          placeholder="Vor- und Nachname"
          placeholderTextColor={c.muted}
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
          style={[styles.regInput, { backgroundColor: c.card, borderColor: name ? c.primary : c.border, color: c.text }]}
        />
      </View>

      {/* E-Mail */}
      <View style={{ marginBottom: 14 }}>
        <Text style={[LABEL_STYLE, { color: c.muted, marginBottom: 7 }]}>E-MAIL</Text>
        <TextInput
          value={email}
          onChangeText={onChangeEmail}
          placeholder="deine@email.de"
          placeholderTextColor={c.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          autoComplete="email"
          style={[styles.regInput, { backgroundColor: c.card, borderColor: email ? c.primary : c.border, color: c.text }]}
        />
      </View>

      {/* Passwort */}
      <View style={{ marginBottom: 20 }}>
        <Text style={[LABEL_STYLE, { color: c.muted, marginBottom: 7 }]}>PASSWORT</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            value={password}
            onChangeText={onChangePassword}
            placeholder="Mind. 8 Zeichen"
            placeholderTextColor={c.muted}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            style={[styles.regInput, { backgroundColor: c.card, borderColor: password ? c.primary : c.border, color: c.text, paddingRight: 44 }]}
          />
          <Pressable onPress={onToggleShowPassword} hitSlop={ICON_HIT_SLOP} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        </View>
        {password.length > 0 && password.length < 8 && (
          <Text style={{ color: c.error, fontSize: 13, marginTop: 6 }}>Mindestens 8 Zeichen.</Text>
        )}
      </View>

      {!!error && (
        <View style={{ marginBottom: 14 }}>
          <Text style={{ color: c.error, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {/* Konto erstellen */}
      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={{ backgroundColor: c.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', marginBottom: 20 }}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Konto erstellen</Text>}
      </Pressable>

      {/* Social */}
      <SocialAuthButtons c={c} />

      {/* AGB */}
      <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center', marginTop: 16, lineHeight: 18 }}>
        Mit der Registrierung akzeptierst du unsere{' '}
        <Text style={{ fontWeight: '700', color: c.text }}>AGB</Text>
        {' '}und{' '}
        <Text style={{ fontWeight: '700', color: c.text }}>Datenschutzerklaerung</Text>
        .
      </Text>
    </AuthScreenShell>
  );
}
