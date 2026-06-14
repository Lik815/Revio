import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../../../../components/BackButton';

// Step 6 (therapist only) — pick specializations. Recommended but skippable;
// the final submit (POST /register/therapist) happens from here.
export function SpecializationsStep({
  options,
  selected, onToggle,
  error, loading,
  onSubmit, onSkip, onBack,
  c, t, styles,
}) {
  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <BackButton c={c} label={t('backBtn')} onPress={onBack} />

      <View style={{ paddingTop: 8, paddingBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>{t('regSpecTitle')}</Text>
        <Text style={{ fontSize: 14, color: c.muted, marginTop: 4, lineHeight: 20 }}>{t('regSpecSubtitle')}</Text>
        <Text style={{ fontSize: 13, color: c.muted, marginTop: 6 }}>{t('regSpecOptional')}</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {(options ?? []).map((option) => {
          const spec = option.label;
          const isOn = selected.includes(spec);
          return (
            <Pressable
              key={spec}
              onPress={() => onToggle(spec)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 9,
                paddingHorizontal: 14,
                borderRadius: 20,
                borderWidth: 1,
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
        <Text style={styles.registerBtnText}>{loading ? '…' : t('regFinishTherapist')}</Text>
      </Pressable>
      <Pressable style={{ marginTop: 16, alignItems: 'center', paddingVertical: 10 }} onPress={onSkip} disabled={loading}>
        <Text style={{ fontSize: 14, color: c.muted }}>{t('regSkip')}</Text>
      </Pressable>
    </ScrollView>
  );
}
