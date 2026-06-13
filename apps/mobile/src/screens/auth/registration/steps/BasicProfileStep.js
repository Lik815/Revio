import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../../../../components/BackButton';

// Step 4 — first/last name for everyone; therapists also enter postal code +
// city here (shown only when role === 'therapist').
export function BasicProfileStep({
  role,
  firstName, onChangeFirstName,
  lastName, onChangeLastName,
  postalCode, onChangePostalCode,
  city, onChangeCity, cityLoading,
  error, loading,
  onSubmit, onBack,
  c, t, styles,
}) {
  const isTherapist = role === 'therapist';
  const title = isTherapist ? t('regBasicTherapistTitle') : t('patientNameTitle');
  const subtitle = isTherapist ? t('regBasicTherapistSubtitle') : t('patientNameSubtitle');
  const submitLabel = isTherapist ? t('regContinue') : t('createAccountBtn');

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <BackButton c={c} label={t('backBtn')} onPress={onBack} />

      <View style={{ paddingTop: 8, paddingBottom: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: c.text }}>{title}</Text>
        <Text style={{ fontSize: 14, color: c.muted, marginTop: 6, lineHeight: 20 }}>{subtitle}</Text>
      </View>

      <View style={{ gap: 12, marginBottom: 24 }}>
        <TextInput
          style={[styles.regInput, { color: c.text, borderColor: firstName ? c.primary : c.border, backgroundColor: c.mutedBg }]}
          placeholder={t('firstName')}
          placeholderTextColor={c.muted}
          value={firstName}
          onChangeText={onChangeFirstName}
          autoCapitalize="words"
          autoFocus
        />
        <TextInput
          style={[styles.regInput, { color: c.text, borderColor: lastName ? c.primary : c.border, backgroundColor: c.mutedBg }]}
          placeholder={t('lastName')}
          placeholderTextColor={c.muted}
          value={lastName}
          onChangeText={onChangeLastName}
          autoCapitalize="words"
        />

        {isTherapist && (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TextInput
                style={[styles.regInput, { flex: 1, color: c.text, borderColor: postalCode ? c.primary : c.border, backgroundColor: c.mutedBg }]}
                placeholder={t('postalCodeLabel')}
                placeholderTextColor={c.muted}
                value={postalCode}
                onChangeText={onChangePostalCode}
                keyboardType="number-pad"
                maxLength={5}
              />
              <View style={{ flex: 2, position: 'relative' }}>
                <TextInput
                  style={[styles.regInput, { color: c.text, borderColor: city ? c.primary : c.border, backgroundColor: c.mutedBg, paddingRight: 36 }]}
                  placeholder={t('cityLabel')}
                  placeholderTextColor={c.muted}
                  value={city}
                  onChangeText={onChangeCity}
                  autoCapitalize="words"
                />
                {cityLoading && (
                  <ActivityIndicator
                    size="small"
                    color={c.muted}
                    style={{ position: 'absolute', right: 12, top: 0, bottom: 0 }}
                  />
                )}
              </View>
            </View>
            <Text style={{ fontSize: 12, color: c.muted, marginTop: -4 }}>
              Stadt wird aus der PLZ ermittelt. Falls nicht, bitte selbst eintragen.
            </Text>
          </>
        )}
      </View>

      {!!error && (
        <View style={[styles.noticeBox, { backgroundColor: c.errorBg, borderColor: c.error, marginBottom: 16 }]}>
          <Ionicons name="alert-circle-outline" size={18} color={c.error} />
          <Text style={{ fontSize: 14, color: c.error, flex: 1 }}>{error}</Text>
        </View>
      )}

      <Pressable
        style={[styles.registerBtn, { backgroundColor: loading ? c.border : c.primary }]}
        onPress={onSubmit}
        disabled={loading}
      >
        <Text style={styles.registerBtnText}>{loading ? '…' : submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}
