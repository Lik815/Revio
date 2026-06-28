import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../../../../components/BackButton';

// Step 4 (practice track) — collect the practice profile, then create the
// practice_admin account. Specialties are chips (from config); services is a
// free-text, comma-separated field.
export function PracticeProfileCreateStep({
  values, setField,
  specializationOptions, selectedSpecialties, onToggleSpecialty,
  cityLoading,
  error, loading,
  onSubmit, onBack,
  c, t, styles,
}) {
  const v = values;
  const input = (field, placeholder, extra = {}) => (
    <TextInput
      style={[styles.regInput, { color: c.text, borderColor: v[field] ? c.primary : c.border, backgroundColor: c.mutedBg }, extra.style]}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      value={v[field]}
      onChangeText={(text) => setField(field, text)}
      {...extra.props}
    />
  );

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <BackButton c={c} label={t('backBtn')} onPress={onBack} />

      <View style={{ paddingTop: 8, paddingBottom: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: c.text }}>{t('practiceCreateTitle')}</Text>
        <Text style={{ fontSize: 14, color: c.muted, marginTop: 6, lineHeight: 20 }}>{t('practiceCreateSubtitle')}</Text>
      </View>

      <View style={{ gap: 12, marginBottom: 20 }}>
        {input('name', t('practiceNameLabel'), { props: { autoCapitalize: 'words', autoFocus: true } })}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            {input('postalCode', t('postalCodeLabel'), { props: { keyboardType: 'number-pad', maxLength: 5 } })}
          </View>
          <View style={{ flex: 2, position: 'relative' }}>
            {input('city', t('cityLabel'), { props: { autoCapitalize: 'words' }, style: { paddingRight: 36 } })}
            {cityLoading && (
              <ActivityIndicator size="small" color={c.muted} style={{ position: 'absolute', right: 12, top: 0, bottom: 0 }} />
            )}
          </View>
        </View>

        {input('address', t('practiceAddressLabel'))}
        {input('phone', t('practicePhoneLabel'), { props: { keyboardType: 'phone-pad' } })}
        {input('email', t('practiceEmailLabel'), { props: { keyboardType: 'email-address', autoCapitalize: 'none' } })}
        {input('website', t('practiceWebsiteLabel'), { props: { autoCapitalize: 'none' } })}

        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>{t('practiceSpecialtiesLabel')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(specializationOptions ?? []).map((option) => {
            const spec = option.label;
            const isOn = selectedSpecialties.includes(spec);
            return (
              <Pressable
                key={spec}
                onPress={() => onToggleSpecialty(spec)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1,
                  borderColor: isOn ? c.primary : c.border,
                  backgroundColor: isOn ? c.primaryBg : c.card,
                }}
              >
                {isOn && <Ionicons name="checkmark" size={14} color={c.primary} />}
                <Text style={{ fontSize: 13, color: isOn ? c.primary : c.text, fontWeight: isOn ? '600' : '400' }}>{spec}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>{t('practiceServicesLabel')}</Text>
        {input('services', t('practiceServicesPlaceholder'))}

        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>{t('practiceDescriptionLabel')}</Text>
        <TextInput
          style={[styles.regInput, { color: c.text, borderColor: v.description ? c.primary : c.border, backgroundColor: c.mutedBg, height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
          placeholder={t('practiceDescriptionPlaceholder')}
          placeholderTextColor={c.muted}
          value={v.description}
          onChangeText={(text) => setField('description', text)}
          multiline
        />
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
        <Text style={styles.registerBtnText}>{loading ? '…' : t('practiceCreateSubmit')}</Text>
      </Pressable>
    </ScrollView>
  );
}
