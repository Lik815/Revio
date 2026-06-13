import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../../../../components/BackButton';

function OptionCard({ icon, title, subtitle, onPress, c }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        backgroundColor: c.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        opacity: pressed ? 0.7 : 1,
      }]}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{title}</Text>
        <Text style={{ fontSize: 13, color: c.muted, marginTop: 2, lineHeight: 18 }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.muted} />
    </Pressable>
  );
}

// Step 5 (therapist only) — professional situation. SELF_EMPLOYED/PREPARING
// continue the therapist track; "not self-employed" triggers an explicit
// confirmation that an account is created as a patient instead.
export function EmploymentStep({
  showPivotConfirm,
  onSelectEmployment,
  onRequestPivot, onConfirmPivot, onCancelPivot,
  loading,
  onBack,
  c, t, styles,
}) {
  if (showPivotConfirm) {
    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        <View style={{ paddingTop: 8, paddingBottom: 20 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>{t('regPivotTitle')}</Text>
          <Text style={{ fontSize: 14, color: c.muted, marginTop: 8, lineHeight: 20 }}>{t('regPivotBody')}</Text>
        </View>

        <Pressable
          style={[styles.registerBtn, { backgroundColor: loading ? c.border : c.primary }]}
          onPress={onConfirmPivot}
          disabled={loading}
        >
          <Text style={styles.registerBtnText}>{loading ? '…' : t('regPivotConfirm')}</Text>
        </Pressable>
        <Pressable style={{ marginTop: 16, alignItems: 'center', paddingVertical: 10 }} onPress={onCancelPivot} disabled={loading}>
          <Text style={{ fontSize: 14, color: c.muted }}>{t('regPivotCancel')}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <BackButton c={c} label={t('backBtn')} onPress={onBack} />
      <View style={{ paddingTop: 8, paddingBottom: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>{t('regEmploymentTitle')}</Text>
        <Text style={{ fontSize: 14, color: c.muted, marginTop: 4 }}>{t('regEmploymentBody')}</Text>
      </View>

      <View style={{ gap: 12 }}>
        <OptionCard
          icon="briefcase-outline"
          title={t('regEmploymentSelfEmployed')}
          subtitle={t('regEmploymentSelfEmployedSub')}
          onPress={() => onSelectEmployment('SELF_EMPLOYED')}
          c={c}
        />
        <OptionCard
          icon="hourglass-outline"
          title={t('regEmploymentPreparing')}
          subtitle={t('regEmploymentPreparingSub')}
          onPress={() => onSelectEmployment('PREPARING')}
          c={c}
        />
        <OptionCard
          icon="business-outline"
          title={t('regEmploymentNotSelfEmployed')}
          subtitle={t('regEmploymentNotSelfEmployedSub')}
          onPress={onRequestPivot}
          c={c}
        />
      </View>
    </ScrollView>
  );
}
